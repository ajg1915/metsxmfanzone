// stripe-billing — Cloudflare Worker for MetsXMFanZone
// Stripe card checkout for memberships, sitting next to PayPal (PayPal stays the main processor).
// Stripe's own card screen opens inside the site (Embedded Checkout); this Worker creates it,
// listens to Stripe's webhooks, and turns the member's access on and off in the same
// `subscriptions` table PayPal uses (payment_method = "stripe"). Stripe-only bookkeeping
// (customer and subscription links, handled webhook events) lives in your R2 bucket, not Supabase.
//
// Paste this whole file into: Cloudflare dashboard → Workers & Pages → Create → Worker →
// name it "stripe-billing" → Deploy → Edit code → replace everything → Deploy.
//
// Then (Workers → stripe-billing → Settings):
//   Bindings → Add → R2 bucket
//       Variable name   BILLING
//       R2 bucket       metsxmfanzone-assets
//   Variables and Secrets → Add
//       STRIPE_SECRET_KEY           (secret)  sk_test_... while testing, sk_live_... once Stripe approves
//       STRIPE_WEBHOOK_SECRET       (secret)  whsec_... from the webhook endpoint you add in Stripe
//       SUPABASE_SERVICE_ROLE_KEY   (secret)  so the webhook can turn memberships on and off
//       SITE_URL                    (text, optional)  default https://www.metsxmfanzone.com
//       PRICE_WEEKLY / PRICE_MONTHLY / PRICE_YEARLY  (text, optional)  override the price IDs below
//
// Stripe Dashboard → Developers → Webhooks → Add endpoint:
//   URL     https://stripe-billing.metsxmfan.workers.dev/webhook
//   Events  checkout.session.completed, invoice.paid, invoice.payment_failed,
//           customer.subscription.updated, customer.subscription.deleted
//
//   POST /checkout          member: { plan: "weekly" | "premium" | "annual" } → { clientSecret }
//   GET  /session?id=cs_... member: { status, active }  (after the card screen finishes)
//   POST /portal            member: { returnUrl? } → { url }  (Stripe's "Manage billing" page)
//   POST /webhook           Stripe only (signature checked)

const DEFAULT_SUPABASE_URL = "https://rdmrxeplasttewtlfetc.supabase.co";
// Publishable (public) key of the MetsXMFanZone-app project; override with SUPABASE_ANON_KEY if it ever rotates.
const DEFAULT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkbXJ4ZXBsYXN0dGV3dGxmZXRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NTIyNjAsImV4cCI6MjA3NzMyODI2MH0.P5msjdR8tgbx-rL2ifeSjqW1jvFzKtPNT4oapJIAkJA";

// Sandbox (test mode) prices. Live prices get their own IDs: set PRICE_* when you switch to live.
const TEST_PRICES = {
  weekly: "price_1UeFnoBuIjQS2e3nICfOxaUi",
  premium: "price_1UeFnpBuIjQS2e3nbhhRNxkX",
  annual: "price_1UeFnpBuIjQS2e3nNsAmXZkD",
};
const PLAN_AMOUNT = { weekly: 3.99, premium: 9.99, annual: 119.88 };
const PAID_PLANS = ["weekly", "premium", "annual"];

const ALLOWED_ORIGINS = [
  "https://www.metsxmfanzone.com",
  "https://metsxmfanzone.com",
  "capacitor://localhost",
  "https://localhost",
  "http://localhost:8080",
  "http://localhost:5173",
];

function cors(request) {
  const origin = request.headers.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, authorization",
    Vary: "Origin",
  };
}
const json = (request, data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors(request), "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

// ---------- Stripe REST helpers (no SDK needed in a Worker) ----------

// Turns { a: { b: 1 }, c: [ { d: 2 } ] } into a=…&a[b]=1&c[0][d]=2 the way Stripe expects.
export function formEncode(obj, prefix = "", out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((item, i) => (typeof item === "object" ? formEncode(item, `${key}[${i}]`, out) : out.append(`${key}[${i}]`, String(item))));
    else if (typeof v === "object") formEncode(v, key, out);
    else out.append(key, String(v));
  }
  return out;
}

async function stripe(env, method, path, params, idempotencyKey) {
  const headers = { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` };
  let url = `https://api.stripe.com/v1${path}`;
  let body;
  if (method === "GET") {
    if (params) url += "?" + formEncode(params).toString();
  } else {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
    body = params ? formEncode(params).toString() : undefined;
  }
  const r = await fetch(url, { method, headers, body });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(data?.error?.message || `Stripe error ${r.status}`);
    err.status = r.status;
    throw err;
  }
  return data;
}

