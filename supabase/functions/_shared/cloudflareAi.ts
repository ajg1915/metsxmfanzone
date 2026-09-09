// Shared Cloudflare Workers AI helper for Supabase Edge Functions.
// Reads CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN from env.
// Provides both one-shot text generation and streaming helpers.

export interface CloudflareAiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CloudflareAiOptions {
  messages: CloudflareAiMessage[];
  model?: string;
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
}

// Default to a capable free-tier text model. Override per-call if needed.
export const DEFAULT_CLOUDFLARE_TEXT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

export function getCloudflareAiConfig(): { accountId: string; apiToken: string } {
  const accountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");
  const apiToken = Deno.env.get("CLOUDFLARE_API_TOKEN");
  if (!accountId || !apiToken) {
    throw new Error("Cloudflare AI credentials not configured. Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN.");
  }
  return { accountId, apiToken };
}

export function buildCloudflareAiUrl(accountId: string, model: string): string {
  return `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;
}

export async function callCloudflareAi({
  messages,
  model = DEFAULT_CLOUDFLARE_TEXT_MODEL,
  max_tokens,
  temperature,
  stream = false,
}: CloudflareAiOptions): Promise<Response> {
  const { accountId, apiToken } = getCloudflareAiConfig();
  const body: Record<string, unknown> = { messages, stream };
  if (max_tokens !== undefined) body.max_tokens = max_tokens;
  if (temperature !== undefined) body.temperature = temperature;

  return fetch(buildCloudflareAiUrl(accountId, model), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

export async function generateCloudflareText({
  messages,
  model,
  max_tokens,
  temperature,
}: Omit<CloudflareAiOptions, "stream">): Promise<string> {
  const res = await callCloudflareAi({ messages, model, max_tokens, temperature, stream: false });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Cloudflare AI error ${res.status}: ${text.slice(0, 500)}`);
  }
  const data = await res.json();
  const raw = data?.result?.response;
  if (typeof raw === "string") return raw;
  if (raw !== undefined && raw !== null) return JSON.stringify(raw);
  return "";
}

// Transforms a Cloudflare Workers AI text-generation SSE stream into an
// OpenAI-compatible SSE stream so existing frontend parsers keep working.
export function transformCloudflareStreamToOpenAi(cloudflareResponse: Response): ReadableStream<Uint8Array> {
  const reader = cloudflareResponse.body?.getReader();
  if (!reader) {
    throw new Error("Cloudflare AI stream has no body");
  }
  const encoder = new TextEncoder();
  let buffer = "";

  return new ReadableStream({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            controller.close();
            return;
          }
          buffer += new TextDecoder().decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data: ")) continue;
            const payload = trimmed.slice(6).trim();
            if (!payload) continue;
            if (payload === "[DONE]") {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              continue;
            }
            try {
              const parsed = JSON.parse(payload);
              const chunk = typeof parsed.response === "string" ? parsed.response : "";
              const openAiChunk = {
                id: "cf-chunk",
                object: "chat.completion.chunk",
                created: Math.floor(Date.now() / 1000),
                model: parsed.model ?? "cf-model",
                choices: [
                  { index: 0, delta: { content: chunk }, finish_reason: parsed.p === 1 ? "stop" : null },
                ],
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(openAiChunk)}\n\n`));
            } catch {
              // Ignore malformed SSE lines.
            }
          }
        }
      } catch (err) {
        controller.error(err);
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
}

// Default image generation model. Cloudflare Workers AI returns raw PNG bytes.
export const DEFAULT_CLOUDFLARE_IMAGE_MODEL = "@cf/bytedance/stable-diffusion-xl-lightning";

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000; // 32KB chunks to avoid stack overflow
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export async function generateCloudflareImage({
  prompt,
  model = DEFAULT_CLOUDFLARE_IMAGE_MODEL,
}: {
  prompt: string;
  model?: string;
}): Promise<{ bytes: Uint8Array; base64: string }> {
  const { accountId, apiToken } = getCloudflareAiConfig();
  const res = await fetch(buildCloudflareAiUrl(accountId, model), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Cloudflare AI image error ${res.status}: ${text.slice(0, 500)}`);
  }
  const buffer = await res.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  return { bytes, base64: arrayBufferToBase64(buffer) };
}

// Convenience error mapper for edge functions.
export function cloudflareAiErrorResponse(status: number, message: string, corsHeaders: Record<string, string>): Response {
  if (status === 429) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (status === 402) {
    return new Response(JSON.stringify({ error: "AI usage limit reached." }), {
      status: 402,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return new Response(JSON.stringify({ error: "AI service unavailable. Please try again shortly." }), {
    status: 502,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
