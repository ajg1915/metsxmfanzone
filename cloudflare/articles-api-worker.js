// articles-api — Cloudflare Worker for MetsXMFanZone articles.
//
// Since Nov 2026 every article lives in the Cloudflare D1 database "metsxm-articles"
// (table blog_posts), not in Supabase. This Worker is the one door to it:
// the website, the admin and writer pages, the sitemaps and the RSS feeds all read and
// write articles through here. Sign-in still uses the site's normal (Supabase) login.
//
// Bindings (see articles-api.wrangler.toml):
//   DB   D1 database metsxm-articles
// Optional variables: SUPABASE_URL / SUPABASE_ANON_KEY (override the defaults below).
//
// Public (no sign-in, published articles only):
//   GET /posts?limit=&offset=&category=&exclude=&since=&until=&date_field=&order=&fields=card|full|seo
//   GET /posts/count?since=&until=&date_field=
//   GET /posts/<slug>
//
// Signed in (admin: everything; writer: only their own articles, and cannot publish or delete):
//   GET    /manage/posts?mine=1&status=pending|approved|rejected|published|unpublished&limit=&fields=
//   GET    /manage/posts/count?since=&until=&date_field=&published=
//   GET    /manage/posts/<id>
//   GET    /manage/slug-available?slug=&exclude=<id>
//   POST   /manage/posts                 create
//   PATCH  /manage/posts/<id>            change fields
//   DELETE /manage/posts/<id>            admin only
//
// Every 5 minutes (cron) articles whose scheduled_publish_at has passed are published.

const DEFAULT_SUPABASE_URL = "https://rdmrxeplasttewtlfetc.supabase.co";
// Publishable (public) key of the MetsXMFanZone app project.
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkbXJ4ZXBsYXN0dGV3dGxmZXRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NTIyNjAsImV4cCI6MjA3NzMyODI2MH0.P5msjdR8tgbx-rL2ifeSjqW1jvFzKtPNT4oapJIAkJA";

const AUTH_CACHE_MS = 60_000;
const MAX_LIMIT = 500;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization",
  "Access-Control-Max-Age": "86400",
};

const json = (data, status = 200, cache = "no-store") =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json; charset=utf-8", "Cache-Control": cache },
  });

const PUBLIC_CACHE = "public, max-age=30, s-maxage=60, stale-while-revalidate=300";

// ---------- columns ----------
const ALL_COLUMNS = [
  "id", "user_id", "title", "slug", "content", "excerpt", "featured_image_url", "audio_url", "category", "tags",
  "published", "published_at", "created_at", "updated_at", "scheduled_publish_at", "is_draft", "approval_status",
  "meta_description",
];
const FIELD_SETS = {
  // lists and cards
  card: ["id", "user_id", "title", "slug", "excerpt", "featured_image_url", "category", "tags", "published", "published_at", "created_at", "updated_at", "scheduled_publish_at", "is_draft", "approval_status", "meta_description"],
  // sitemaps and feeds that need no body
  seo: ["id", "title", "slug", "excerpt", "featured_image_url", "category", "tags", "published_at", "created_at", "updated_at", "meta_description"],
  full: ALL_COLUMNS,
};
const DATE_FIELDS = new Set(["published_at", "created_at", "updated_at"]);
const STATUSES = new Set(["pending", "approved", "rejected"]);

// Fields a signed-in editor may send; everything else is ignored.
const EDITABLE = new Set([
  "title", "slug", "content", "excerpt", "featured_image_url", "audio_url", "category", "tags", "published",
  "published_at", "scheduled_publish_at", "is_draft", "approval_status", "meta_description", "user_id", "id", "created_at",
]);

const nowIso = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();
const validSlug = (s) => typeof s === "string" && /^[a-z0-9][a-z0-9-]{0,199}$/.test(s);
const validId = (s) => typeof s === "string" && /^[A-Za-z0-9-]{1,80}$/.test(s);