// Stripe-Signature: t=…,v1=… → HMAC-SHA256 of `${t}.${body}` with the endpoint secret.
export async function verifyStripeSignature(payload, header, secret, toleranceSec = 300, nowSec = Math.floor(Date.now() / 1000)) {
  if (!header || !secret) return false;
  const parts = {};
  const sigs = [];
  for (const piece of header.split(",")) {
    const [k, v] = piece.split("=");
    if (k === "t") parts.t = v;
    if (k === "v1") sigs.push(v);
  }
  const t = Number(parts.t);
  if (!t || !sigs.length || Math.abs(nowSec - t) > toleranceSec) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${parts.t}.${payload}`));
  const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return sigs.some((s) => s.length === expected.length && timingSafeEqual(s, expected));
}
function timingSafeEqual(a, b) {
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ---------- Supabase helpers ----------

const sbBase = (env) => String(env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/+$/, "");
const sbAnon = (env) => env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

async function whoAmI(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return null;
  try {
    const r = await fetch(`${sbBase(env)}/auth/v1/user`, { headers: { apikey: sbAnon(env), Authorization: `Bearer ${token}` } });
    if (!r.ok) return null;
    const u = await r.json();
    return u?.id ? { id: u.id, email: u.email || "", token } : null;
  } catch {
    return null;
  }
}

// Service-role calls (webhook only). Never exposed to the browser.
async function sbAdmin(env, method, path, body) {
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const r = await fetch(`${sbBase(env)}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`Supabase ${method} ${path.split("?")[0]} failed: ${r.status} ${await r.text()}`);
  return r.status === 204 ? [] : r.json();
}

// Does this member already have a paid membership that is still running (PayPal or Stripe)?
async function hasRunningPaidPlan(env, me) {
  const url = `${sbBase(env)}/rest/v1/subscriptions?select=plan_type,status,end_date&user_id=eq.${encodeURIComponent(me.id)}&plan_type=in.(${PAID_PLANS.join(",")})&status=in.(active,cancelled)`;
  const r = await fetch(url, { headers: { apikey: sbAnon(env), Authorization: `Bearer ${me.token}` } });
  if (!r.ok) return false;
  const rows = await r.json();
  const now = Date.now();
  return (rows || []).some((row) => row.status === "active" || (row.end_date && new Date(row.end_date).getTime() > now));
}

// ---------- R2 bookkeeping ----------

const K = {
  customer: (userId) => `billing/stripe/customers/${userId}.json`,
  sub: (subId) => `billing/stripe/subscriptions/${subId}.json`,
  event: (evtId) => `billing/stripe/events/${evtId}`,
};
async function r2get(env, key) {
  const o = await env.BILLING.get(key);
  return o ? o.json() : null;
}
const r2put = (env, key, val) => env.BILLING.put(key, JSON.stringify(val), { httpMetadata: { contentType: "application/json" } });

// ---------- member routes ----------

function priceFor(env, plan) {
  const override = { weekly: env.PRICE_WEEKLY, premium: env.PRICE_MONTHLY, annual: env.PRICE_YEARLY }[plan];
  return override || TEST_PRICES[plan];
}

async function getOrCreateCustomer(env, me) {
  const saved = await r2get(env, K.customer(me.id));
  if (saved?.customer) return saved.customer;
  const c = await stripe(env, "POST", "/customers", { email: me.email || undefined, metadata: { user_id: me.id } }, `cus-${me.id}`);
  await r2put(env, K.customer(me.id), { customer: c.id, email: me.email, created_at: new Date().toISOString() });
  return c.id;
}

