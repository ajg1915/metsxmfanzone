// podcast-radio — Cloudflare Worker for MetsXMFanZone
// Lets you go live with the MetsXMFanZone podcast straight from a device microphone
// (phone, laptop, or a PC mic that carries your OBS audio) and lets visitors listen on the
// site. No VDO.Ninja. Audio only. Runs on Cloudflare Realtime (SFU), whose free allowance
// is far above what a podcast uses.
//
// ONE-TIME SETUP
// 1) Cloudflare dashboard → Realtime (a.k.a. Calls) → Create application → name it
//    "metsxmfanzone-radio". Copy the App ID and the App Secret (API token).
// 2) Workers & Pages → Create → Worker → name it "podcast-radio" → Deploy → Edit code →
//    paste this whole file → Deploy.
// 3) Worker → Settings → Variables and Secrets:
//      REALTIME_APP_ID       (text)
//      REALTIME_APP_SECRET   (secret)
// 4) Worker → Settings → Bindings → Add → KV namespace. Variable name: RADIO.
//    (Workers & Pages → KV → Create namespace "podcast-radio" first if you do not have one.)
// 5) Open Admin → Podcast Live Stream → "Go live from this device".
//
// Routes
//   GET  /status              { live, title, description, startedAt }       (public)
//   POST /listen              { sessionId, sessionDescription }             (public) start listening
//   POST /listen/answer       { sessionId, sdp }                            (public) finish listening
//   POST /go-live             admin: { sdp, title, description } → { sdp }  start broadcasting
//   POST /heartbeat           admin: keeps the show marked live
//   POST /end                 admin: ends the show
// Admin calls use your signed-in admin session, checked against Supabase.

const CF_API = "https://rtc.live.cloudflare.com/v1/apps";
const DEFAULT_SUPABASE_URL = "https://rdmrxeplasttewtlfetc.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkbXJ4ZXBsYXN0dGV3dGxmZXRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NTIyNjAsImV4cCI6MjA3NzMyODI2MH0.P5msjdR8tgbx-rL2ifeSjqW1jvFzKtPNT4oapJIAkJA";
const TRACK = "mic";
const STALE_MS = 150_000; // no heartbeat for 2.5 minutes = the show is over
const ADMIN_CACHE_MS = 60_000;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};
const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...CORS, ...extra } });

// ---------- admin check ----------
const adminCache = new Map();
async function isAdmin(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return false;
  const hit = adminCache.get(token);
  if (hit && hit.exp > Date.now()) return hit.ok;
  const base = String(env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/+$/, "");
  const headers = { apikey: env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` };
  let ok = false;
  try {
    const u = await fetch(`${base}/auth/v1/user`, { headers });
    if (u.ok) {
      const user = await u.json();
      if (user?.id) {
        const r = await fetch(`${base}/rest/v1/user_roles?select=role&user_id=eq.${encodeURIComponent(user.id)}&role=eq.admin&limit=1`, { headers });
        if (r.ok) ok = ((await r.json()) || []).length > 0;
      }
    }
  } catch {
    ok = false;
  }
  if (adminCache.size > 100) adminCache.clear();
  adminCache.set(token, { ok, exp: Date.now() + ADMIN_CACHE_MS });
  return ok;
}

// ---------- Cloudflare Realtime ----------
async function rtc(env, path, method, body) {
  const res = await fetch(`${CF_API}/${env.REALTIME_APP_ID}${path}`, {
    method,
    headers: { Authorization: `Bearer ${env.REALTIME_APP_SECRET}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.errorCode) throw new Error(data.errorDescription || `Realtime error ${res.status}`);
  return data;
}

async function readLive(env) {
  const raw = await env.RADIO.get("live");
  if (!raw) return null;
  try {
    const live = JSON.parse(raw);
    return Date.now() - live.heartbeat < STALE_MS ? live : null;
  } catch {
    return null;
  }
}

async function status(env) {
  const live = await readLive(env);
  return json(
    live ? { live: true, title: live.title, description: live.description, startedAt: live.startedAt } : { live: false },
    200,
    { "Cache-Control": "public, max-age=5" }
  );
}

async function goLive(env, request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.sdp !== "string") return json({ error: "Missing offer" }, 400);
  const session = await rtc(env, "/sessions/new", "POST");
  const mid = typeof body.mid === "string" ? body.mid : "0";
  const out = await rtc(env, `/sessions/${session.sessionId}/tracks/new`, "POST", {
    sessionDescription: { type: "offer", sdp: body.sdp },
    tracks: [{ location: "local", mid, trackName: TRACK }],
  });
  const now = Date.now();
  await env.RADIO.put(
    "live",
    JSON.stringify({
      sessionId: session.sessionId,
      title: String(body.title || "MetsXMFanZone Podcast live").slice(0, 120),
      description: String(body.description || "").slice(0, 300),
      startedAt: now,
      heartbeat: now,
    })
  );
  return json({ sdp: out.sessionDescription.sdp });
}

async function heartbeat(env) {
  const raw = await env.RADIO.get("live");
  if (!raw) return json({ live: false }, 409);
  const live = JSON.parse(raw);
  live.heartbeat = Date.now();
  await env.RADIO.put("live", JSON.stringify(live));
  return json({ live: true });
}

async function listen(env) {
  const live = await readLive(env);
  if (!live) return json({ error: "Not live" }, 409);
  const session = await rtc(env, "/sessions/new", "POST");
  const out = await rtc(env, `/sessions/${session.sessionId}/tracks/new`, "POST", {
    tracks: [{ location: "remote", sessionId: live.sessionId, trackName: TRACK }],
  });
  return json({ sessionId: session.sessionId, sessionDescription: out.sessionDescription });
}

async function listenAnswer(env, request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.sdp !== "string" || !/^[a-f0-9]{20,64}$/i.test(String(body.sessionId))) return json({ error: "Bad request" }, 400);
  await rtc(env, `/sessions/${body.sessionId}/renegotiate`, "PUT", { sessionDescription: { type: "answer", sdp: body.sdp } });
  return json({ ok: true });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    const path = new URL(request.url).pathname.replace(/\/+$/, "") || "/";
    try {
      if (!env.REALTIME_APP_ID || !env.REALTIME_APP_SECRET || !env.RADIO) {
        return json({ error: "Not set up yet", setup: true }, path === "/status" ? 200 : 503);
      }
      if (path === "/status" && request.method === "GET") return await status(env);
      if (request.method !== "POST") return json({ error: "Not found" }, 404);
      if (path === "/listen") return await listen(env);
      if (path === "/listen/answer") return await listenAnswer(env, request);
      if (["/go-live", "/heartbeat", "/end"].includes(path)) {
        if (!(await isAdmin(request, env))) return json({ error: "Not allowed" }, 401);
        if (path === "/go-live") return await goLive(env, request);
        if (path === "/heartbeat") return await heartbeat(env);
        await env.RADIO.delete("live");
        return json({ live: false });
      }
      return json({ error: "Not found" }, 404);
    } catch (err) {
      return json({ error: String(err?.message || err) }, 502);
    }
  },
};