function toIso(v) {
  if (v === null || v === undefined || v === "") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/** D1 row -> the same shape the site used to get from Supabase. */
function rowOut(r) {
  if (!r) return r;
  const out = { ...r };
  if ("tags" in out) {
    try {
      const t = JSON.parse(out.tags || "[]");
      out.tags = Array.isArray(t) ? t : [];
    } catch {
      out.tags = [];
    }
  }
  if ("published" in out) out.published = !!out.published;
  if ("is_draft" in out) out.is_draft = !!out.is_draft;
  return out;
}

function columnsFor(fields) {
  const set = FIELD_SETS[fields] || FIELD_SETS.card;
  return set.join(", ");
}

function intParam(url, name, def, max) {
  const n = parseInt(url.searchParams.get(name) || "", 10);
  if (!Number.isFinite(n) || n < 0) return def;
  return Math.min(n, max);
}

/** Shared WHERE pieces for date range / category / exclude filters. */
function filters(url, where, params) {
  const dateField = DATE_FIELDS.has(url.searchParams.get("date_field")) ? url.searchParams.get("date_field") : "published_at";
  const since = toIso(url.searchParams.get("since"));
  const until = toIso(url.searchParams.get("until"));
  if (since) {
    where.push(`${dateField} >= ?`);
    params.push(since);
  }
  if (until) {
    where.push(`${dateField} <= ?`);
    params.push(until);
  }
  const category = url.searchParams.get("category");
  if (category) {
    where.push("category = ?");
    params.push(category);
  }
  const exclude = url.searchParams.get("exclude");
  if (exclude) {
    where.push("id <> ?");
    params.push(exclude);
  }
  const order = DATE_FIELDS.has(url.searchParams.get("order")) ? url.searchParams.get("order") : dateField;
  return { orderBy: `${order} DESC, created_at DESC` };
}

// ---------- sign-in check (Supabase login + user_roles) ----------
const authCache = new Map();

async function whoIs(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return null;

  const cached = authCache.get(token);
  if (cached && cached.exp > Date.now()) return cached.who;

  const base = String(env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/+$/, "");
  const anon = env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
  const headers = { apikey: anon, Authorization: `Bearer ${token}` };

  let who = null;
  try {
    const u = await fetch(`${base}/auth/v1/user`, { headers });
    if (u.ok) {
      const user = await u.json();
      if (user?.id) {
        const r = await fetch(
          `${base}/rest/v1/user_roles?select=role&user_id=eq.${encodeURIComponent(user.id)}&role=in.(admin,writer)`,
          { headers },
        );
        const rows = r.ok ? await r.json() : [];
        const roles = new Set((Array.isArray(rows) ? rows : []).map((x) => x.role));
        if (roles.has("admin")) who = { id: user.id, role: "admin" };
        else if (roles.has("writer")) who = { id: user.id, role: "writer" };
        else who = { id: user.id, role: "member" };
      }
    }
  } catch {
    who = null;
  }
  if (authCache.size > 500) authCache.clear();
  authCache.set(token, { who, exp: Date.now() + AUTH_CACHE_MS });
  return who;
}

// ---------- public routes ----------
async function listPublic(env, url) {
  const where = ["published = 1"];
  const params = [];
  const { orderBy } = filters(url, where, params);
  const limit = intParam(url, "limit", 50, MAX_LIMIT);
  const offset = intParam(url, "offset", 0, 100000);
  const fields = url.searchParams.get("fields") || "card";
  const { results } = await env.DB.prepare(
    `SELECT ${columnsFor(fields)} FROM blog_posts WHERE ${where.join(" AND ")} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
  )
    .bind(...params, limit, offset)
    .all();
  return json({ posts: results.map(rowOut) }, 200, PUBLIC_CACHE);
}

async function countPublic(env, url) {
  const where = ["published = 1"];
  const params = [];
  filters(url, where, params);
  const row = await env.DB.prepare(`SELECT COUNT(*) AS n FROM blog_posts WHERE ${where.join(" AND ")}`)
    .bind(...params)
    .first();
  return json({ count: row?.n || 0 }, 200, PUBLIC_CACHE);
}

async function getPublic(env, slug) {
  const row = await env.DB.prepare(`SELECT ${columnsFor("full")} FROM blog_posts WHERE slug = ? AND published = 1 LIMIT 1`)
    .bind(slug)
    .first();
  if (!row) return json({ error: "Not found" }, 404, "public, max-age=30");
  return json({ post: rowOut(row) }, 200, PUBLIC_CACHE);
}

// ---------- signed-in routes ----------
async function listManage(env, url, who) {
  const where = [];
  const params = [];
  if (who.role !== "admin" || url.searchParams.get("mine") === "1") {
    where.push("user_id = ?");
    params.push(who.id);
  }
  const status = url.searchParams.get("status");
  if (status === "published") where.push("published = 1");
  else if (status === "unpublished") where.push("published = 0");
  else if (STATUSES.has(status)) {
    where.push("approval_status = ?");
    params.push(status);
  }
  filters(url, where, params);
  const order = DATE_FIELDS.has(url.searchParams.get("order")) ? url.searchParams.get("order") : "created_at";
  const limit = intParam(url, "limit", 500, 2000);
  const fields = url.searchParams.get("fields") || "card";
  const sql = `SELECT ${columnsFor(fields)} FROM blog_posts ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY ${order} DESC LIMIT ?`;
  const { results } = await env.DB.prepare(sql).bind(...params, limit).all();
  return json({ posts: results.map(rowOut) });
}

async function countManage(env, url, who) {
  const where = [];
  const params = [];
  if (who.role !== "admin") {
    where.push("user_id = ?");
    params.push(who.id);
  }
  const pub = url.searchParams.get("published");
  if (pub === "true" || pub === "false") where.push(`published = ${pub === "true" ? 1 : 0}`);
  filters(url, where, params);
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM blog_posts ${where.length ? `WHERE ${where.join(" AND ")}` : ""}`,
  )
    .bind(...params)
    .first();
  return json({ count: row?.n || 0 });
}

async function loadById(env, id) {
  return env.DB.prepare(`SELECT ${columnsFor("full")} FROM blog_posts WHERE id = ? LIMIT 1`).bind(id).first();
}

const canTouch = (who, row) => who.role === "admin" || (who.role === "writer" && row.user_id === who.id);

/** Cleans a create/update body. Returns { values } or { error }. */
function readBody(body, who, { creating }) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "Send the article as JSON" };
  const v = {};
  for (const [k, raw] of Object.entries(body)) {
    if (!EDITABLE.has(k) || raw === undefined) continue;
    v[k] = raw;
  }
  for (const k of ["title", "slug", "content", "excerpt", "featured_image_url", "audio_url", "category", "meta_description"]) {
    if (k in v && v[k] !== null && typeof v[k] !== "string") return { error: `${k} must be text` };
  }
  if ("title" in v) {
    v.title = String(v.title || "").trim();
    if (!v.title || v.title.length > 300) return { error: "The title must be 1-300 characters" };
  }
  if ("slug" in v) {
    v.slug = String(v.slug || "").trim().toLowerCase();
    if (!validSlug(v.slug)) return { error: "The URL slug may only use a-z, 0-9 and dashes" };
  }
  if ("content" in v && v.content && v.content.length > 400000) return { error: "The article is too long" };
  if ("tags" in v) {
    const t = v.tags === null ? [] : v.tags;
    if (!Array.isArray(t) || t.length > 40 || t.some((x) => typeof x !== "string" || x.length > 80)) {
      return { error: "Tags must be a list of short words" };
    }
    v.tags = JSON.stringify([...new Set(t.map((x) => x.trim()).filter(Boolean))]);
  }
  for (const k of ["published", "is_draft"]) if (k in v) v[k] = v[k] ? 1 : 0;
  for (const k of ["published_at", "scheduled_publish_at", "created_at"]) {
    if (k in v) {
      const iso = toIso(v[k]);
      if (iso === undefined) return { error: `${k} is not a valid date` };
      v[k] = iso;
    }
  }
  if ("approval_status" in v && v.approval_status !== null && !STATUSES.has(v.approval_status)) {
    return { error: "Unknown approval status" };
  }
  if ("id" in v) {
    if (!creating) delete v.id;
    else if (!validId(v.id)) return { error: "Invalid id" };
  }
  if (!creating) delete v.created_at;

  if (who.role !== "admin") {
    // Writers always write as themselves and can only send work for review.
    delete v.user_id;
    delete v.published_at;
    delete v.scheduled_publish_at;
    v.published = 0;
    if ("approval_status" in v && v.approval_status !== "pending") delete v.approval_status;
  }
  return { values: v };
}

