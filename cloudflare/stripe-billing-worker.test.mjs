// Local test for stripe-billing-worker.js. Run: node --test cloudflare/stripe-billing-worker.test.mjs
// Uses stand-ins for R2, Stripe and Supabase, so it checks the Worker's own rules:
// who may start a checkout, webhook signature checks, and how Stripe events turn access on and off.
import test from "node:test";
import assert from "node:assert/strict";
import worker, { formEncode, verifyStripeSignature, siteStatus, periodOf } from "./stripe-billing-worker.js";

class FakeR2 {
  constructor() {
    this.files = new Map();
  }
  async put(key, value) {
    this.files.set(key, String(value));
  }
  async get(key) {
    if (!this.files.has(key)) return null;
    const text = this.files.get(key);
    return { json: async () => JSON.parse(text), text: async () => text };
  }
  async head(key) {
    return this.files.has(key) ? {} : null;
  }
}

const SECRET = "whsec_test_secret";
const USER = "11111111-1111-1111-1111-111111111111";
const NOW = Math.floor(Date.now() / 1000);

async function sign(payload, secret = SECRET, t = NOW) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${payload}`));
  return `t=${t},v1=${[...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

// ---- fake backends ----
function setup({ existingPaid = false, isAdminUser = false } = {}) {
  const db = []; // subscriptions rows
  const stripeCalls = [];
  const subs = {
    sub_1: {
      id: "sub_1",
      status: "active",
      cancel_at_period_end: false,
      customer: "cus_1",
      currency: "usd",
      metadata: { user_id: USER, plan_id: "premium" },
      items: { data: [{ current_period_start: NOW, current_period_end: NOW + 30 * 86400, price: { unit_amount: 999, recurring: { interval: "month" } } }] },
    },
  };
  globalThis.fetch = async (url, init = {}) => {
    const u = new URL(url);
    const method = init.method || "GET";
    const res = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
    if (u.hostname === "api.stripe.com") {
      stripeCalls.push({ method, path: u.pathname, body: init.body ? new URLSearchParams(init.body) : null });
      if (u.pathname === "/v1/customers") return res({ id: "cus_1" });
      if (u.pathname === "/v1/checkout/sessions") return res({ id: "cs_test_1", client_secret: "cs_test_1_secret" });
      if (u.pathname.startsWith("/v1/subscriptions/")) return res(subs[u.pathname.split("/").pop()]);
      if (u.pathname === "/v1/billing_portal/sessions") return res({ url: "https://billing.stripe.com/p/session/x" });
      return res({ error: { message: "unknown" } }, 404);
    }
    if (u.pathname === "/auth/v1/user") {
      const auth = new Headers(init.headers).get("Authorization");
      return auth === "Bearer good" ? res({ id: USER, email: "fan@example.com" }) : res({}, 401);
    }
    if (u.pathname === "/rest/v1/user_roles") {
      const auth = new Headers(init.headers).get("Authorization");
      return res(isAdminUser && auth === "Bearer good" ? [{ role: "admin" }] : []);
    }
    if (u.pathname === "/rest/v1/subscriptions") {
      const key = new Headers(init.headers).get("apikey");
      if (method === "GET" && key !== "service") return res(existingPaid ? [{ plan_type: "premium", status: "active", end_date: null }] : []);
      if (method === "GET") {
        const id = u.searchParams.get("id")?.replace("eq.", "");
        return res(db.filter((r) => r.id === id));
      }
      if (method === "POST") {
        const row = { id: `row-${db.length + 1}`, ...JSON.parse(init.body) };
        db.push(row);
        return res([row], 201);
      }
      if (method === "PATCH") {
        const id = u.searchParams.get("id")?.replace("eq.", "");
        const row = db.find((r) => r.id === id);
        if (!row) return res([]);
        Object.assign(row, JSON.parse(init.body));
        return res([row]);
      }
    }
    return res({}, 404);
  };
  const env = { BILLING: new FakeR2(), STRIPE_SECRET_KEY: "sk_test_x", STRIPE_WEBHOOK_SECRET: SECRET, SUPABASE_SERVICE_ROLE_KEY: "service" };
  return { env, db, stripeCalls, subs };
}

const req = (path, { method = "GET", token, body, headers = {} } = {}) =>
  new Request(`https://stripe-billing.example${path}`, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), "Content-Type": "application/json", Origin: "https://www.metsxmfanzone.com", ...headers },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });

async function sendEvent(env, event) {
  const payload = JSON.stringify(event);
  return worker.fetch(req("/webhook", { method: "POST", body: payload, headers: { "Stripe-Signature": await sign(payload) } }), env);
}

// ---- tests ----
test("formEncode nests objects and arrays the way Stripe expects", () => {
  const s = formEncode({ mode: "subscription", line_items: [{ price: "p", quantity: 1 }], metadata: { a: "b" }, skip: undefined }).toString();
  assert.equal(decodeURIComponent(s), "mode=subscription&line_items[0][price]=p&line_items[0][quantity]=1&metadata[a]=b");
});

test("signature check accepts good, rejects tampered, wrong secret and stale", async () => {
  const body = '{"id":"evt_1"}';
  assert.equal(await verifyStripeSignature(body, await sign(body), SECRET), true);
  assert.equal(await verifyStripeSignature(body + " ", await sign(body), SECRET), false);
  assert.equal(await verifyStripeSignature(body, await sign(body, "whsec_other"), SECRET), false);
  assert.equal(await verifyStripeSignature(body, await sign(body, SECRET, NOW - 3600), SECRET), false);
  assert.equal(await verifyStripeSignature(body, null, SECRET), false);
});

test("status mapping keeps access while retrying, ends it when cancelled", () => {
  assert.equal(siteStatus({ status: "active" }), "active");
  assert.equal(siteStatus({ status: "past_due" }), "active");
  assert.equal(siteStatus({ status: "active", cancel_at_period_end: true }), "cancelled");
  assert.equal(siteStatus({ status: "canceled" }), "expired");
  assert.equal(siteStatus({ status: "unpaid" }), "expired");
  assert.ok(periodOf({ items: { data: [{ current_period_end: NOW }] } }).end);
});

test("checkout requires sign-in", async () => {
  const { env } = setup();
  const r = await worker.fetch(req("/checkout", { method: "POST", body: { plan: "premium" } }), env);
  assert.equal(r.status, 401);
});

test("checkout rejects unknown plans and existing members", async () => {
  let { env } = setup();
  let r = await worker.fetch(req("/checkout", { method: "POST", token: "good", body: { plan: "free" } }), env);
  assert.equal(r.status, 400);
  ({ env } = setup({ existingPaid: true }));
  r = await worker.fetch(req("/checkout", { method: "POST", token: "good", body: { plan: "premium" } }), env);
  assert.equal(r.status, 409);
  assert.equal((await r.json()).error, "already_subscribed");
});

test("checkout creates an embedded subscription session for the right price", async () => {
  const { env, stripeCalls } = setup();
  const r = await worker.fetch(req("/checkout", { method: "POST", token: "good", body: { plan: "weekly" } }), env);
  assert.equal(r.status, 200);
  assert.equal((await r.json()).clientSecret, "cs_test_1_secret");
  const call = stripeCalls.find((c) => c.path === "/v1/checkout/sessions");
  assert.equal(call.body.get("ui_mode"), "embedded_page");
  assert.equal(call.body.get("branding_settings[button_color]"), "#FF5910");
  assert.equal(call.body.get("mode"), "subscription");
  assert.equal(call.body.get("line_items[0][price]"), "price_1UeFnoBuIjQS2e3nICfOxaUi");
  assert.equal(call.body.get("client_reference_id"), USER);
  assert.equal(call.body.get("subscription_data[metadata][plan_id]"), "weekly");
  // customer is reused the second time
  await worker.fetch(req("/checkout", { method: "POST", token: "good", body: { plan: "weekly" } }), env);
  assert.equal(stripeCalls.filter((c) => c.path === "/v1/customers").length, 1);
});

