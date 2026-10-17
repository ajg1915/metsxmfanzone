// drafts-api — Cloudflare Worker for MetsXMFanZone
// Keeps the daily article drafts in your R2 bucket (not Supabase) until you
// approve them in Admin > Drafts.
//
// Paste this whole file into: Cloudflare dashboard → Workers & Pages →
// Create → Worker → name it "drafts-api" → Deploy → Edit code → replace
// everything → Deploy.
//
// Then attach your bucket (Workers → drafts-api → Settings → Bindings → Add →
// R2 bucket):
//   Variable name   DRAFTS
//   R2 bucket       metsxmfanzone-assets
//
// Optional settings (Settings → Variables and Secrets):
//   INGEST_TOKEN   secret. Only needed if the 5am agent will save drafts through
//                  POST /ingest. Without it, /ingest answers "disabled".
//   BRAVE_API_KEY  secret. Free key from https://brave.com/search/api/ (2,000 searches a month).
//                  Only needed for the "Check the whole article on the web" button.
//   SUPABASE_URL / SUPABASE_ANON_KEY   only to override the built-in defaults below.
//
// Where drafts live in the bucket (one small JSON file each):
//   drafts/pending/<id>.json    waiting for you
//   drafts/approved/<id>.json   you approved it (the article itself is then
//                               published to the site by the admin page)
//   drafts/rejected/<id>.json   you rejected it (can be moved back to pending)
// <id> looks like 2026-10-12-the-article-title, so newest sorts first.
//
// Admin calls need your signed-in admin session (the same login as the admin
// area). The Worker checks it with Supabase auth and your admin role, and
// remembers a good answer for 60 seconds so it does not hit Supabase on every tap.
//
//   GET  /drafts?status=pending|approved|rejected   list (no article body)
//   GET  /drafts/counts                             { pending, approved, rejected }
//   GET  /drafts/<id>                               one full draft
//   PUT  /drafts/<id>                               edit a pending draft
//   POST /drafts/<id>/status                        { status, published_post_id? }
//   POST /ingest                                    save a new pending draft (INGEST_TOKEN)
//   POST /check                                     { text, sources[] } originality check against the
//                                                   source articles (nothing is saved)
//   POST /check-web                                 { text } searches the web (Brave Search) for the
//                                                   article's own sentences; needs BRAVE_API_KEY

const DEFAULT_SUPABASE_URL = "https://rdmrxeplasttewtlfetc.supabase.co";
// Publishable (public) key of the MetsXMFanZone-app project; override with SUPABASE_ANON_KEY if it ever rotates.
const DEFAULT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkbXJ4ZXBsYXN0dGV3dGxmZXRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NTIyNjAsImV4cCI6MjA3NzMyODI2MH0.P5msjdR8tgbx-rL2ifeSjqW1jvFzKtPNT4oapJIAkJA";

const STATUSES = ["pending", "approved", "rejected"];
const ADMIN_CACHE_MS = 60_000;
const TIME_ZONE = "America/New_York";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization",
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const keyFor = (status, id) => `drafts/${status}/${id}.json`;
const validId = (id) => /^[a-z0-9][a-z0-9-]{2,140}$/.test(id);

const slugify = (s) =>
  String(s)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90)
    .replace(/-+$/g, "");

const todayET = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date()
  );

