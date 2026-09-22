import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cancelPaypalAndRetainAccount } from "../_shared/account-cleanup.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    let reason = "User requested cancellation";
    try {
      const body = await req.json();
      if (typeof body?.reason === "string" && body.reason.length <= 127) reason = body.reason;
    } catch (_) { /* no body */ }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    try {
       const result = await cancelPaypalAndRetainAccount(admin, user.id, reason);
      if (!result.paypalConfirmed) return json({ error: result.message }, 502);
      return json({
        success: result.paypalConfirmed,
        paypalCancelled: result.paypalConfirmed,
        accountRetained: result.accountRetained,
        cancellationCount: result.cancellationCount,
        limitedAccess: result.limitedAccess,
        message: result.message,
      });
    } catch (e) {
      console.error("Cancellation cleanup failed", { userId: "[REDACTED]" });
      return json({ error: (e as Error).message || "Cancellation failed" }, 502);
    }

  } catch (e) {
    console.error("cancel-subscription error:", (e as Error).message);
    return json({ error: "Internal server error" }, 500);
  }
});
