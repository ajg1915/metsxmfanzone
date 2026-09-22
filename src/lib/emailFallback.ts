import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";

export interface EmailFallbackPayload {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

/** Last-resort sender: the Vercel serverless route that talks to Resend directly. */
export async function sendEmailViaVercel(payload: EmailFallbackPayload) {
  const response = await fetch("/api/send-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  let data: { success?: boolean; error?: string; id?: string } = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok || data.success === false) {
    throw new Error(data.error || `Backup email service failed (${response.status})`);
  }
  return data;
}

async function readInvokeError(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    const text = await error.context.text().catch(() => "");
    try {
      return (JSON.parse(text) as { error?: string })?.error || text || "The email could not be sent.";
    } catch {
      return text || "The email could not be sent.";
    }
  }
  return error instanceof Error ? error.message : "The email could not be sent.";
}

/**
 * Invoke an email edge function. If it fails for any reason (network, 500, timeout),
 * fall back to /api/send-email on Vercel with the same email data.
 */
export async function invokeEmailFunction<T = unknown>(
  functionName: string,
  body: Record<string, unknown>,
  fallback?: EmailFallbackPayload,
  timeoutMs = 30000,
): Promise<T> {
  try {
    const timeout = new Promise<never>((_, reject) => {
      window.setTimeout(() => reject(new Error("The email service timed out. Please try again.")), timeoutMs);
    });
    const result = await Promise.race([supabase.functions.invoke(functionName, { body }), timeout]);
    if (result.error) throw new Error(await readInvokeError(result.error));
    return result.data as T;
  } catch (edgeError) {
    if (!fallback) throw edgeError;
    console.warn(`Email function "${functionName}" failed, using Vercel fallback.`, edgeError);
    try {
      return (await sendEmailViaVercel(fallback)) as T;
    } catch (fallbackError) {
      const first = edgeError instanceof Error ? edgeError.message : String(edgeError);
      const second = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
      throw new Error(`${first} Backup sender also failed: ${second}`);
    }
  }
}