async function slugTaken(env, slug, exceptId) {
  const row = await env.DB.prepare("SELECT id FROM blog_posts WHERE slug = ? AND id <> ? LIMIT 1")
    .bind(slug, exceptId || "")
    .first();
  return !!row;
}

async function createPost(env, request, who) {
  const body = await request.json().catch(() => null);
  const { values: v, error } = readBody(body, who, { creating: true });
  if (error) return json({ error }, 400);
  if (!v.title) return json({ error: "The title is required" }, 400);
  if (!v.slug) return json({ error: "The URL slug is required" }, 400);
  if (await slugTaken(env, v.slug, null)) return json({ error: "That URL slug is already used by another article" }, 409);

  const now = nowIso();
  const row = {
    id: v.id || uuid(),
    user_id: who.role === "admin" && typeof v.user_id === "string" ? v.user_id : who.id,
    title: v.title,
    slug: v.slug,
    content: v.content ?? "",
    excerpt: v.excerpt ?? null,
    featured_image_url: v.featured_image_url ?? null,
    audio_url: v.audio_url ?? null,
    category: v.category ?? null,
    tags: v.tags ?? "[]",
    published: v.published ?? 0,
    published_at: v.published_at ?? null,
    created_at: v.created_at || now,
    updated_at: now,
    scheduled_publish_at: v.scheduled_publish_at ?? null,
    is_draft: v.is_draft ?? 0,
    approval_status: v.approval_status ?? (who.role === "admin" ? null : "pending"),
    meta_description: v.meta_description ?? null,
  };
  if (row.published && !row.published_at) row.published_at = now;
  if (row.published && who.role === "admin" && !row.approval_status) row.approval_status = "approved";

  const cols = Object.keys(row);
  await env.DB.prepare(
    `INSERT INTO blog_posts (${cols.join(", ")}, saved_via, synced_to_supabase) VALUES (${cols.map(() => "?").join(", ")}, ?, 0)`,
  )
    .bind(...cols.map((c) => row[c]), `site-${who.role}`)
    .run();
  return json({ post: rowOut(await loadById(env, row.id)) }, 201);
}

