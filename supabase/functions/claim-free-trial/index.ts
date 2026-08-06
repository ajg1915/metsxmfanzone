import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

const SETTING_KEY = "free_trial_config";

type TrialWindow = {
  id: string;
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  audience: "new" | "all";
  grantPlan: "trial" | "premium" | "annual";
  grantDays: number;
  active: boolean;
};

type TrialConfig = {
  enabled: boolean;
  trialDays: number;
  streamPreviewMinutes: number;
  windows: TrialWindow[];
};

const DEFAULTS: TrialConfig = {
  enabled: true,
  trialDays: 2,
  streamPreviewMinutes: 30,
  windows: [],
};

function todayET(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

function pickWindow(config: TrialConfig, isNewUser: boolean): TrialWindow | null {
  const today = todayET();
  const active = (config.windows || []).filter(
    (w) =>
      w &&
      w.active !== false &&
      typeof w.startDate === "string" &&
      typeof w.endDate === "string" &&
      w.startDate <= today &&
      today <= w.endDate &&
      (w.audience === "all" || isNewUser),
  );
  if (active.length === 0) return null;
  // Prefer the most generous offer
  const rank = (p: string) => (p === "annual" ? 3 : p === "premium" ? 2 : 1);
  return active.sort((a, b) => rank(b.grantPlan) - rank(a.grantPlan) || b.grantDays - a.grantDays)[0];
}

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

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: settingRow } = await admin
      .from("site_settings")
      .select("setting_value")
      .eq("setting_key", SETTING_KEY)
      .maybeSingle();

    const config: TrialConfig = { ...DEFAULTS, ...((settingRow?.setting_value as TrialConfig) || {}) };

    const { data: existing } = await admin
      .from("subscriptions")
      .select("id, plan_type, status, end_date")
      .eq("user_id", user.id);

    const rows = existing || [];
    const hasPaid = rows.some(
      (r) =>
        r.status === "active" &&
        ["weekly", "premium", "annual"].includes(r.plan_type) &&
        (!r.end_date || new Date(r.end_date) > new Date()),
    );
    if (hasPaid) return json({ error: "You already have an active membership." }, 400);

    const alreadyClaimed = rows.some((r) => r.plan_type === "trial" || r.notes === "free_promo");
    if (alreadyClaimed) {
      return json({ error: "You have already used your free access offer." }, 400);
    }

    const isNewUser = rows.length === 0;
    const promo = pickWindow(config, isNewUser);

    if (!promo && !config.enabled) {
      return json({ error: "Free access is not available right now." }, 400);
    }

    const planType = promo ? promo.grantPlan : "trial";
    const days = Math.max(1, Math.min(365, promo ? Number(promo.grantDays) || 1 : Number(config.trialDays) || 2));
    const start = new Date();
    const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);

    const { error: insertError } = await admin.from("subscriptions").insert({
      user_id: user.id,
      plan_type: planType,
      status: "active",
      amount: 0,
      currency: "USD",
      payment_method: "free_trial",
      start_date: start.toISOString(),
      end_date: end.toISOString(),
      notes: promo ? "free_promo" : "free_trial",
    });

    if (insertError) {
      console.error("claim-free-trial insert failed:", insertError.message);
      return json({ error: "Could not start your free access. Please try again." }, 500);
    }

    return json({
      success: true,
      planType,
      days,
      endsAt: end.toISOString(),
      promoName: promo?.name ?? null,
    });
  } catch (e) {
    console.error("claim-free-trial error:", (e as Error).message);
    return json({ error: "Internal server error" }, 500);
  }
});