const wordCount = (html) => {
  const text = String(html || "").replace(/<[^>]*>/g, " ").replace(/&[a-z#0-9]+;/gi, " ");
  return text.split(/\s+/).filter(Boolean).length;
};

// ---------- field checks ----------
function readFields(body, { requireAll }) {
  const out = {};
  const b = body && typeof body === "object" ? body : {};
  const has = (k) => b[k] !== undefined;

  const str = (k, min, max, label) => {
    if (!has(k)) {
      return requireAll ? `${label} is required` : null;
    }
    if (typeof b[k] !== "string") return `${label} must be text`;
    const v = b[k].trim();
    if (v.length < min) return `${label} is too short`;
    if (v.length > max) return `${label} is too long (max ${max})`;
    out[k] = v;
    return null;
  };

  const errors = [
    str("title", 5, 200, "Title"),
    str("content", 50, 60000, "Article"),
    str("summary", 5, 600, "Summary"),
    str("meta_description", 5, 160, "Google description (160 characters or fewer)"),
  ].filter(Boolean);

  if (has("category")) {
    if (typeof b.category !== "string" || !b.category.trim() || b.category.trim().length > 60) {
      errors.push("Category must be 1-60 characters");
    } else out.category = b.category.trim();
  } else if (requireAll) out.category = "Mets News";

  if (has("tags")) {
    if (!Array.isArray(b.tags) || b.tags.length > 15 || b.tags.some((t) => typeof t !== "string" || t.trim().length > 40)) {
      errors.push("Tags must be a list of up to 15 short tags");
    } else out.tags = [...new Set(b.tags.map((t) => t.trim()).filter(Boolean))];
  } else if (requireAll) errors.push("Tags are required");

  if (has("sources")) {
    if (!Array.isArray(b.sources) || b.sources.length > 20 || b.sources.some((s) => typeof s !== "string" || s.length > 500)) {
      errors.push("Sources must be a list of up to 20 links");
    } else out.sources = b.sources.map((s) => s.trim()).filter(Boolean);
  }

  return { value: out, error: errors.length ? errors.join("; ") : null };
}

// ---------- admin check (Supabase login + admin role) ----------
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

// Compares two strings without leaking where they differ.
async function sameSecret(a, b) {
  const enc = new TextEncoder();
  const [x, y] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(String(a))),
    crypto.subtle.digest("SHA-256", enc.encode(String(b))),
  ]);
  const xa = new Uint8Array(x);
  const ya = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < xa.length; i++) diff |= xa[i] ^ ya[i];
  return diff === 0;
}

// ---------- bucket helpers ----------
async function keysFor(env, status) {
  const keys = [];
  let cursor;
  do {
    const page = await env.DRAFTS.list({ prefix: `drafts/${status}/`, cursor, limit: 1000 });
    for (const o of page.objects) if (o.key.endsWith(".json")) keys.push(o.key);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor && keys.length < 5000);
  return keys;
}

async function readDraft(env, key) {
  const obj = await env.DRAFTS.get(key);
  if (!obj) return null;
  try {
    return JSON.parse(await obj.text());
  } catch {
    return null;
  }
}

async function writeDraft(env, draft) {
  await env.DRAFTS.put(keyFor(draft.status, draft.id), JSON.stringify(draft), {
    httpMetadata: { contentType: "application/json" },
  });
}

async function findDraft(env, id) {
  for (const status of STATUSES) {
    const d = await readDraft(env, keyFor(status, id));
    if (d) return { ...d, status };
  }
  return null;
}

const summaryOf = (d) => ({
  id: d.id,
  title: d.title,
  summary: d.summary,
  category: d.category,
  tags: d.tags || [],
  created_at: d.created_at,
  status: d.status,
  word_count: wordCount(d.content),
});

// ---------- originality check ----------
// Compares an article with the source articles it was written from and reports any
// passages that share long runs of identical words. Free: it runs here, nothing is saved.
const CHECK_MAX_SOURCES = 10;
const CHECK_FETCH_MS = 8000;
const CHECK_MAX_CHARS = 1_500_000;
const SHINGLE = 6; // words per fingerprint
const FLAG_RUN = 8; // a shared run this long (in words) is flagged
const FLAG_OVERLAP = 10; // or this much of the article (percent) overlapping

const safeSourceUrl = (u) => {
  try {
    const x = new URL(String(u).trim());
    if (x.protocol !== "https:" && x.protocol !== "http:") return null;
    const h = x.hostname.toLowerCase();
    if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || h.includes(":") || /^\d+\.\d+\.\d+\.\d+$/.test(h)) {
      return null;
    }
    return x.href;
  } catch {
    return null;
  }
};

const decodeEntities = (s) =>
  s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&[a-z]+;/gi, " ");