async function updatePost(env, request, who, id) {
  const existing = await loadById(env, id);
  if (!existing) return json({ error: "Article not found" }, 404);
  if (!canTouch(who, existing)) return json({ error: "You can only change your own articles" }, 403);
  if (who.role !== "admin" && existing.published) return json({ error: "This article is live; ask an admin to change it" }, 403);

  const body = await request.json().catch(() => null);
  const { values: v, error } = readBody(body, who, { creating: false });
  if (error) return json({ error }, 400);
  if (v.slug && v.slug !== existing.slug && (await slugTaken(env, v.slug, id))) {
    return json({ error: "That URL slug is already used by another article" }, 409);
  }
  if (who.role === "admin") {
    // Going live for the first time stamps the publish date.
    if (v.published === 1 && !existing.published && !("published_at" in v) && !existing.published_at) v.published_at = nowIso();
  }
  const keys = Object.keys(v);
  if (!keys.length) return json({ post: rowOut(existing) });
  v.updated_at = nowIso();
  const sets = Object.keys(v);
  await env.DB.prepare(`UPDATE blog_posts SET ${sets.map((k) => `${k} = ?`).join(", ")} WHERE id = ?`)
    .bind(...sets.map((k) => v[k]), id)
    .run();
  return json({ post: rowOut(await loadById(env, id)) });
}

