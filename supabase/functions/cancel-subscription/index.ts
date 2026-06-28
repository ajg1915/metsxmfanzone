import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function getPayPalAccessToken(api: string, id: string, secret: string) {
  const res = await fetch(`${api}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${id}:${secret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const data = await res.json();
  return data.access_token as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let reason = "User requested cancellation";
    try {
      const body = await req.json();
      if (typeof body?.reason === "string" && body.reason.length <= 500) reason = body.reason;
    } catch (_) { /* no body */ }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: sub, error: subErr } = await admin
      .from("subscriptions")
      .select("id, paypal_subscription_id, status, end_date")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subErr || !sub) {
      return new Response(JSON.stringify({ error: "No active subscription found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Try to cancel at PayPal if we have the id
    if (sub.paypal_subscription_id) {
      try {
        const PAYPAL_CLIENT_ID = Deno.env.get("PAYPAL_CLIENT_ID")!;
        const PAYPAL_SECRET = Deno.env.get("PAYPAL_SECRET")!;
        const PAYPAL_API = Deno.env.get("PAYPAL_BASE_URL") || "https://api-m.paypal.com";
        const token = await getPayPalAccessToken(PAYPAL_API, PAYPAL_CLIENT_ID, PAYPAL_SECRET);
        const ppRes = await fetch(
          `${PAYPAL_API}/v1/billing/subscriptions/${sub.paypal_subscription_id}/cancel`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ reason }),
          },
        );
        if (!ppRes.ok && ppRes.status !== 404) {
          const txt = await ppRes.text();
          console.error("PayPal cancel failed", ppRes.status, txt.slice(0, 200));
        }
      } catch (e) {
        console.error("PayPal cancel error:", (e as Error).message);
      }
    }

    const { error: updErr } = await admin
      .from("subscriptions")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", sub.id);

    if (updErr) {
      return new Response(JSON.stringify({ error: updErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ success: true, end_date: sub.end_date }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("cancel-subscription error:", (e as Error).message);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
