import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";
import { callCloudflareAi, transformCloudflareStreamToOpenAi, cloudflareAiErrorResponse } from "../_shared/cloudflareAi.ts";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1).max(4000),
});
const BodySchema = z.object({
  messages: z.array(MessageSchema).min(1).max(20),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

const DAILY_MESSAGE_LIMIT = 10;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const adminClient = createClient(supabaseUrl, serviceKey);

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid or expired session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limit: 10 messages per user per day
    const today = new Date().toISOString().split("T")[0];
    const { count, error: countError } = await adminClient
      .from("chat_usage")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", `${today}T00:00:00Z`);

    if (!countError && (count ?? 0) >= DAILY_MESSAGE_LIMIT) {
      return new Response(JSON.stringify({ error: `You've reached your daily limit of ${DAILY_MESSAGE_LIMIT} messages. Try again tomorrow!` }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log this message
    await adminClient.from("chat_usage").insert({ user_id: user.id });

    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Invalid request body", details: parsed.error.flatten().fieldErrors }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { messages } = parsed.data;

    const response = await callCloudflareAi({
      messages: [
        {
          role: "system",
          content: `You are a friendly and helpful AI assistant for MetsXMFanZone, a fan community for New York Mets baseball fans.

Your role is to:
- Help users navigate the website and its features
- Answer questions about the Mets, baseball, and the fan community
- Provide support for account issues, subscriptions, and general inquiries
- Be enthusiastic about the Mets and engage positively with fans
- Keep responses concise and helpful

If you don't know something specific about the website, politely suggest the user contact support or check the help center.`
        },
        ...messages,
      ],
      stream: true,
      temperature: 0.7,
    });

    if (!response.ok) {
      return cloudflareAiErrorResponse(response.status, "AI service error", corsHeaders);
    }

    return new Response(transformCloudflareStreamToOpenAi(response), {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Community chat error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