test("webhook rejects unsigned requests", async () => {
  const { env, db } = setup();
  const r = await worker.fetch(req("/webhook", { method: "POST", body: '{"id":"evt_x","type":"checkout.session.completed"}' }), env);
  assert.equal(r.status, 400);
  assert.equal(db.length, 0);
});

test("full lifecycle: pay → renew → cancel at period end → ended", async () => {
  const { env, db, subs } = setup();
  const completed = {
    id: "evt_1",
    type: "checkout.session.completed",
    data: { object: { mode: "subscription", subscription: "sub_1", client_reference_id: USER, payment_status: "paid", amount_total: 999 } },
  };
  assert.equal((await sendEvent(env, completed)).status, 200);
  assert.equal(db.length, 1);
  assert.equal(db[0].status, "active");
  assert.equal(db[0].plan_type, "premium");
  assert.equal(db[0].payment_method, "stripe");
  assert.equal(db[0].user_id, USER);
  assert.equal(db[0].total_payments_received, 1);

  // same event again does nothing
  await sendEvent(env, completed);
  assert.equal(db.length, 1);

  // first invoice is not double counted, a renewal is
  await sendEvent(env, { id: "evt_2", type: "invoice.paid", data: { object: { subscription: "sub_1", billing_reason: "subscription_create", amount_paid: 999 } } });
  assert.equal(db[0].total_payments_received, 1);
  await sendEvent(env, { id: "evt_3", type: "invoice.paid", data: { object: { subscription: "sub_1", billing_reason: "subscription_cycle", amount_paid: 999 } } });
  assert.equal(db[0].total_payments_received, 2);
  assert.equal(db.length, 1);

  // member cancels in the portal: keeps access until the period ends
  subs.sub_1 = { ...subs.sub_1, cancel_at_period_end: true, canceled_at: NOW };
  await sendEvent(env, { id: "evt_4", type: "customer.subscription.updated", data: { object: subs.sub_1 } });
  assert.equal(db[0].status, "cancelled");
  assert.ok(new Date(db[0].end_date) > new Date());

  // period ends
  subs.sub_1 = { ...subs.sub_1, status: "canceled", ended_at: NOW };
  await sendEvent(env, { id: "evt_5", type: "customer.subscription.deleted", data: { object: subs.sub_1 } });
  assert.equal(db[0].status, "expired");
  assert.equal(db.length, 1);
});

test("subscription events from outside the site are ignored", async () => {
  const { env, db } = setup();
  await sendEvent(env, { id: "evt_9", type: "customer.subscription.updated", data: { object: { id: "sub_other", status: "active", metadata: {} } } });
  assert.equal(db.length, 0);
});

test("portal needs a Stripe customer", async () => {
  const { env } = setup();
  let r = await worker.fetch(req("/portal", { method: "POST", token: "good", body: {} }), env);
  assert.equal(r.status, 404);
  await worker.fetch(req("/checkout", { method: "POST", token: "good", body: { plan: "premium" } }), env);
  r = await worker.fetch(req("/portal", { method: "POST", token: "good", body: {} }), env);
  assert.equal(r.status, 200);
  assert.match((await r.json()).url, /billing\.stripe\.com/);
});

test("in test mode an admin who already shows as a member can still test checkout", async () => {
  let { env } = setup({ existingPaid: true, isAdminUser: true });
  let r = await worker.fetch(req("/checkout", { method: "POST", token: "good", body: { plan: "premium" } }), env);
  assert.equal(r.status, 200);
  // with a live key the double-charge check applies to admins too
  ({ env } = setup({ existingPaid: true, isAdminUser: true }));
  env.STRIPE_SECRET_KEY = "sk_live_x";
  r = await worker.fetch(req("/checkout", { method: "POST", token: "good", body: { plan: "premium" } }), env);
  assert.equal(r.status, 409);
});