async function createCheckout(request, env, me) {
  const b = await request.json().catch(() => ({}));
  const plan = String(b.plan || "");
  if (!PAID_PLANS.includes(plan)) return json(request, { error: "Pick the Weekly, Monthly or Yearly plan." }, 400);
  if (await hasRunningPaidPlan(env, me))
    return json(request, { error: "already_subscribed", message: "You already have an active membership. Manage it from your Member Center." }, 409);

  const customer = await getOrCreateCustomer(env, me);
  const session = await stripe(env, "POST", "/checkout/sessions", {
    ui_mode: "embedded_page",
    mode: "subscription",
    redirect_on_completion: "never",
    customer,
    client_reference_id: me.id,
    line_items: [{ price: priceFor(env, plan), quantity: 1 }],
    metadata: { user_id: me.id, plan_id: plan },
    subscription_data: { metadata: { user_id: me.id, plan_id: plan } },
    automatic_tax: { enabled: env.STRIPE_TAX === "on" ? "true" : "false" },
    customer_update: env.STRIPE_TAX === "on" ? { address: "auto" } : undefined,
  });
  return json(request, { clientSecret: session.client_secret, sessionId: session.id });
}

async function sessionStatus(request, env, me) {
  const id = new URL(request.url).searchParams.get("id") || "";
  if (!/^cs_[A-Za-z0-9_]+$/.test(id)) return json(request, { error: "Bad session id" }, 400);
  const s = await stripe(env, "GET", `/checkout/sessions/${id}`);
  if (s.client_reference_id !== me.id) return json(request, { error: "Not your session" }, 403);
  return json(request, { status: s.status, paymentStatus: s.payment_status, active: await hasRunningPaidPlan(env, me) });
}

async function portal(request, env, me) {
  const saved = await r2get(env, K.customer(me.id));
  if (!saved?.customer) return json(request, { error: "No card billing found for your account." }, 404);
  const b = await request.json().catch(() => ({}));
  const site = String(env.SITE_URL || ALLOWED_ORIGINS[0]).replace(/\/+$/, "");
  const returnUrl = typeof b.returnUrl === "string" && b.returnUrl.startsWith(site) ? b.returnUrl : `${site}/dashboard`;
  const p = await stripe(env, "POST", "/billing_portal/sessions", { customer: saved.customer, return_url: returnUrl });
  return json(request, { url: p.url });
}

// ---------- webhook → subscriptions table ----------

// Newer Stripe API versions keep the billing period on the subscription item.
export function periodOf(sub) {
  const item = sub?.items?.data?.[0] || {};
  const start = sub.current_period_start ?? item.current_period_start;
  const end = sub.current_period_end ?? item.current_period_end;
  return {
    start: start ? new Date(start * 1000).toISOString() : null,
    end: end ? new Date(end * 1000).toISOString() : null,
  };
}

// Stripe status → the site's status. past_due keeps access while Stripe retries the card.
export function siteStatus(sub) {
  if (["active", "trialing", "past_due"].includes(sub.status)) return sub.cancel_at_period_end ? "cancelled" : "active";
  if (sub.status === "paused") return "suspended";
  return "expired"; // canceled, unpaid, incomplete_expired
}

function planOf(sub, fallback) {
  const fromMeta = sub?.metadata?.plan_id;
  if (PAID_PLANS.includes(fromMeta)) return fromMeta;
  const interval = sub?.items?.data?.[0]?.price?.recurring?.interval;
  return { week: "weekly", month: "premium", year: "annual" }[interval] || fallback || "premium";
}

async function upsertFromSubscription(env, sub, { userId, payment } = {}) {
  const link = await r2get(env, K.sub(sub.id));
  const uid = userId || link?.user_id || sub?.metadata?.user_id;
  if (!uid) throw new Error(`No member found for ${sub.id}`);
  const plan = planOf(sub, link?.plan_type);
  const { start, end } = periodOf(sub);
  const status = siteStatus(sub);
  const nowIso = new Date().toISOString();
  const amount = (sub?.items?.data?.[0]?.price?.unit_amount ?? Math.round(PLAN_AMOUNT[plan] * 100)) / 100;

  const fields = {
    plan_type: plan,
    status,
    payment_method: "stripe",
    amount,
    currency: String(sub.currency || "usd").toUpperCase(),
    end_date: status === "expired" ? (sub.ended_at ? new Date(sub.ended_at * 1000).toISOString() : nowIso) : end,
    next_payment_date: status === "active" ? end : null,
    next_payment_amount: status === "active" ? amount : null,
    cancellation_status: status === "cancelled" || status === "expired" ? "cancelled" : null,
    cancelled_at: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
    updated_at: nowIso,
  };
  if (payment) {
    fields.last_payment_date = nowIso;
    fields.last_payment_amount = payment.amount;
  }

  let rowId = link?.row_id;
  if (rowId) {
    if (payment) {
      const rows = await sbAdmin(env, "GET", `subscriptions?select=total_payments_received&id=eq.${rowId}`);
      fields.total_payments_received = (rows?.[0]?.total_payments_received || 0) + 1;
    }
    const updated = await sbAdmin(env, "PATCH", `subscriptions?id=eq.${rowId}`, fields);
    if (!updated.length) rowId = null; // row was deleted by an admin: recreate it below
  }
  if (!rowId) {
    const [row] = await sbAdmin(env, "POST", "subscriptions", {
      user_id: uid,
      start_date: start || nowIso,
      total_payments_received: payment ? 1 : 0,
      notes: `Stripe subscription ${sub.id}`,
      ...fields,
    });
    rowId = row.id;
  }
  await r2put(env, K.sub(sub.id), { row_id: rowId, user_id: uid, plan_type: plan, customer: sub.customer, updated_at: nowIso });
  return rowId;
}

