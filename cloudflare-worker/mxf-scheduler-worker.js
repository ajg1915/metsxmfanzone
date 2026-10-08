// mxf-scheduler — Cloudflare Worker for MetsXMFanZone
// Runs the site's timed jobs on Cloudflare instead of Supabase's scheduler, and
// only touches Supabase when there is real work to do.
//
// Every 2 minutes:
//   1. One call to Supabase (scheduler_flags) asks "is anything due?"
//        - a live event needs to start or end → runs the auto-stream-status function
//        - emails are waiting in the queue → runs the process-email-queue function
//   2. Mets games (straight from MLB, no Supabase) → runs auto-game-alerts only
//      when a Mets game is about to start, just started, or just finished.
// Every 10 minutes:
//   3. New published blog posts become hero slides on the home page (one for visitors,
//      one for members), newest first. Keeps the 5 newest automatic slides per audience
//      and switches a slide off when its post is unpublished. Slides made by hand in
//      Hero Management are never touched.
//
// SETUP (Cloudflare dashboard → Workers & Pages → mxf-scheduler):
//   Settings → Variables and Secrets:
//     SUPABASE_URL               (Text)   https://rdmrxeplasttewtlfetc.supabase.co
//     SUPABASE_SERVICE_ROLE_KEY  (Secret) Supabase → Project Settings → API Keys → service_role
//   Settings → Triggers → Cron Triggers → Add:  */2 * * * *
//
// Visiting the worker's URL shows what the last run did (no secrets, no actions).

const METS_ID = 121;
const ET = "America/New_York";

let lastRun = null; // shown on GET, per worker instance
const alerted = new Set(); // "gamePk:trigger" already sent by this instance

