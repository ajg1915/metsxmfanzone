// member-perks — Cloudflare Worker for MetsXMFanZone
// Free t-shirt for new monthly and yearly members. Keeps each claim (size + shipping
// address) in your R2 bucket (not Supabase), emails you every new claim, and makes sure
// each member can claim only once.
//
// Paste this whole file into: Cloudflare dashboard → Workers & Pages →
// Create → Worker → name it "member-perks" → Deploy → Edit code → replace
// everything → Deploy.
//
// Then (Workers → member-perks → Settings):
//   Bindings → Add → R2 bucket
//       Variable name   PERKS
//       R2 bucket       metsxmfanzone-assets
//   Variables and Secrets → Add
//       RESEND_API_KEY  (secret)  your Resend key, so you get an email for each claim
//       NOTIFY_EMAIL    (text, optional)  where claim emails go, default support@metsxmfanzone.com
//       OFFER_ENDS      (text, optional)  last day of the offer, like 2026-12-31. Leave empty for no end date.
//
//   GET  /shirt/me                 member: { eligible, claimed, reason }
//   POST /shirt/claim              member: { name, size, address1, address2, city, state, zip, phone }
//   GET  /shirt/claims             admin: all claims, newest first
//   POST /shirt/claims/<id>/shipped  admin: { shipped: true|false }
//
// Eligible = signed in with an ACTIVE monthly or yearly membership (checked with Supabase).
// Files in the bucket: perks/shirts/<user id>.json (one per member).

const DEFAULT_SUPABASE_URL = "https://rdmrxeplasttewtlfetc.supabase.co";
// Publishable (public) key of the MetsXMFanZone-app project; override with SUPABASE_ANON_KEY if it ever rotates.
const DEFAULT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkbXJ4ZXBsYXN0dGV3dGxmZXRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NTIyNjAsImV4cCI6MjA3NzMyODI2MH0.P5msjdR8tgbx-rL2ifeSjqW1jvFzKtPNT4oapJIAkJA";

const SIZES = ["S", "M", "L", "XL", "2XL", "3XL"];
const PAID_PLANS = ["premium", "annual"]; // premium = monthly
const PREFIX = "perks/shirts/";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization",
};
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" } });

const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clean = (v, max) => String(v ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);

function sb(env) {
  return {
    base: String(env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/+$/, ""),
    anon: env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY,
  };
}

// Returns { id, email } for a signed-in member, or null.
async function whoAmI(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return null;
  const { base, anon } = sb(env);
  try {
    const r = await fetch(`${base}/auth/v1/user`, { headers: { apikey: anon, Authorization: `Bearer ${token}` } });
    if (!r.ok) return null;
    const u = await r.json();
    return u?.id ? { id: u.id, email: u.email || "", token } : null;
  } catch {
    return null;
  }
}

