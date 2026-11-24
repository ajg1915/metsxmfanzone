// mets-shop — Cloudflare Worker for MetsXMFanZone's Mets Shop (/shop)
// Products and orders live in the D1 database "mets-shop" (not Supabase).
//
// Paste this whole file into: Cloudflare dashboard → Workers & Pages → Create →
// Worker → name it "mets-shop" → Deploy → Edit code → replace everything → Deploy.
//
// Then (Workers → mets-shop → Settings → Bindings → Add):
//   D1 database   Variable name SHOP   Database mets-shop
//
// Worker secrets (Settings -> Variables and Secrets -> Add -> type Secret):
//   PAYPAL_CLIENT_ID, PAYPAL_SECRET   same PayPal app your merch shop uses (live)
//   STRIPE_SECRET_KEY                 optional, sk_live_... once Stripe approves you
//   STRIPE_WEBHOOK_SECRET             optional, whsec_... for the Stripe webhook below
//   RESEND_API_KEY                    optional, sends order and tracking emails
//   OWNER_EMAIL                       optional, where new-order alerts go (default ajg1915@gmail.com)
// Stripe webhook URL: https://mets-shop.metsxmfan.workers.dev/stripe/webhook  (event checkout.session.completed)
//
// Admin calls need your signed-in admin session (same login as the admin area);
// the Worker checks it with Supabase auth + your admin role.
//
// Public:
//   GET  /products              published products
//   GET  /products/<slug>       one published product
// Admin:
//   GET  /admin/products        every product (published or hidden)
//   POST /admin/products        add a product
//   PUT  /admin/products/<id>   change a product
//   GET  /admin/orders, /admin/orders/export.csv (Pirate Ship), POST ship / tracking import / refund
// Checkout:
//   GET  /checkout/config, POST /checkout/paypal, POST /checkout/paypal/capture,
//   POST /checkout/stripe, GET /orders/<id>?key=..., POST /stripe/webhook

const DEFAULT_SUPABASE_URL = "https://rdmrxeplasttewtlfetc.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkbXJ4ZXBsYXN0dGV3dGxmZXRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NTIyNjAsImV4cCI6MjA3NzMyODI2MH0.P5msjdR8tgbx-rL2ifeSjqW1jvFzKtPNT4oapJIAkJA";
const ADMIN_CACHE_MS = 60_000;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization, stripe-signature",
};
const json = (data, status = 200, cache = "no-store") =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": cache } });

const slugify = (s) =>
  String(s).toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80).replace(/-+$/g, "");

