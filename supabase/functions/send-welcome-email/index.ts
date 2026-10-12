import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// A welcome email for a new signup may only go to that new account's own address.
const NEW_ACCOUNT_WINDOW_MS = 10 * 60 * 1000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const isServer = !!supabaseKey && req.headers.get("Authorization") === `Bearer ${supabaseKey}`;

    let email: string | null = null;
    let name = "Mets Fan";

    if (isServer && body?.email) {
      // Trusted server-to-server call (service role key).
      email = String(body.email).trim().toLowerCase();
      name = String(body.name ?? "").trim() || name;
    } else {
      // Public path (database trigger): ignore any email in the body. Look the
      // account up by id and only email a brand-new account at its own address.
      const id = body?.record?.id;
      if (!id || typeof id !== "string") return json({ error: "Unauthorized" }, 401);
      const { data } = await supabase.auth.admin.getUserById(id);
      const user = data?.user;
      const createdAt = user?.created_at ? Date.parse(user.created_at) : 0;
      if (!user?.email || !createdAt || Date.now() - createdAt > NEW_ACCOUNT_WINDOW_MS) {
        return json({ error: "Unauthorized" }, 401);
      }
      email = user.email.trim().toLowerCase();
      name = String(user.user_metadata?.full_name ?? body?.record?.full_name ?? "").trim() || name;
    }

    if (!email) return json({ error: "Email is required" }, 400);

    const { error } = await supabase.functions.invoke("send-confirmation-email", {
      body: { type: "welcome", email, name },
    });
    if (error) throw error;

    return json({ success: true });
  } catch (error: unknown) {
    console.error("Error in send-welcome-email:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error occurred" }, 500);
  }
});