const plainText = (html) =>
  decodeEntities(
    String(html || "")
      .replace(/<(script|style|noscript|svg|nav|footer|header|form)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<[^>]*>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();

// Words with their position in the text, lower-cased and without apostrophes.
const wordsWithPositions = (text) => {
  const out = [];
  const re = /[\p{L}\p{N}][\p{L}\p{N}'\u2019]*/gu;
  let m;
  while ((m = re.exec(text))) {
    const norm = m[0].toLowerCase().replace(/['\u2019]/g, "");
    if (norm) out.push({ w: norm, start: m.index, end: m.index + m[0].length });
  }
  return out;
};

async function fetchSourceText(url) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MetsXMFanZone-originality-check)", Accept: "text/html,*/*" },
      redirect: "follow",
      signal: AbortSignal.timeout(CHECK_FETCH_MS),
    });
    if (!res.ok) return null;
    const raw = (await res.text()).slice(0, CHECK_MAX_CHARS);
    const text = /<html|<body|<p[ >]/i.test(raw) ? plainText(raw) : raw;
    return text.length > 200 ? text : null;
  } catch {
    return null;
  }
}

function compareArticle(articleText, sourceTexts) {
  const words = wordsWithPositions(articleText);
  const total = words.length;
  const owner = new Map(); // fingerprint -> index of the first source that has it
  sourceTexts.forEach((t, i) => {
    const sw = wordsWithPositions(t).map((x) => x.w);
    for (let k = 0; k + SHINGLE <= sw.length; k++) {
      const key = sw.slice(k, k + SHINGLE).join(" ");
      if (!owner.has(key)) owner.set(key, i);
    }
  });

  const covered = new Array(total).fill(false);
  const hits = []; // [startWord, sourceIndex] for each matching fingerprint
  for (let i = 0; i + SHINGLE <= total; i++) {
    const key = words
      .slice(i, i + SHINGLE)
      .map((x) => x.w)
      .join(" ");
    if (owner.has(key)) {
      hits.push([i, owner.get(key)]);
      for (let k = i; k < i + SHINGLE; k++) covered[k] = true;
    }
  }

  // Merge neighbouring matches into runs of shared words.
  const runs = [];
  for (const [i, src] of hits) {
    const last = runs[runs.length - 1];
    if (last && i <= last.endWord - SHINGLE + 2) last.endWord = i + SHINGLE - 1;
    else runs.push({ startWord: i, endWord: i + SHINGLE - 1, src });
  }
  const sized = runs.map((r) => ({ ...r, words: r.endWord - r.startWord + 1 }));
  const flagged = sized
    .filter((r) => r.words >= FLAG_RUN)
    .sort((a, b) => b.words - a.words)
    .slice(0, 8)
    .map((r) => ({
      text: articleText.slice(words[r.startWord].start, words[r.endWord].end),
      words: r.words,
      source: r.src,
    }));

  const coveredCount = covered.filter(Boolean).length;
  const overlap = total ? Math.round((coveredCount / total) * 100) : 0;
  const longest = sized.reduce((m, r) => Math.max(m, r.words), 0);
  return {
    level: flagged.length > 0 || overlap >= FLAG_OVERLAP ? "review" : "pass",
    overlap,
    longest_run: longest,
    word_count: total,
    flagged,
  };
}

async function checkOriginality(env, request) {
  const body = await request.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.slice(0, 60000) : "";
  if (text.trim().length < 50) return json({ error: "There is no article text to check" }, 400);
  const asked = Array.isArray(body?.sources) ? body.sources.slice(0, CHECK_MAX_SOURCES) : [];
  const urls = [...new Set(asked.map(safeSourceUrl).filter(Boolean))];
  if (!urls.length) return json({ level: "no_sources", sources_checked: 0, sources_failed: [], flagged: [] });

  const fetched = await Promise.all(urls.map(async (u) => ({ url: u, text: await fetchSourceText(u) })));
  const ok = fetched.filter((f) => f.text);
  const failed = fetched.filter((f) => !f.text).map((f) => f.url);
  if (!ok.length) return json({ level: "no_sources", sources_checked: 0, sources_failed: failed, flagged: [] });

  const result = compareArticle(text, ok.map((f) => f.text));
  return json({
    ...result,
    flagged: result.flagged.map((f) => ({ text: f.text, words: f.words, source: ok[f.source].url })),
    sources_checked: ok.length,
    sources_failed: failed,
    checked_at: new Date().toISOString(),
  });
}

// ---------- web check (Brave Search) ----------
// Takes sentences spread across the article, searches each one in quotes, and reports
// pages whose text shares a long run of words with it. Free on Brave's free plan.
const WEB_MAX_QUERIES = 8;
const WEB_MIN_WORDS = 12;
const WEB_MAX_WORDS = 28; // words of each sentence used in the search
const WEB_MATCH_RUN = 8; // shared words in a row that count as a match
const WEB_GAP_MS = 1100; // Brave's free plan allows one search per second
const OWN_HOSTS = ["metsxmfanzone.com"];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Longest run of words that appears in both lists, in the same order.
function longestSharedRun(a, b) {
  let best = 0;
  let prev = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    const row = new Array(b.length + 1).fill(0);
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        row[j] = prev[j - 1] + 1;
        if (row[j] > best) best = row[j];
      }
    }
    prev = row;
  }
  return best;
}

function pickSentences(text) {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => {
      const n = wordsWithPositions(s).length;
      return n >= WEB_MIN_WORDS;
    });
  if (sentences.length <= WEB_MAX_QUERIES) return sentences;
  const step = sentences.length / WEB_MAX_QUERIES;
  return Array.from({ length: WEB_MAX_QUERIES }, (_, i) => sentences[Math.floor(i * step)]);
}

async function checkWeb(env, request) {
  if (!env.BRAVE_API_KEY) return json({ level: "not_configured" });
  const body = await request.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.slice(0, 60000) : "";
  if (text.trim().length < 50) return json({ error: "There is no article text to check" }, 400);

  const sentences = pickSentences(text);
  if (!sentences.length) return json({ error: "The article has no full sentences to check yet" }, 400);

  const matches = []; // strong: a long run of the sentence appears in the result's text
  const possible = []; // the search returned the page, but its snippet doesn't show the wording
  let searched = 0;
  let stopped = null;

  for (let i = 0; i < sentences.length; i++) {
    if (i > 0) await sleep(WEB_GAP_MS);
    const words = wordsWithPositions(sentences[i]);
    const used = words.slice(0, WEB_MAX_WORDS);
    const phrase = sentences[i].slice(0, used[used.length - 1].end).replace(/["\u201c\u201d]/g, "");
    let res;
    try {
      res = await fetch(
        `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(`"${phrase}"`)}&count=6&safesearch=off`,
        {
          headers: { Accept: "application/json", "X-Subscription-Token": env.BRAVE_API_KEY },
          signal: AbortSignal.timeout(8000),
        }
      );
    } catch {
      stopped = "The search service did not answer";
      break;
    }
    if (res.status === 401 || res.status === 403) return json({ level: "bad_key" });
    if (res.status === 429) {
      stopped = "The free search limit was reached";
      break;
    }
    if (!res.ok) {
      stopped = "The search service had a problem";
      break;
    }
    searched++;
    const data = await res.json().catch(() => null);
    for (const r of data?.web?.results || []) {
      let host = "";
      try {
        host = new URL(r.url).hostname.replace(/^www\./, "");
      } catch {
        continue;
      }
      if (OWN_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) continue;
      const seen = plainText([r.title, r.description, ...(r.extra_snippets || [])].join(" . "));
      const run = longestSharedRun(
        used.map((x) => x.w),
        wordsWithPositions(seen).map((x) => x.w)
      );
      const item = { sentence: sentences[i], url: r.url, title: String(r.title || host).slice(0, 140), words: run };
      if (run >= WEB_MATCH_RUN) matches.push(item);
      else possible.push(item);
    }
  }

  const byUrl = (list) => {
    const seen = new Set();
    return list.filter((m) => (seen.has(m.url + m.sentence) ? false : seen.add(m.url + m.sentence)));
  };
  const strong = byUrl(matches).sort((a, b) => b.words - a.words).slice(0, 8);
  const strongUrls = new Set(strong.map((m) => m.sentence));
  const maybe = byUrl(possible)
    .filter((m) => !strongUrls.has(m.sentence))
    .slice(0, 5);

  return json({
    level: strong.length ? "review" : "pass",
    sentences_checked: searched,
    sentences_total: sentences.length,
    matches: strong,
    possible: maybe,
    stopped,
    checked_at: new Date().toISOString(),
  });
}

// ---------- routes ----------
async function listDrafts(env, url) {
  const status = url.searchParams.get("status") || "pending";
  if (!STATUSES.includes(status)) return json({ error: "Unknown status" }, 400);
  const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "50", 10) || 50, 1), 100);
  const keys = (await keysFor(env, status)).sort().reverse().slice(0, limit);
  const drafts = (await Promise.all(keys.map((k) => readDraft(env, k)))).filter(Boolean);
  return json({ status, drafts: drafts.map((d) => summaryOf({ ...d, status })) });
}

async function counts(env) {
  const [pending, approved, rejected] = await Promise.all(STATUSES.map((s) => keysFor(env, s)));
  return json({ pending: pending.length, approved: approved.length, rejected: rejected.length });
}

async function editDraft(env, id, request) {
  const found = await findDraft(env, id);
  if (!found) return json({ error: "Draft not found" }, 404);
  if (found.status !== "pending") return json({ error: "Only waiting drafts can be edited" }, 409);

  const body = await request.json().catch(() => null);
  const { value, error } = readFields(body, { requireAll: false });
  if (error) return json({ error }, 400);
  if (!Object.keys(value).length) return json({ error: "Nothing to change" }, 400);

  const next = { ...found, ...value, updated_at: new Date().toISOString() };
  await writeDraft(env, next);
  return json({ draft: next });
}

async function moveDraft(env, id, request) {
  const found = await findDraft(env, id);
  if (!found) return json({ error: "Draft not found" }, 404);

  const body = await request.json().catch(() => ({}));
  const to = body?.status;
  if (!STATUSES.includes(to)) return json({ error: "Unknown status" }, 400);
  if (found.status === to) return json({ draft: found });

  const allowed =
    (found.status === "pending" && (to === "approved" || to === "rejected")) ||
    (found.status === "rejected" && to === "pending");
  if (!allowed) return json({ error: `A ${found.status} draft cannot become ${to}` }, 409);

  const now = new Date().toISOString();
  const next = { ...found, status: to, updated_at: now };
  if (to === "approved") {
    next.approved_at = now;
    if (typeof body.published_post_id === "string") next.published_post_id = body.published_post_id.slice(0, 80);
    if (typeof body.published_slug === "string") next.published_slug = body.published_slug.slice(0, 140);
  }
  if (to === "rejected") next.rejected_at = now;

  // Write the new copy first, then remove the old one, so a failure never loses the draft.
  await writeDraft(env, next);
  await env.DRAFTS.delete(keyFor(found.status, id));
  return json({ draft: next });
}

async function ingest(env, request) {
  if (!env.INGEST_TOKEN) return json({ error: "Saving drafts through /ingest is disabled" }, 503);
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token || !(await sameSecret(token, env.INGEST_TOKEN))) return json({ error: "Not allowed" }, 401);

  const body = await request.json().catch(() => null);
  const { value, error } = readFields(body, { requireAll: true });
  if (error) return json({ error }, 400);

  const baseId = `${todayET()}-${slugify(value.title)}`;
  if (!validId(baseId)) return json({ error: "Could not build a draft id from that title" }, 400);

  // Same title already saved (for example the task ran twice): hand back the existing draft.
  for (const status of STATUSES) {
    const existing = await readDraft(env, keyFor(status, baseId));
    if (existing && existing.title === value.title) return json({ id: baseId, duplicate: true, status });
  }

  let id = baseId;
  for (let n = 2; await findDraft(env, id); n++) id = `${baseId}-${n}`;

  const now = new Date().toISOString();
  const draft = {
    id,
    slug: slugify(value.title),
    status: "pending",
    source: "daily-5am-agent",
    created_at: now,
    updated_at: now,
    sources: [],
    ...value,
  };
  await writeDraft(env, draft);
  return json({ id, status: "pending" }, 201);
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });

    try {
      const url = new URL(request.url);
      const path = url.pathname.replace(/\/+$/, "") || "/";

      if (path === "/") return json({ ok: true, service: "drafts-api" });
      if (!env.DRAFTS) return json({ error: "Worker is missing its R2 binding named DRAFTS" }, 500);

      if (path === "/ingest") {
        if (request.method !== "POST") return json({ error: "POST only" }, 405);
        return await ingest(env, request);
      }

      if (path === "/check") {
        if (request.method !== "POST") return json({ error: "POST only" }, 405);
        if (!(await isAdmin(request, env))) return json({ error: "Admin sign-in required" }, 401);
        return await checkOriginality(env, request);
      }

      if (path === "/check-web") {
        if (request.method !== "POST") return json({ error: "POST only" }, 405);
        if (!(await isAdmin(request, env))) return json({ error: "Admin sign-in required" }, 401);
        return await checkWeb(env, request);
      }

      if (path === "/drafts" || path.startsWith("/drafts/")) {
        if (!(await isAdmin(request, env))) return json({ error: "Admin sign-in required" }, 401);

        if (path === "/drafts") {
          if (request.method !== "GET") return json({ error: "GET only" }, 405);
          return await listDrafts(env, url);
        }
        if (path === "/drafts/counts") {
          if (request.method !== "GET") return json({ error: "GET only" }, 405);
          return await counts(env);
        }

        const m = path.match(/^\/drafts\/([^/]+)(\/status)?$/);
        if (!m) return json({ error: "Not found" }, 404);
        const id = decodeURIComponent(m[1]);
        if (!validId(id)) return json({ error: "Invalid draft id" }, 400);

        if (m[2]) {
          if (request.method !== "POST") return json({ error: "POST only" }, 405);
          return await moveDraft(env, id, request);
        }
        if (request.method === "GET") {
          const draft = await findDraft(env, id);
          return draft ? json({ draft }) : json({ error: "Draft not found" }, 404);
        }
        if (request.method === "PUT") return await editDraft(env, id, request);
        return json({ error: "Method not allowed" }, 405);
      }

      return json({ error: "Not found" }, 404);
    } catch {
      return json({ error: "Something went wrong" }, 500);
    }
  },
};