// ---------- admin check ----------
const adminCache = new Map();
async function isAdmin(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token || token.length > 4000) return false;
  const cached = adminCache.get(token);
  if (cached && cached.exp > Date.now()) return cached.ok;
  const base = String(env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/+$/, "");
  const headers = { apikey: env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` };
  let ok = false;
  try {
    const u = await fetch(`${base}/auth/v1/user`, { headers });
    if (u.ok) {
      const user = await u.json();
      if (user?.id) {
        const r = await fetch(`${base}/rest/v1/user_roles?select=role&user_id=eq.${encodeURIComponent(user.id)}&role=eq.admin&limit=1`, { headers });
        ok = r.ok && ((await r.json()) || []).length > 0;
      }
    }
  } catch { ok = false; }
  if (adminCache.size > 200) adminCache.clear();
  adminCache.set(token, { ok, exp: Date.now() + ADMIN_CACHE_MS });
  return ok;
}

// ---------- products ----------
const parse = (s, d) => { try { return JSON.parse(s); } catch { return d; } };
function shape(row, admin = false) {
  const sizes = parse(row.sizes, []);
  const out = {
    id: row.id, slug: row.slug, title: row.title, description: row.description,
    price: row.price_cents / 100, images: parse(row.images, []), category: row.category,
    condition: row.condition, gift_wrap: !!row.gift_wrap,
    sizes: sizes.map((s) => ({ size: s.size, stock: s.stock, in_stock: s.stock === null || s.stock > 0 })),
    sold_out: sizes.length > 0 && sizes.every((s) => s.stock !== null && s.stock <= 0),
  };
  if (admin) Object.assign(out, { published: !!row.published, sort: row.sort, weight_oz: row.weight_oz, created_at: row.created_at, updated_at: row.updated_at });
  else out.sizes = out.sizes.map(({ size, in_stock }) => ({ size, in_stock }));
  return out;
}

function readProduct(b, requireAll) {
  const out = {}; const errors = [];
  const has = (k) => b[k] !== undefined && b[k] !== null;
  if (has("title")) { const t = String(b.title).trim(); if (t.length < 3 || t.length > 160) errors.push("Title must be 3-160 characters"); else out.title = t; }
  else if (requireAll) errors.push("Title is required");
  if (has("description")) { const d = String(b.description).trim(); if (d.length > 4000) errors.push("Description is too long"); else out.description = d; }
  if (has("price")) { const p = Math.round(Number(b.price) * 100); if (!Number.isFinite(p) || p < 50 || p > 100000) errors.push("Price must be between $0.50 and $1,000"); else out.price_cents = p; }
  else if (requireAll) errors.push("Price is required");
  if (has("images")) {
    if (!Array.isArray(b.images) || b.images.length > 8 || b.images.some((u) => typeof u !== "string" || !/^(https:\/\/|\/)[^\s"<>]{1,500}$/.test(u))) errors.push("Images must be up to 8 links");
    else out.images = JSON.stringify(b.images);
  }
  if (has("sizes")) {
    if (!Array.isArray(b.sizes) || b.sizes.length > 15) errors.push("Sizes must be a list");
    else {
      const sizes = b.sizes.map((s) => ({ size: String(s?.size || "").trim().slice(0, 20), stock: s?.stock === null || s?.stock === "" || s?.stock === undefined ? null : Math.max(0, Math.floor(Number(s.stock)) || 0) })).filter((s) => s.size);
      out.sizes = JSON.stringify(sizes);
    }
  }
  for (const k of ["category", "condition"]) if (has(k)) out[k] = String(b[k]).trim().slice(0, 60);
  if (has("weight_oz")) { const w = Number(b.weight_oz); if (!(w > 0 && w < 800)) errors.push("Weight must be in ounces"); else out.weight_oz = w; }
  for (const k of ["gift_wrap", "published"]) if (has(k)) out[k] = b[k] ? 1 : 0;
  if (has("sort")) out.sort = Math.floor(Number(b.sort)) || 0;
  return { value: out, error: errors.join("; ") || null };
}

async function uniqueSlug(env, base, exceptId = null) {
  let slug = base || "item"; let n = 1;
  while (await env.SHOP.prepare("SELECT id FROM products WHERE slug = ? AND id IS NOT ?").bind(slug, exceptId).first()) slug = `${base}-${++n}`;
  return slug;
}


// ---------- shared ----------
const SITE = "https://metsxmfanzone.com";
const SHIPPING_CENTS = 599; // flat rate per order (Pirate Ship labels bought by the owner)
const money = (c) => `$${(c / 100).toFixed(2)}`;
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
const newId = () => "MXS-" + [...crypto.getRandomValues(new Uint8Array(6))].map((b) => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 32]).join("");
const newKey = () => [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");
const US_STATES = new Set("AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY PR".split(" "));

async function readCheckout(env, b) {
  const errors = [];
  const c = b?.customer || {};
  const name = String(c.name || "").trim().slice(0, 100);
  const email = String(c.email || "").trim().toLowerCase().slice(0, 200);
  const line1 = String(c.address1 || "").trim().slice(0, 120);
  const line2 = String(c.address2 || "").trim().slice(0, 120);
  const city = String(c.city || "").trim().slice(0, 80);
  const state = String(c.state || "").trim().toUpperCase().slice(0, 2);
  const zip = String(c.zip || "").trim().slice(0, 10);
  if (name.length < 2) errors.push("Enter your full name");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("Enter a valid email");
  if (line1.length < 3) errors.push("Enter your street address");
  if (city.length < 2) errors.push("Enter your city");
  if (!US_STATES.has(state)) errors.push("Pick your state (US shipping only)");
  if (!/^\d{5}(-\d{4})?$/.test(zip)) errors.push("Enter a 5-digit ZIP code");
  const lines = Array.isArray(b?.items) ? b.items.slice(0, 20) : [];
  if (!lines.length) errors.push("Your cart is empty");
  const items = []; let subtotal = 0;
  for (const l of lines) {
    const qty = Math.max(1, Math.min(10, Math.floor(Number(l?.qty)) || 1));
    const row = await env.SHOP.prepare("SELECT * FROM products WHERE slug = ? AND published = 1").bind(String(l?.slug || "")).first();
    if (!row) { errors.push("An item in your cart is no longer available"); continue; }
    const sizes = parse(row.sizes, []);
    const sz = sizes.find((s) => s.size === l?.size);
    if (!sz) { errors.push(`Pick a size for ${row.title}`); continue; }
    if (sz.stock !== null && sz.stock < qty) { errors.push(`${row.title} (${sz.size}) has only ${sz.stock} left`); continue; }
    const img = parse(row.images, [])[0] || "";
    items.push({ product_id: row.id, slug: row.slug, title: row.title, size: sz.size, qty, price_cents: row.price_cents, image: img.startsWith("/") ? SITE + img : img, weight_oz: row.weight_oz });
    subtotal += row.price_cents * qty;
  }
  const gift = !!b?.gift_wrap;
  const giftNote = gift ? String(b?.gift_note || "").trim().slice(0, 300) : "";
  return { error: errors.join(". ") || null, order: { name, email, line1, line2, city, state, zip, items, subtotal, gift, giftNote } };
}

async function insertOrder(env, o, method) {
  const id = newId(); const key = newKey();
  const total = o.subtotal + SHIPPING_CENTS;
  await env.SHOP.prepare(`INSERT INTO orders (id, status, payment_method, customer_name, customer_email, address_line1, address_line2, city, state, zip, country,
      items, subtotal_cents, shipping_cents, total_cents, shipping_service, gift_wrap, gift_note, admin_note)
    VALUES (?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, 'US', ?, ?, ?, ?, 'USPS Ground Advantage (flat $5.99)', ?, ?, ?)`)
    .bind(id, method, o.name, o.email, o.line1, o.line2, o.city, o.state, o.zip, JSON.stringify(o.items), o.subtotal, SHIPPING_CENTS, total, o.gift ? 1 : 0, o.giftNote, "key:" + key).run();
  return { id, key, total };
}
const orderKey = (row) => (String(row?.admin_note || "").match(/^key:([0-9a-f]{32})/) || [])[1];

function publicOrder(row) {
  return {
    id: row.id, status: row.status, created_at: row.created_at, paid_at: row.paid_at, shipped_at: row.shipped_at,
    items: parse(row.items, []).map(({ title, size, qty, price_cents, image }) => ({ title, size, qty, price: price_cents / 100, image })),
    subtotal: row.subtotal_cents / 100, shipping: row.shipping_cents / 100, total: row.total_cents / 100,
    gift_wrap: !!row.gift_wrap, ship_to: { name: row.customer_name, city: row.city, state: row.state },
    carrier: row.carrier, tracking_number: row.tracking_number, tracking_url: row.tracking_url,
  };
}

// Paid: take the sizes out of stock once, then email.
async function markPaid(env, id, method, ref) {
  const res = await env.SHOP.prepare("UPDATE orders SET status = 'paid', payment_method = ?, payment_ref = ?, paid_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND status = 'pending' RETURNING *").bind(method, ref, id).first();
  if (!res) return null; // already handled
  for (const it of parse(res.items, [])) {
    const row = await env.SHOP.prepare("SELECT sizes FROM products WHERE id = ?").bind(it.product_id).first();
    if (!row) continue;
    const sizes = parse(row.sizes, []).map((s) => (s.size === it.size && s.stock !== null ? { ...s, stock: Math.max(0, s.stock - it.qty) } : s));
    await env.SHOP.prepare("UPDATE products SET sizes = ?, updated_at = datetime('now') WHERE id = ?").bind(JSON.stringify(sizes), it.product_id).run();
  }
  await orderEmails(env, res).catch(() => {});
  return res;
}

// ---------- email (Resend) ----------
async function sendEmail(env, to, subject, html) {
  if (!env.RESEND_API_KEY) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "MetsXMFanZone Shop <shop@metsxmfanzone.com>", to: [to], subject, html }),
  });
}
const itemRows = (row) => parse(row.items, []).map((i) => `<tr><td style="padding:6px 0">${i.image ? `<img src="${esc(i.image)}" width="56" style="border-radius:6px;vertical-align:middle;margin-right:10px">` : ""}${esc(i.title)} &middot; ${esc(i.size)} &times; ${i.qty}</td><td align="right">${money(i.price_cents * i.qty)}</td></tr>`).join("");
const wrapEmail = (inner) => `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#1a1a1a"><div style="background:#002D72;padding:18px;text-align:center"><span style="font-size:24px;font-weight:bold;color:#fff">Mets</span><span style="font-size:24px;font-weight:bold;color:#FF5910">XM</span><span style="font-size:24px;font-weight:bold;color:#fff">FanZone</span></div><div style="height:4px;background:#FF5910"></div><div style="padding:20px">${inner}</div></div>`;
async function orderEmails(env, row) {
  const totals = `<table width="100%" style="font-size:14px">${itemRows(row)}<tr><td style="padding-top:8px">Shipping</td><td align="right">${money(row.shipping_cents)}</td></tr><tr><td><b>Total</b></td><td align="right"><b>${money(row.total_cents)}</b></td></tr></table>`;
  const addr = `${esc(row.customer_name)}<br>${esc(row.address_line1)}${row.address_line2 ? "<br>" + esc(row.address_line2) : ""}<br>${esc(row.city)}, ${esc(row.state)} ${esc(row.zip)}`;
  await sendEmail(env, row.customer_email, `Order ${row.id} confirmed`, wrapEmail(`<h2 style="margin-top:0">Thanks for your order!</h2><p>Order <b>${row.id}</b> is paid. We'll email you a tracking number as soon as it ships.</p>${totals}${row.gift_wrap ? `<p>🎁 Gift wrapped${row.gift_note ? `: "${esc(row.gift_note)}"` : ""}</p>` : ""}<p><b>Shipping to</b><br>${addr}</p>`));
  await sendEmail(env, env.OWNER_EMAIL || "ajg1915@gmail.com", `New shop order ${row.id} – ${money(row.total_cents)}`, wrapEmail(`<h2 style="margin-top:0">New order ${row.id}</h2>${totals}${row.gift_wrap ? `<p><b>GIFT WRAP</b>${row.gift_note ? ` – note: "${esc(row.gift_note)}"` : ""}</p>` : ""}<p>${addr}<br>${esc(row.customer_email)}</p><p>Paid with ${esc(row.payment_method)}. Ship it from Admin → Shop → Orders.</p>`));
}

// ---------- PayPal ----------
const paypalBase = (env) => env.PAYPAL_BASE_URL || "https://api-m.paypal.com";
async function paypalToken(env) {
  const r = await fetch(`${paypalBase(env)}/v1/oauth2/token`, { method: "POST", headers: { Authorization: "Basic " + btoa(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_SECRET}`), "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials" });
  const d = await r.json(); if (!r.ok) throw new Error("PayPal login failed"); return d.access_token;
}
async function paypal(env, method, path, body, reqId) {
  const t = await paypalToken(env);
  const r = await fetch(`${paypalBase(env)}${path}`, { method, headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json", ...(reqId ? { "PayPal-Request-Id": reqId } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(d?.details?.[0]?.description || d?.message || `PayPal error ${r.status}`); e.data = d; throw e; }
  return d;
}

// ---------- Stripe ----------
function formEncode(obj, prefix = "", out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((item, i) => (typeof item === "object" ? formEncode(item, `${key}[${i}]`, out) : out.append(`${key}[${i}]`, String(item))));
    else if (typeof v === "object") formEncode(v, key, out);
    else out.append(key, String(v));
  }
  return out;
}
async function stripe(env, method, path, params, idem) {
  const headers = { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" };
  if (idem) headers["Idempotency-Key"] = idem;
  const r = await fetch(`https://api.stripe.com/v1${path}`, { method, headers, body: params ? formEncode(params).toString() : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error?.message || `Stripe error ${r.status}`);
  return d;
}
async function verifyStripe(payload, header, secret) {
  if (!header || !secret) return false;
  let t = 0; const sigs = [];
  for (const p of header.split(",")) { const [k, v] = p.split("="); if (k === "t") t = Number(v); if (k === "v1") sigs.push(v); }
  if (!t || !sigs.length || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${payload}`));
  const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return sigs.includes(hex);
}

// ---------- admin: orders ----------
function adminOrder(row) { const o = publicOrder(row); return { ...o, email: row.customer_email, address: { line1: row.address_line1, line2: row.address_line2, city: row.city, state: row.state, zip: row.zip }, gift_note: row.gift_note, payment_method: row.payment_method, payment_ref: row.payment_ref, refunded: row.refunded_cents / 100, note: String(row.admin_note || "").replace(/^key:[0-9a-f]{32}\s*/, "") }; }
const csvCell = (v) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
function parseCsv(text) {
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; }
    else if (ch === '"') q = true; else if (ch === ",") { row.push(cell); cell = ""; } else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}
const trackingUrl = (carrier, num) => /ups/i.test(carrier) ? `https://www.ups.com/track?tracknum=${encodeURIComponent(num)}` : `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(num)}`;
async function shipOrder(env, id, carrier, tracking) {
  const num = String(tracking || "").replace(/\s+/g, "").slice(0, 40);
  if (num.length < 8) throw new Error("Enter the tracking number");
  const c = /ups/i.test(carrier) ? "UPS" : "USPS";
  const row = await env.SHOP.prepare("UPDATE orders SET status = 'shipped', carrier = ?, tracking_number = ?, tracking_url = ?, shipped_at = COALESCE(shipped_at, datetime('now')), updated_at = datetime('now') WHERE id = ? AND status IN ('paid','shipped') RETURNING *").bind(c, num, trackingUrl(c, num), id).first();
  if (!row) throw new Error(`Order ${id} isn't paid yet`);
  await sendEmail(env, row.customer_email, `Your order ${row.id} has shipped`, wrapEmail(`<h2 style="margin-top:0">It's on the way!</h2><p>Order <b>${row.id}</b> shipped with ${c}.</p><p><a href="${esc(row.tracking_url)}" style="display:inline-block;background:#002D72;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold">Track package ${esc(num)}</a></p><table width="100%" style="font-size:14px">${itemRows(row)}</table>`)).catch(() => {});
  return row;
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
    if (!env.SHOP) return json({ error: "Shop database is not connected (add the D1 binding SHOP)" }, 500);
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    try {
      if (request.method === "GET" && path === "/products") {
        const { results } = await env.SHOP.prepare("SELECT * FROM products WHERE published = 1 ORDER BY sort ASC, id DESC").all();
        return json({ products: results.map((r) => shape(r)) }, 200, "public, max-age=60");
      }
      let m = path.match(/^\/products\/([a-z0-9-]{1,90})$/);
      if (request.method === "GET" && m) {
        const row = await env.SHOP.prepare("SELECT * FROM products WHERE slug = ? AND published = 1").bind(m[1]).first();
        return row ? json({ product: shape(row) }, 200, "public, max-age=60") : json({ error: "Not found" }, 404);
      }


      // ----- checkout -----
      if (request.method === "GET" && path === "/checkout/config") {
        return json({ shipping: SHIPPING_CENTS / 100, paypal: !!(env.PAYPAL_CLIENT_ID && env.PAYPAL_SECRET), card: !!env.STRIPE_SECRET_KEY });
      }
      if (request.method === "POST" && path === "/checkout/paypal") {
        if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_SECRET) return json({ error: "PayPal checkout isn't set up yet" }, 503);
        const { error, order } = await readCheckout(env, await request.json().catch(() => ({})));
        if (error) return json({ error }, 400);
        const { id, key, total } = await insertOrder(env, order, "paypal");
        const pp = await paypal(env, "POST", "/v2/checkout/orders", {
          intent: "CAPTURE",
          purchase_units: [{ reference_id: id, invoice_id: id, description: `MetsXMFanZone Shop order ${id}`,
            amount: { currency_code: "USD", value: (total / 100).toFixed(2), breakdown: { item_total: { currency_code: "USD", value: (order.subtotal / 100).toFixed(2) }, shipping: { currency_code: "USD", value: (SHIPPING_CENTS / 100).toFixed(2) } } },
            items: order.items.map((i) => ({ name: `${i.title} (${i.size})`.slice(0, 127), quantity: String(i.qty), unit_amount: { currency_code: "USD", value: (i.price_cents / 100).toFixed(2) }, category: "PHYSICAL_GOODS" })),
            shipping: { name: { full_name: order.name }, address: { address_line_1: order.line1, address_line_2: order.line2 || undefined, admin_area_2: order.city, admin_area_1: order.state, postal_code: order.zip, country_code: "US" } } }],
          payment_source: { paypal: { experience_context: { brand_name: "MetsXMFanZone", shipping_preference: "SET_PROVIDED_ADDRESS", user_action: "PAY_NOW",
            return_url: `${SITE}/shop/thanks?order=${id}&key=${key}`, cancel_url: `${SITE}/shop?cancelled=${id}` } } },
        }, id);
        await env.SHOP.prepare("UPDATE orders SET payment_ref = ? WHERE id = ?").bind("pp-order:" + pp.id, id).run();
        const approve = (pp.links || []).find((l) => l.rel === "payer-action" || l.rel === "approve")?.href;
        return json({ order_id: id, approve_url: approve });
      }
      if (request.method === "POST" && path === "/checkout/paypal/capture") {
        const b = await request.json().catch(() => ({}));
        const row = await env.SHOP.prepare("SELECT * FROM orders WHERE id = ?").bind(String(b.order || "")).first();
        if (!row || orderKey(row) !== b.key) return json({ error: "Order not found" }, 404);
        if (row.status !== "pending") return json({ order: publicOrder(row) });
        const ppId = String(row.payment_ref || "").replace(/^pp-order:/, "");
        const cap = await paypal(env, "POST", `/v2/checkout/orders/${ppId}/capture`, {}, row.id + "-capture");
        const capture = cap?.purchase_units?.[0]?.payments?.captures?.[0];
        if (cap.status !== "COMPLETED" || !capture) return json({ error: "PayPal didn't complete the payment" }, 402);
        const paid = await markPaid(env, row.id, "paypal", capture.id);
        return json({ order: publicOrder(paid || (await env.SHOP.prepare("SELECT * FROM orders WHERE id = ?").bind(row.id).first())) });
      }
      if (request.method === "POST" && path === "/checkout/stripe") {
        if (!env.STRIPE_SECRET_KEY) return json({ error: "Card checkout isn't set up yet" }, 503);
        const { error, order } = await readCheckout(env, await request.json().catch(() => ({})));
        if (error) return json({ error }, 400);
        const { id, key } = await insertOrder(env, order, "stripe");
        const session = await stripe(env, "POST", "/checkout/sessions", {
          mode: "payment", customer_email: order.email, client_reference_id: id, metadata: { shop_order: id },
          payment_intent_data: { metadata: { shop_order: id } },
          line_items: [...order.items.map((i) => ({ quantity: i.qty, price_data: { currency: "usd", unit_amount: i.price_cents, product_data: { name: `${i.title} (${i.size})`, images: i.image ? [i.image] : undefined } } })),
            { quantity: 1, price_data: { currency: "usd", unit_amount: SHIPPING_CENTS, product_data: { name: "Shipping (USPS Ground Advantage)" } } }],
          success_url: `${SITE}/shop/thanks?order=${id}&key=${key}`, cancel_url: `${SITE}/shop?cancelled=${id}`,
        }, id);
        await env.SHOP.prepare("UPDATE orders SET payment_ref = ? WHERE id = ?").bind("cs:" + session.id, id).run();
        return json({ order_id: id, checkout_url: session.url });
      }
      if (request.method === "POST" && path === "/stripe/webhook") {
        const payload = await request.text();
        if (!(await verifyStripe(payload, request.headers.get("stripe-signature"), env.STRIPE_WEBHOOK_SECRET))) return json({ error: "Bad signature" }, 400);
        const ev = JSON.parse(payload);
        if (ev.type === "checkout.session.completed" && ev.data?.object?.payment_status === "paid") {
          const sess = ev.data.object; const id = sess.metadata?.shop_order || sess.client_reference_id;
          if (id) await markPaid(env, id, "stripe", sess.payment_intent || sess.id);
        }
        return json({ received: true });
      }
      m = path.match(/^\/orders\/(MXS-[A-Z0-9]{6})$/);
      if (request.method === "GET" && m) {
        const row = await env.SHOP.prepare("SELECT * FROM orders WHERE id = ?").bind(m[1]).first();
        if (!row || orderKey(row) !== url.searchParams.get("key")) return json({ error: "Order not found" }, 404);
        return json({ order: publicOrder(row) });
      }

      if (path.startsWith("/admin/")) {
        if (!(await isAdmin(request, env))) return json({ error: "Admins only. Sign in again." }, 401);
        if (request.method === "GET" && path === "/admin/products") {
          const { results } = await env.SHOP.prepare("SELECT * FROM products ORDER BY sort ASC, id DESC").all();
          return json({ products: results.map((r) => shape(r, true)) });
        }
        if (request.method === "POST" && path === "/admin/products") {
          const { value, error } = readProduct(await request.json().catch(() => ({})), true);
          if (error) return json({ error }, 400);
          value.slug = await uniqueSlug(env, slugify(value.title));
          const keys = Object.keys(value);
          const row = await env.SHOP.prepare(`INSERT INTO products (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")}) RETURNING *`).bind(...keys.map((k) => value[k])).first();
          return json({ product: shape(row, true) }, 201);
        }

        // ----- orders -----
        if (request.method === "GET" && path === "/admin/orders") {
          const status = url.searchParams.get("status");
          const q = status && status !== "all" ? env.SHOP.prepare("SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC LIMIT 300").bind(status) : env.SHOP.prepare("SELECT * FROM orders WHERE status != 'pending' OR created_at > datetime('now','-2 days') ORDER BY created_at DESC LIMIT 300");
          const { results } = await q.all();
          const sums = await env.SHOP.prepare(`SELECT
              COALESCE(SUM(CASE WHEN date(paid_at) = date('now') THEN total_cents - refunded_cents END),0) AS today,
              COALESCE(SUM(CASE WHEN strftime('%Y-%m', paid_at) = strftime('%Y-%m','now') THEN total_cents - refunded_cents END),0) AS month,
              COALESCE(SUM(CASE WHEN paid_at IS NOT NULL THEN total_cents - refunded_cents END),0) AS all_time,
              SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) AS to_ship
            FROM orders`).first();
          return json({ orders: results.map(adminOrder), totals: { today: sums.today / 100, month: sums.month / 100, all_time: sums.all_time / 100, to_ship: sums.to_ship || 0 } });
        }
        if (request.method === "GET" && path === "/admin/orders/export.csv") {
          const { results } = await env.SHOP.prepare("SELECT * FROM orders WHERE status = 'paid' ORDER BY paid_at ASC").all();
          const head = ["Order ID", "Name", "Address", "Address Line 2", "City", "State", "Zipcode", "Country", "Email", "Pounds", "Ounces", "Length", "Width", "Height", "Description", "Value"];
          const lines = [head.join(",")];
          for (const r of results) {
            const items = parse(r.items, []);
            const oz = Math.max(1, Math.ceil(items.reduce((t, i) => t + (Number(i.weight_oz) || 6) * i.qty, 0)));
            const desc = items.map((i) => `${i.qty}x ${i.title} ${i.size}`).join("; ") + (r.gift_wrap ? " [GIFT WRAP]" : "");
            lines.push([r.id, r.customer_name, r.address_line1, r.address_line2, r.city, r.state, r.zip, "US", r.customer_email, Math.floor(oz / 16), oz % 16, 10, 13, 1, desc, (r.subtotal_cents / 100).toFixed(2)].map(csvCell).join(","));
          }
          return new Response(lines.join("\r\n") + "\r\n", { headers: { ...CORS, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="pirate-ship-orders-${new Date().toISOString().slice(0, 10)}.csv"` } });
        }
        m = path.match(/^\/admin\/orders\/(MXS-[A-Z0-9]{6})\/ship$/);
        if (request.method === "POST" && m) {
          const b = await request.json().catch(() => ({}));
          try { return json({ order: adminOrder(await shipOrder(env, m[1], b.carrier, b.tracking)) }); } catch (e) { return json({ error: e.message }, 400); }
        }
        if (request.method === "POST" && path === "/admin/orders/import-tracking") {
          const rows = parseCsv(await request.text());
          if (rows.length < 2) return json({ error: "That file has no rows" }, 400);
          const h = rows[0].map((x) => x.trim().toLowerCase());
          const oi = h.findIndex((x) => x.includes("order")); const ti = h.findIndex((x) => x.includes("tracking"));
          const ci = h.findIndex((x) => x.includes("carrier"));
          if (oi < 0 || ti < 0) return json({ error: "Couldn't find Order ID and Tracking Number columns" }, 400);
          const done = [], skipped = [];
          for (const r of rows.slice(1)) {
            const id = (String(r[oi] || "").match(/MXS-[A-Z0-9]{6}/) || [])[0];
            if (!id || !r[ti]) continue;
            try { await shipOrder(env, id, ci >= 0 ? r[ci] : "USPS", r[ti]); done.push(id); } catch (e) { skipped.push(`${id}: ${e.message}`); }
          }
          return json({ shipped: done, skipped });
        }
        m = path.match(/^\/admin\/orders\/(MXS-[A-Z0-9]{6})\/refund$/);
        if (request.method === "POST" && m) {
          const b = await request.json().catch(() => ({}));
          const row = await env.SHOP.prepare("SELECT * FROM orders WHERE id = ?").bind(m[1]).first();
          if (!row || !row.paid_at) return json({ error: "Only paid orders can be refunded" }, 400);
          const left = row.total_cents - row.refunded_cents;
          const cents = b.amount ? Math.round(Number(b.amount) * 100) : left;
          if (!(cents > 0 && cents <= left)) return json({ error: `Refund must be between $0.01 and ${money(left)}` }, 400);
          if (row.payment_method === "paypal") await paypal(env, "POST", `/v2/payments/captures/${row.payment_ref}/refund`, { amount: { currency_code: "USD", value: (cents / 100).toFixed(2) }, note_to_payer: "Refund from MetsXMFanZone Shop" }, `${row.id}-refund-${row.refunded_cents + cents}`);
          else if (row.payment_method === "stripe") await stripe(env, "POST", "/refunds", { payment_intent: row.payment_ref, amount: cents }, `${row.id}-refund-${row.refunded_cents + cents}`);
          else return json({ error: "Unknown payment method" }, 400);
          const full = row.refunded_cents + cents >= row.total_cents;
          const upd = await env.SHOP.prepare("UPDATE orders SET refunded_cents = refunded_cents + ?, status = CASE WHEN ? THEN 'refunded' ELSE status END, updated_at = datetime('now') WHERE id = ? RETURNING *").bind(cents, full ? 1 : 0, row.id).first();
          return json({ order: adminOrder(upd) });
        }
        m = path.match(/^\/admin\/orders\/(MXS-[A-Z0-9]{6})$/);
        if (request.method === "PUT" && m) {
          const b = await request.json().catch(() => ({}));
          const row = await env.SHOP.prepare("SELECT * FROM orders WHERE id = ?").bind(m[1]).first();
          if (!row) return json({ error: "Not found" }, 404);
          const key = orderKey(row);
          const note = String(b.note ?? "").slice(0, 1000);
          const status = ["paid", "shipped", "cancelled", "delivered"].includes(b.status) ? b.status : row.status;
          const upd = await env.SHOP.prepare("UPDATE orders SET admin_note = ?, status = ?, updated_at = datetime('now') WHERE id = ? RETURNING *").bind((key ? `key:${key} ` : "") + note, status, row.id).first();
          return json({ order: adminOrder(upd) });
        }
        m = path.match(/^\/admin\/products\/(\d+)$/);
        if (request.method === "PUT" && m) {
          const id = Number(m[1]);
          const { value, error } = readProduct(await request.json().catch(() => ({})), false);
          if (error) return json({ error }, 400);
          if (value.title) value.slug = await uniqueSlug(env, slugify(value.title), id);
          const keys = Object.keys(value);
          if (!keys.length) return json({ error: "Nothing to change" }, 400);
          const row = await env.SHOP.prepare(`UPDATE products SET ${keys.map((k) => `${k} = ?`).join(", ")}, updated_at = datetime('now') WHERE id = ? RETURNING *`).bind(...keys.map((k) => value[k]), id).first();
          return row ? json({ product: shape(row, true) }) : json({ error: "Not found" }, 404);
        }
      }
      return json({ error: "Not found" }, 404);
    } catch (e) {
      return json({ error: "Shop error: " + (e?.message || e) }, 500);
    }
  },
};
