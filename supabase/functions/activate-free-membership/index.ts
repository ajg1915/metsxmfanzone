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

    const existingFree = active?.find((item) => item.plan_type === "free");
    if (!existingFree) {
      const { error: insertError } = await service.from("subscriptions").insert({
        user_id: user.id,
        plan_type: "free",
        status: "active",
        amount: 0,
        currency: "USD",
        start_date: new Date().toISOString(),
        end_date: null,
      });
      if (insertError) throw insertError;
    }

    await service.from("activity_logs").insert({
      user_id: user.id,
      action: "free_membership_activated",
      log_type: "subscription",
      resource_type: "membership",
      details: { plan_type: "free", source: "member_selection" },
    });

    return json({ success: true, planType: "free" });
  } catch (error) {
    console.error("Free membership activation failed", error);
    return json({ error: "Membership could not be activated" }, 500);
  }
});