// ---------- Supabase helpers ----------
function sb(env) {
  const url = String(env.SUPABASE_URL || "").replace(/\/+$/, "");
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  return {
    rpc: async (fn, args = {}) => {
      const r = await fetch(`${url}/rest/v1/rpc/${fn}`, { method: "POST", headers, body: JSON.stringify(args) });
      if (!r.ok) throw new Error(`rpc ${fn} ${r.status}: ${(await r.text()).slice(0, 200)}`);
      return r.json();
    },
    fn: async (name, body = {}) => {
      const r = await fetch(`${url}/functions/v1/${name}`, { method: "POST", headers, body: JSON.stringify(body) });
      return { status: r.status, body: (await r.text()).slice(0, 300) };
    },
    get: async (path) => {
      const r = await fetch(`${url}/rest/v1/${path}`, { headers });
      if (!r.ok) throw new Error(`get ${path.split("?")[0]} ${r.status}: ${(await r.text()).slice(0, 200)}`);
      return r.json();
    },
    insert: async (table, rows) => {
      const r = await fetch(`${url}/rest/v1/${table}`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify(rows) });
      if (!r.ok) throw new Error(`insert ${table} ${r.status}: ${(await r.text()).slice(0, 200)}`);
      return rows.length;
    },
    patch: async (path, body) => {
      const r = await fetch(`${url}/rest/v1/${path}`, { method: "PATCH", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error(`patch ${path.split("?")[0]} ${r.status}: ${(await r.text()).slice(0, 200)}`);
    },
    upsert: async (table, rows, onConflict) => {
      const r = await fetch(`${url}/rest/v1/${table}?on_conflict=${onConflict}`, {
        method: "POST",
        headers: { ...headers, Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(rows),
      });
      if (!r.ok) throw new Error(`upsert ${table} ${r.status}: ${(await r.text()).slice(0, 200)}`);
      return rows.length;
    },
  };
}

const etDate = (d = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: ET, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

// ---------- 1. Streams + email queue ----------
async function runDueWork(api) {
  const flags = await api.rpc("scheduler_flags");
  const out = { flags };
  if (flags.streams_due || flags.streams_to_end) {
    out.autoStreamStatus = await api.fn("auto-stream-status");
  }
  if (Number(flags.email_queue) > 0) {
    out.emailQueue = await api.fn("process-email-queue");
  }
  return out;
}

// ---------- 2. Mets game alerts (MLB direct) ----------
// Mirrors the windows used by auto-game-alerts, but only calls it at the moment
// a window opens instead of every few minutes all day.
async function runMetsAlerts(api, now = Date.now()) {
  const day = etDate(new Date(now));
  const r = await fetch(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=${METS_ID}&date=${day}`);
  if (!r.ok) return { mlb: r.status };
  const data = await r.json();
  const games = (data.dates && data.dates[0] && data.dates[0].games) || [];
  if (!games.length) return { games: 0 };

  const calls = [];
  for (const g of games) {
    const mins = (Date.parse(g.gameDate) - now) / 60000;
    const state = g.status && g.status.abstractGameState; // Preview | Live | Final
    const want = [];
    if (state === "Preview") {
      if (mins >= 120 && mins < 122) want.push("pregame");
      if (mins >= 20 && mins < 22) want.push("pregame_20min");
      if (mins >= 4 && mins < 6) want.push("pregame_5min");
    }
    if (state === "Live" && mins > -45) want.push("game_live");
    if (state === "Final" && mins > -360) want.push("final_score");
    for (const trigger of want) {
      const id = `${g.gamePk}:${trigger}`;
      if (alerted.has(id)) continue; // the function also de-duplicates per day
      alerted.add(id);
      calls.push({ trigger, ...(await api.fn("auto-game-alerts", { triggerType: trigger })) });
    }
  }
  return { games: games.length, calls };
}

// ---------- 3. Blog posts → hero slides ----------
const HERO_KEEP = 5;
const AUTO = "auto_blog";

const isLive = (p) => p.published === true && p.is_draft === false && (p.approval_status || "approved") === "approved";

async function runBlogHero(api, now = new Date()) {
  const since = new Date(now.getTime() - 3 * 86400000).toISOString();
  const posts = await api.get(
    `blog_posts?select=id,title,slug,excerpt,featured_image_url,published,is_draft,approval_status` +
      `&published=eq.true&is_draft=eq.false&approval_status=eq.approved&published_at=gte.${since}&order=published_at.asc&limit=20`,
  );
  const out = { posts: posts.length, created: 0, switchedOff: 0 };

  if (posts.length) {
    const ids = posts.map((p) => p.id).join(",");
    const have = await api.get(`hero_slides?select=blog_post_id,is_for_members&blog_post_id=in.(${ids})`);
    const haveSet = new Set(have.map((h) => `${h.blog_post_id}:${h.is_for_members}`));
    const todo = [];
    for (const p of posts) for (const aud of [false, true]) if (!haveSet.has(`${p.id}:${aud}`)) todo.push({ p, aud });

    if (todo.length) {
      // oldest first, each new slide goes in front of everything else for its audience
      const first = {};
      for (const aud of [false, true]) {
        const r = await api.get(`hero_slides?select=display_order&is_for_members=eq.${aud}&order=display_order.asc&limit=1`);
        first[aud] = r.length && r[0].display_order != null ? r[0].display_order : 1;
      }
      const rows = todo.map(({ p, aud }) => {
        first[aud] -= 1;
        const desc = (p.excerpt || "").trim() || p.title.trim();
        return {
          title: p.title.trim(), description: desc, image_url: p.featured_image_url || null,
          link_url: `/blog/${p.slug}`, link_text: "Read Article", blog_post_id: p.id,
          display_order: first[aud], is_for_members: aud, published: true, show_watch_live: true,
          show_reminder: false, is_ai_generated: false, ai_source_type: AUTO,
        };
      });
      await api.insert("hero_slides", rows);
      out.created = rows.length;
    }
  }

  // Keep the newest few automatic slides on; switch off older ones and ones whose post is no longer live.
  const auto = await api.get(
    `hero_slides?select=id,blog_post_id,is_for_members,created_at&ai_source_type=eq.${AUTO}&published=eq.true&order=created_at.desc&limit=100`,
  );
  if (auto.length) {
    const postIds = [...new Set(auto.map((a) => a.blog_post_id).filter(Boolean))].join(",");
    const state = postIds ? await api.get(`blog_posts?select=id,published,is_draft,approval_status&id=in.(${postIds})`) : [];
    const liveIds = new Set(state.filter(isLive).map((x) => x.id));
    const seen = { true: 0, false: 0 };
    const off = [];
    for (const a of auto) {
      if (!a.blog_post_id || !liveIds.has(a.blog_post_id)) { off.push(a.id); continue; }
      if (++seen[a.is_for_members] > HERO_KEEP) off.push(a.id);
    }
    if (off.length) {
      await api.patch(`hero_slides?id=in.(${off.join(",")})`, { published: false });
      out.switchedOff = off.length;
    }
  }
  return out;
}

// ---------- entry points ----------
async function tick(env, when = new Date()) {
  const api = sb(env);
  const result = { at: when.toISOString() };
  const step = async (name, fn) => {
    try { result[name] = await fn(); } catch (e) { result[name] = { error: String((e && e.message) || e) }; }
  };
  await step("due", () => runDueWork(api));
  await step("mets", () => runMetsAlerts(api, when.getTime()));
  // every run (cron is every 2 minutes), so a new post reaches the hero within about 2 minutes
  await step("blogHero", () => runBlogHero(api, when));
  lastRun = result;
  return result;
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(tick(env, new Date(event.scheduledTime)));
  },
  async fetch() {
    return new Response(JSON.stringify({ worker: "mxf-scheduler", lastRun }, null, 2), {
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  },
};
