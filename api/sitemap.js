// Live XML sitemap: /sitemap.xml
// Main pages come from Admin → SEO Settings (seo_settings table): a page is
// listed when "Include in sitemap" is on and robots doesn't say noindex.
// MAIN_PAGES below is only a fallback if that table can't be read.
// Built on every request (cached ~5 min), so newly published posts appear
// right away without a redeploy. Lists only pages worth ranking; small help
// and utility pages are left out on purpose so Google spends its crawl
// budget on the content that matters. Unlisted pages are still crawlable.
import { SUPABASE_URL, SITE_URL, supabaseGet, fetchPublishedPosts } from "./_lib/article.js";

const MAIN_PAGES = [
  "/",
  "/blog",
  "/community",
  "/podcast",
  "/mets-game-recaps",
  "/mets-schedule-2027",
  "/mets-scores",
  "/mets-gamecast",
  "/mets-roster",
  "/game-center",
  "/mets-history",
  "/gameday-live",
  "/highlights",
  "/video-gallery",
  "/gallery",
  "/tv",
  "/apple-tv",
  "/prime-video",
  "/pix11-network",
  "/peacock",
  "/msg-plus",
  "/broadcast-schedule",
  "/nl-scores",
  "/matchup/astros",
  "/matchup/bluejays",
  "/matchup/braves",
  "/matchup/cardinals",
  "/matchup/nationals",
  "/matchup/redsox",
  "/matchup/yankees",
  "/pricing",
  "/help-center",
  "/faqs",
  "/contact",
  "/whats-new",
  "/metsxmfanzone",
  "/shop",
  "/merch",
  "/game-events",
  "/spring-training-live",
];

// URLs that redirect elsewhere, or are thin utility pages, must not be in the
// sitemap (Google reports redirected sitemap URLs as "Page with redirect").
const REDIRECTED = new Set(["/mets-schedule-2026", "/replay-games", "/mlb-network", "/espn-network", "/msg-network", "/android-app", "/tv-app"]);
const SKIP_PREFIXES = ["/help/"];
const keepInSitemap = (path) => !REDIRECTED.has(path) && !SKIP_PREFIXES.some((x) => path.startsWith(x));

function xmlEscape(input) {
  return String(input ?? "").replace(
    /[&<>"']/g,
    (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[m] || m,
  );
}

async function fetchPosts() {
  return fetchPublishedPosts({ limit: 500, fields: "seo" });
}

async function fetchManagedPages() {
  const url =
    `${SUPABASE_URL}/rest/v1/seo_settings` +
    `?select=page_path,sitemap_priority,robots,updated_at` +
    `&include_in_sitemap=eq.true&order=sitemap_priority.desc,page_path.asc`;
  const rows = await supabaseGet(url);
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((r) => !String(r?.robots ?? "").toLowerCase().includes("noindex"))
    .map((r) => {
      let path = String(r?.page_path ?? "").trim();
      if (!path.startsWith("/")) path = `/${path}`;
      if (path !== "/") path = path.replace(/\/+$/, "");
      return { path, priority: r.sitemap_priority, updated: r.updated_at };
    })
    .filter((r) => /^\/[a-z0-9\-\/]*$/i.test(r.path));
}

// Every entry is written the same way: loc, lastmod (when known), changefreq, priority.
function urlEntry(loc, lastmod, priority, changefreq) {
  const pr = Number(priority);
  return [
    "  <url>",
    `    <loc>${xmlEscape(loc)}</loc>`,
    lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${(Number.isNaN(pr) ? 0.5 : pr).toFixed(1)}</priority>`,
    "  </url>",
  ].filter(Boolean).join("\n");
}

const isoDate = (d) => {
  const t = d ? new Date(d) : null;
  return t && !Number.isNaN(t.getTime()) ? t.toISOString() : null;
};

export default async function handler(req, res) {
  // Both reads run at the same time so a slow database can't push the
  // response past the function time limit.
  const [postsRes, pagesRes] = await Promise.allSettled([fetchPosts(), fetchManagedPages()]);
  const postsOk = postsRes.status === "fulfilled"; // still serve the main pages rather than an error
  const pagesOk = pagesRes.status === "fulfilled";
  let posts = postsOk ? postsRes.value : [];
  let pages = pagesOk ? pagesRes.value : [];
  if (!pagesOk || pages.length === 0) {
    pages = MAIN_PAGES.map((path) => ({ path, priority: null, updated: null }));
  }

  const seen = new Set();
  const lines = [];
  // Newest article first, so the list reads top to bottom by date.
  posts = [...posts].sort((a, b) => new Date(b?.published_at || b?.updated_at || 0) - new Date(a?.published_at || a?.updated_at || 0));
  const newest = isoDate(posts[0]?.published_at || posts[0]?.updated_at);
  // The old 2026 schedule URL now redirects to 2027: make sure 2027 is listed.
  // Always list these (the shops and event pages aren't in the admin SEO list yet).
  for (const must of ["/mets-schedule-2027", "/highlights", "/shop", "/merch", "/game-events", "/spring-training-live", "/podcast", "/blog"]) if (!pages.some((pg) => pg.path === must)) pages.push({ path: must, priority: 0.7, updated: null });
  for (const pg of pages.filter((x) => keepInSitemap(x.path))) {
    const loc = pg.path === "/" ? `${SITE_URL}/` : `${SITE_URL}${pg.path}`;
    if (seen.has(loc)) continue;
    seen.add(loc);
    const isHome = pg.path === "/";
    const priority = pg.priority != null && !Number.isNaN(Number(pg.priority)) ? pg.priority : isHome ? 1.0 : 0.7;
    // Home and the blog index change whenever a new article goes up.
    const fresh = isHome || pg.path === "/blog" ? newest : isoDate(pg.updated);
    lines.push(urlEntry(loc, fresh, priority, isHome || pg.path === "/blog" ? "daily" : "weekly"));
  }
  for (const p of posts) {
    const slug = String(p?.slug ?? "").trim();
    if (!slug || /\s/.test(slug)) continue;
    const loc = `${SITE_URL}/blog/${encodeURIComponent(slug)}`;
    if (seen.has(loc)) continue;
    seen.add(loc);
    // lastmod = the exact date and time the article was published. (updated_at
    // gets touched by bulk edits, which made many posts share one fake date.)
    const stamp = p.published_at || p.updated_at;
    lines.push(urlEntry(loc, isoDate(stamp), 0.6, "monthly"));
  }

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...lines,
    "</urlset>",
  ].join("\n");

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader(
    "Cache-Control",
    postsOk && pagesOk ? "public, max-age=0, s-maxage=300, stale-while-revalidate=600" : "no-store",
  );
  res.status(200).send(xml);
}