async function hasPaidPlan(env, me) {
  const { base, anon } = sb(env);
  const url = `${base}/rest/v1/subscriptions?select=plan_type&user_id=eq.${encodeURIComponent(me.id)}&status=eq.active&plan_type=in.(${PAID_PLANS.join(",")})&limit=1`;
  try {
    const r = await fetch(url, { headers: { apikey: anon, Authorization: `Bearer ${me.token}` } });
    if (!r.ok) return false;
    const rows = await r.json();
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
}

async function isAdmin(env, me) {
  const { base, anon } = sb(env);
  try {
    const r = await fetch(`${base}/rest/v1/user_roles?select=role&user_id=eq.${encodeURIComponent(me.id)}&role=eq.admin&limit=1`, {
      headers: { apikey: anon, Authorization: `Bearer ${me.token}` },
    });
    if (!r.ok) return false;
    const rows = await r.json();
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
}

const offerOpen = (env) => {
  if (!env.OFFER_ENDS) return true;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
  return today <= String(env.OFFER_ENDS).trim();
};

async function status(env, me) {
  if (!offerOpen(env)) return { eligible: false, claimed: false, reason: "The free shirt offer has ended." };
  const existing = await env.PERKS.get(PREFIX + me.id + ".json");
  if (existing) return { eligible: false, claimed: true, reason: "You already claimed your free shirt." };
  if (!(await hasPaidPlan(env, me))) return { eligible: false, claimed: false, reason: "The free shirt is for active monthly and yearly members." };
  return { eligible: true, claimed: false, reason: "" };
}

async function claim(env, me, request) {
  const st = await status(env, me);
  if (!st.eligible) return json({ error: st.reason }, st.claimed ? 409 : 403);

  let b;
  try {
    b = await request.json();
  } catch {
    return json({ error: "Invalid request" }, 400);
  }
  const rec = {
    id: me.id,
    email: me.email,
    name: clean(b.name, 100),
    size: clean(b.size, 4).toUpperCase(),
    address1: clean(b.address1, 120),
    address2: clean(b.address2, 120),
    city: clean(b.city, 80),
    state: clean(b.state, 40),
    zip: clean(b.zip, 12),
    phone: clean(b.phone, 30),
    shipped: false,
    created_at: new Date().toISOString(),
  };
  if (!rec.name || !rec.address1 || !rec.city || !rec.state || !rec.zip) return json({ error: "Please fill in your name and full shipping address." }, 400);
  if (!SIZES.includes(rec.size)) return json({ error: "Please pick a shirt size." }, 400);

  await env.PERKS.put(PREFIX + me.id + ".json", JSON.stringify(rec), { httpMetadata: { contentType: "application/json" } });

  // Email Anthony. The claim is already saved, so a mail hiccup never loses it.
  let emailed = false;
  if (env.RESEND_API_KEY) {
    try {
      const html = `<h2>New free-shirt claim</h2>
<p><strong>${esc(rec.name)}</strong> (${esc(rec.email)})</p>
<p>Size: <strong>${esc(rec.size)}</strong></p>
<p>${esc(rec.address1)}${rec.address2 ? "<br>" + esc(rec.address2) : ""}<br>${esc(rec.city)}, ${esc(rec.state)} ${esc(rec.zip)}${rec.phone ? "<br>Phone: " + esc(rec.phone) : ""}</p>`;
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.RESEND_API_KEY}` },
        body: JSON.stringify({
          from: "MetsXMFanZone <noreply@metsxmfanzone.com>",
          to: [env.NOTIFY_EMAIL || "support@metsxmfanzone.com"],
          reply_to: rec.email || undefined,
          subject: `Free shirt claim: ${rec.name} (${rec.size})`,
          html,
        }),
      });
      emailed = r.ok;
    } catch {
      emailed = false;
    }
  }
  return json({ ok: true, emailed }, 201);
}

async function listClaims(env) {
  const out = [];
  let cursor;
  do {
    const page = await env.PERKS.list({ prefix: PREFIX, cursor, limit: 500 });
    for (const o of page.objects) {
      const obj = await env.PERKS.get(o.key);
      if (obj) out.push(await obj.json());
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor && out.length < 2000);
  out.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  return json({ claims: out });
}

async function setShipped(env, id, shipped) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "Bad id" }, 400);
  const obj = await env.PERKS.get(PREFIX + id + ".json");
  if (!obj) return json({ error: "Not found" }, 404);
  const rec = await obj.json();
  rec.shipped = !!shipped;
  rec.shipped_at = shipped ? new Date().toISOString() : undefined;
  await env.PERKS.put(PREFIX + id + ".json", JSON.stringify(rec), { httpMetadata: { contentType: "application/json" } });
  return json({ ok: true });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
    try {
      const path = new URL(request.url).pathname.replace(/\/+$/, "") || "/";
      if (path === "/") return json({ ok: true, service: "member-perks" });
      if (!env.PERKS) return json({ error: "Worker is missing its R2 binding named PERKS" }, 500);

      const me = await whoAmI(request, env);
      if (!me) return json({ error: "Please sign in" }, 401);

      if (path === "/shirt/me" && request.method === "GET") return json(await status(env, me));
      if (path === "/shirt/claim" && request.method === "POST") return await claim(env, me, request);

      if (path.startsWith("/shirt/claims")) {
        if (!(await isAdmin(env, me))) return json({ error: "Admin sign-in required" }, 401);
        if (path === "/shirt/claims" && request.method === "GET") return await listClaims(env);
        const m = path.match(/^\/shirt\/claims\/([^/]+)\/shipped$/);
        if (m && request.method === "POST") {
          const b = await request.json().catch(() => ({}));
          return await setShipped(env, m[1], b.shipped !== false);
        }
      }
      return json({ error: "Not found" }, 404);
    } catch {
      return json({ error: "Something went wrong" }, 500);
    }
  },
};
