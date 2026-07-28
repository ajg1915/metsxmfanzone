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

async function getPayPalAccessToken(api: string, id: string, secret: string) {
  const res = await fetch(`${api}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${id}:${secret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error("PayPal authentication failed");
  const data = await res.json();
  return data.access_token as string;
}

// Cancels one PayPal billing subscription. Returns true when PayPal is
// confirmed to no longer bill it (cancelled, already cancelled, or gone).
async function cancelPayPalSubscription(
  api: string,
  token: string,
  subscriptionId: string,
  reason: string,
): Promise<boolean> {
  const getRes = await fetch(`${api}/v1/billing/subscriptions/${subscriptionId}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });

  if (getRes.status === 404) return true; // not a real PayPal subscription anymore

  if (!getRes.ok) {
    console.error("PayPal lookup failed", getRes.status);
    return false;
  }

  const sub = await getRes.json();
  const status = String(sub.status || "").toUpperCase();

  // Already terminal — nothing can bill anymore.
  if (["CANCELLED", "EXPIRED"].includes(status)) return true;

  const cancelRes = await fetch(
    `${api}/v1/billing/subscriptions/${subscriptionId}/cancel`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    },
  );

  if (cancelRes.status === 204 || cancelRes.ok) return true;

  const txt = await cancelRes.text();
  // 422 UNPROCESSABLE with already-cancelled state counts as success
  if (cancelRes.status === 422 && /CANCELL?ED|EXPIRED|INVALID_STATUS/i.test(txt)) return true;

  console.error("PayPal cancel failed", cancelRes.status, txt.slice(0, 200));
  return false;
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

    let reason = "User requested cancellation";
    try {
      const body = await req.json();
      if (typeof body?.reason === "string" && body.reason.length <= 127) reason = body.reason;
    } catch (_) { /* no body */ }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Every subscription row that could still bill this user — not just the newest one.
    const { data: subs, error: subErr } = await admin
      .from("subscriptions")
      .select("id, paypal_subscription_id, status, end_date")
      .eq("user_id", user.id)
      .in("status", ["active", "pending", "suspended", "past_due"]);

    if (subErr) return json({ error: subErr.message }, 500);
    if (!subs || subs.length === 0) return json({ error: "No active subscription found" }, 404);

    const PAYPAL_CLIENT_ID = Deno.env.get("PAYPAL_CLIENT_ID")!;
    const PAYPAL_SECRET = Deno.env.get("PAYPAL_SECRET")!;
    const PAYPAL_API = Deno.env.get("PAYPAL_BASE_URL") || "https://api-m.paypal.com";

    const failures: string[] = [];
    const paypalIds = subs
      .map((s) => s.paypal_subscription_id)
      .filter((id): id is string => Boolean(id));

    if (paypalIds.length > 0) {
      let token: string;
      try {
        token = await getPayPalAccessToken(PAYPAL_API, PAYPAL_CLIENT_ID, PAYPAL_SECRET);
      } catch (e) {
        console.error("PayPal auth error:", (e as Error).message);
        return json(
          { error: "Could not reach PayPal to cancel billing. Please try again shortly." },
          502,
        );
      }

      for (const id of paypalIds) {
        const ok = await cancelPayPalSubscription(PAYPAL_API, token, id, reason);
        if (!ok) failures.push("[REDACTED]");
      }
    }

    // Never mark the account cancelled locally while PayPal can still charge it.
    if (failures.length > 0) {
      return json(
        {
          error:
            "PayPal did not confirm the cancellation, so nothing was changed. Please try again or contact support.",
        },
        502,
      );
    }

    const nowIso = new Date().toISOString();
    const { error: updErr } = await admin
      .from("subscriptions")
      .update({
        status: "cancelled",
        cancellation_status: "cancelled",
        cancellation_requested_at: nowIso,
        end_date: nowIso,
        updated_at: nowIso,
      })
      .in("id", subs.map((s) => s.id));

    if (updErr) return json({ error: updErr.message }, 500);

    for (const s of subs) {
      await admin.from("subscription_activity").insert({
        subscription_id: s.id,
        user_id: user.id,
        action: "cancelled_by_user",
        details: { reason, account_deleted: true },
        performed_by: user.id,
      });
    }

    // Full removal from the database, as required when a member cancels.
    const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
    if (delErr) {
      console.error("Account deletion failed:", delErr.message);
      return json({
        success: true,
        accountDeleted: false,
        message:
          "Your PayPal billing was cancelled, but we could not remove your account automatically. Please contact support.",
      });
    }

    return json({ success: true, accountDeleted: true });
  } catch (e) {
    console.error("cancel-subscription error:", (e as Error).message);
    return json({ error: "Internal server error" }, 500);
  }
});
