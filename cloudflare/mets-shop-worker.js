// mets-shop — Cloudflare Worker for MetsXMFanZone's Mets Shop (/shop)
// Products and orders live in the D1 database "mets-shop" (not Supabase).
//
// Paste this whole file into: Cloudflare dashboard → Workers & Pages → Create →
// Worker → name it "mets-shop" → Deploy → Edit code → replace everything → Deploy.
//
// Then (Workers → mets-shop → Settings → Bindings → Add):
//   D1 database   Variable name SHOP   Database mets-shop
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

const DEFAULT_SUPABASE_URL = "https://rdmrxeplasttewtlfetc.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkbXJ4ZXBsYXN0dGV3dGxmZXRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NTIyNjAsImV4cCI6MjA3NzMyODI2MH0.P5msjdR8tgbx-rL2ifeSjqW1jvFzKtPNT4oapJIAkJA";
const ADMIN_CACHE_MS = 60_000;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization",
};
const json = (data, status = 200, cache = "no-store") =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": cache } });

const slugify = (s) =>
  String(s).toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/&/g, " and ")
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