async function deletePost(env, who, id) {
  if (who.role !== "admin") return json({ error: "Only an admin can delete articles" }, 403);
  const existing = await loadById(env, id);
  if (!existing) return json({ error: "Article not found" }, 404);
  // Keep a copy of every deleted article so nothing is ever lost by a wrong tap.
  await env.DB.batch([
    env.DB.prepare(
      "INSERT OR REPLACE INTO deleted_blog_posts (id, deleted_at, deleted_by, row_json) VALUES (?, ?, ?, ?)",
    ).bind(id, nowIso(), who.id, JSON.stringify(existing)),
    env.DB.prepare("DELETE FROM blog_posts WHERE id = ?").bind(id),
  ]);
  return json({ deleted: id });
}

// ---------- scheduled publishing ----------
export async function publishDue(env, now = new Date()) {
  const iso = now.toISOString();
  const { results } = await env.DB.prepare(
    "SELECT id, title, slug FROM blog_posts WHERE published = 0 AND scheduled_publish_at IS NOT NULL AND scheduled_publish_at <= ?",
  )
    .bind(iso)
    .all();
  if (!results.length) return { published: 0 };
  await env.DB.batch(
    results.map((p) =>
      env.DB.prepare(
        "UPDATE blog_posts SET published = 1, published_at = ?, is_draft = 0, approval_status = 'approved', updated_at = ? WHERE id = ?",
      ).bind(iso, iso, p.id),
    ),
  );
  return { published: results.length, posts: results };
}

// ---------- router ----------
export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
    try {
      const url = new URL(request.url);
      const path = url.pathname.replace(/\/+$/, "") || "/";
      if (path === "/") return json({ ok: true, service: "articles-api" });
      if (!env.DB) return json({ error: "Worker is missing its D1 binding named DB" }, 500);

      // Public
      if (path === "/posts" || path.startsWith("/posts/")) {
        if (request.method !== "GET") return json({ error: "GET only" }, 405);
        if (path === "/posts") return await listPublic(env, url);
        if (path === "/posts/count") return await countPublic(env, url);
        const slug = decodeURIComponent(path.slice("/posts/".length));
        if (!slug || slug.length > 300) return json({ error: "Not found" }, 404);
        return await getPublic(env, slug);
      }

      // Signed in
      if (path.startsWith("/manage/")) {
        const who = await whoIs(request, env);
        if (!who) return json({ error: "Sign-in required" }, 401);
        if (who.role !== "admin" && who.role !== "writer") return json({ error: "Writers and admins only" }, 403);

        if (path === "/manage/slug-available") {
          const slug = String(url.searchParams.get("slug") || "").toLowerCase();
          if (!validSlug(slug)) return json({ available: false, reason: "invalid" });
          return json({ available: !(await slugTaken(env, slug, url.searchParams.get("exclude"))) });
        }
        if (path === "/manage/posts") {
          if (request.method === "GET") return await listManage(env, url, who);
          if (request.method === "POST") return await createPost(env, request, who);
          return json({ error: "Method not allowed" }, 405);
        }
        if (path === "/manage/posts/count") {
          if (request.method !== "GET") return json({ error: "GET only" }, 405);
          return await countManage(env, url, who);
        }
        const m = path.match(/^\/manage\/posts\/([^/]+)$/);
        if (m) {
          const id = decodeURIComponent(m[1]);
          if (!validId(id)) return json({ error: "Invalid id" }, 400);
          if (request.method === "GET") {
            const row = await loadById(env, id);
            if (!row) return json({ error: "Article not found" }, 404);
            if (!canTouch(who, row)) return json({ error: "You can only open your own articles" }, 403);
            return json({ post: rowOut(row) });
          }
          if (request.method === "PATCH") return await updatePost(env, request, who, id);
          if (request.method === "DELETE") return await deletePost(env, who, id);
          return json({ error: "Method not allowed" }, 405);
        }
      }
      return json({ error: "Not found" }, 404);
    } catch (e) {
      console.error("articles-api error", e?.message || e);
      return json({ error: "Something went wrong" }, 500);
    }
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(
      publishDue(env).then(
        (r) => r.published && console.log("published scheduled articles", JSON.stringify(r)),
        (e) => console.error("scheduled publish failed", e?.message || e),
      ),
    );
  },
};