async function handleEvent(env, event) {
  const obj = event.data?.object || {};
  switch (event.type) {
    case "checkout.session.completed": {
      if (obj.mode !== "subscription" || !obj.subscription) return "ignored";
      const sub = await stripe(env, "GET", `/subscriptions/${obj.subscription}`);
      const paid = obj.payment_status === "paid" ? { amount: (obj.amount_total || 0) / 100 } : undefined;
      await upsertFromSubscription(env, sub, { userId: obj.client_reference_id || obj.metadata?.user_id, payment: paid });
      return "activated";
    }
    case "invoice.paid": {
      const subId = obj.subscription || obj.parent?.subscription_details?.subscription;
      if (!subId) return "ignored";
      // The first invoice is already counted by checkout.session.completed.
      if (obj.billing_reason === "subscription_create") return "ignored";
      const sub = await stripe(env, "GET", `/subscriptions/${subId}`);
      await upsertFromSubscription(env, sub, { payment: { amount: (obj.amount_paid || 0) / 100 } });
      return "renewed";
    }
    case "invoice.payment_failed":
      // Stripe Smart Retries + its "update your card" emails handle recovery; access stays on while it retries.
      // If every retry fails, Stripe cancels the subscription and customer.subscription.deleted turns access off.
      return "noted";
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const link = await r2get(env, K.sub(obj.id));
      if (!link && !obj.metadata?.user_id) return "ignored"; // not created through the site
      await upsertFromSubscription(env, obj);
      return event.type.endsWith("deleted") ? "ended" : "updated";
    }
    default:
      return "ignored";
  }
}

async function webhook(request, env) {
  const payload = await request.text();
  const ok = await verifyStripeSignature(payload, request.headers.get("Stripe-Signature"), env.STRIPE_WEBHOOK_SECRET);
  if (!ok) return new Response("Bad signature", { status: 400 });
  const event = JSON.parse(payload);
  if (await env.BILLING.head(K.event(event.id))) return new Response("Already handled", { status: 200 });
  try {
    const result = await handleEvent(env, event);
    await env.BILLING.put(K.event(event.id), result, { customMetadata: { type: event.type } });
    return new Response(result, { status: 200 });
  } catch (e) {
    console.error("webhook failed", event.type, event.id, e?.message);
    return new Response("Retry later", { status: 500 }); // Stripe retries for up to 3 days
  }
}

export { handleEvent, upsertFromSubscription };

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: cors(request) });
    const path = new URL(request.url).pathname.replace(/\/+$/, "") || "/";
    try {
      if (path === "/") return json(request, { ok: true, service: "stripe-billing" });
      if (!env.BILLING) return json(request, { error: "Worker is missing its R2 binding named BILLING" }, 500);
      if (!env.STRIPE_SECRET_KEY) return json(request, { error: "Worker is missing STRIPE_SECRET_KEY" }, 500);
      if (path === "/webhook" && request.method === "POST") return await webhook(request, env);

      const me = await whoAmI(request, env);
      if (!me) return json(request, { error: "Please sign in" }, 401);
      if (path === "/checkout" && request.method === "POST") return await createCheckout(request, env, me);
      if (path === "/session" && request.method === "GET") return await sessionStatus(request, env, me);
      if (path === "/portal" && request.method === "POST") return await portal(request, env, me);
      return json(request, { error: "Not found" }, 404);
    } catch (e) {
      console.error("stripe-billing", path, e?.message);
      return json(request, { error: "Card checkout is unavailable right now. Please use PayPal or try again." }, 500);
    }
  },
};
