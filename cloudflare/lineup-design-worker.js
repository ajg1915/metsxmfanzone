// lineup-design — Cloudflare Worker for MetsXMFanZone
// Keeps the Lineup Card design (colors, layout, text) and an optional hand-typed
// lineup for today in your R2 bucket (not Supabase).
//
// Paste this whole file into: Cloudflare dashboard → Workers & Pages →
// Create → Worker → name it "lineup-design" → Deploy → Edit code → replace
// everything → Deploy.
//
// Then attach your bucket (Workers → lineup-design → Settings → Bindings → Add →
// R2 bucket):
//   Variable name   LINEUP
//   R2 bucket       metsxmfanzone-assets
//
//   GET  /design   public: the saved design (the website reads this)
//   PUT  /design   admin sign-in required: save the design
//
// Admin calls need your signed-in admin session (same check as the drafts-api Worker).

const DEFAULT_SUPABASE_URL = "https://rdmrxeplasttewtlfetc.supabase.co";
// Publishable (public) key of the MetsXMFanZone-app project; override with SUPABASE_ANON_KEY if it ever rotates.
const DEFAULT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkbXJ4ZXBsYXN0dGV3dGxmZXRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NTIyNjAsImV4cCI6MjA3NzMyODI2MH0.P5msjdR8tgbx-rL2ifeSjqW1jvFzKtPNT4oapJIAkJA";

const KEY = "lineup/design.json";
const ADMIN_CACHE_MS = 60_000;
const MAX_BYTES = 40_000;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization",
};

const json = (data, status = 200, cache = "no-store") =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": cache },
  });

const adminCache = new Map();

async function isAdmin(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return false;

  const cached = adminCache.get(token);
  if (cached && cached.exp > Date.now()) return cached.ok;

  const base = String(env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/+$/, "");
  const anon = env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
  const headers = { apikey: anon, Authorization: `Bearer ${token}` };

  let ok = false;
  try {
    const u = await fetch(`${base}/auth/v1/user`, { headers });
    if (u.ok) {
      const user = await u.json();
      if (user?.id) {
        const r = await fetch(
          `${base}/rest/v1/user_roles?select=role&user_id=eq.${encodeURIComponent(user.id)}&role=eq.admin&limit=1`,
          { headers }
        );
        if (r.ok) {
          const rows = await r.json();
          ok = Array.isArray(rows) && rows.length > 0;
        }
      }
    }
  } catch {
    ok = false;
  }

  if (adminCache.size > 200) adminCache.clear();
  adminCache.set(token, { ok, exp: Date.now() + ADMIN_CACHE_MS });
  return ok;
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });

    try {
      const url = new URL(request.url);
      const path = url.pathname.replace(/\/+$/, "") || "/";

      if (path === "/") return json({ ok: true, service: "lineup-design" });
      if (!env.LINEUP) return json({ error: "Worker is missing its R2 binding named LINEUP" }, 500);

      if (path === "/design") {
        if (request.method === "GET") {
          const obj = await env.LINEUP.get(KEY);
          if (!obj) return json({ design: null }, 200, "public, max-age=60");
          return json({ design: await obj.json() }, 200, "public, max-age=60");
        }
        if (request.method === "PUT") {
          if (!(await isAdmin(request, env))) return json({ error: "Admin sign-in required" }, 401);
          const text = await request.text();
          if (text.length > MAX_BYTES) return json({ error: "Design is too large" }, 413);
          let body;
          try {
            body = JSON.parse(text);
          } catch {
            return json({ error: "Invalid JSON" }, 400);
          }
          if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "Design must be an object" }, 400);
          body.updated_at = new Date().toISOString();
          await env.LINEUP.put(KEY, JSON.stringify(body), { httpMetadata: { contentType: "application/json" } });
          return json({ ok: true, updated_at: body.updated_at });
        }
        return json({ error: "GET or PUT only" }, 405);
      }

      return json({ error: "Not found" }, 404);
    } catch (err) {
      return json({ error: "Something went wrong" }, 500);
    }
  },
};
