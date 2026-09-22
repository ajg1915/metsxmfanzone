import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization) return json({ error: "Unauthorized" }, 401);

    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anonKey || !serviceKey) return json({ error: "Service unavailable" }, 503);

    const caller = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error: authError } = await caller.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const service = createClient(url, serviceKey);
    const { data: active, error: lookupError } = await service.from("subscriptions")
      .select("id,plan_type,status")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false });
    if (lookupError) throw lookupError;

    const paid = active?.find((item) => ["weekly", "premium", "annual"].includes(item.plan_type));
    if (paid) return json({ success: true, planType: paid.plan_type, alreadyPaid: true });

    // Free membership requires a linked PayPal account (no charge).
    // This function only confirms an already-linked free membership.
    const { data: linkedFree, error: linkedError } = await service.from("subscriptions")
      .select("id,paypal_subscription_id,status")
      .eq("user_id", user.id)
      .eq("plan_type", "free")
      .eq("status", "active")
      .not("paypal_subscription_id", "is", null)
      .maybeSingle();
    if (linkedError) throw linkedError;

    if (!linkedFree) {
      return json({ error: "PayPal link required", requiresPaypalLink: true }, 400);
    }

    return json({ success: true, planType: "free" });
  } catch (error) {
    console.error("Free membership activation failed", error);
    return json({ error: "Membership could not be activated" }, 500);
  }
});