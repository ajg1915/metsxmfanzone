// Live XML sitemap: /sitemap.xml
// Main pages come from Admin → SEO Settings (seo_settings table): a page is
// listed when "Include in sitemap" is on and robots doesn't say noindex.
// MAIN_PAGES below is only a fallback if that table can't be read.
// Built on every request (cached ~5 min), so newly published posts appear
// right away without a redeploy. Lists only pages worth ranking; small help
// and utility pages are left out on purpose so Google spends its crawl
// budget on the content that matters. Unlisted pages are still crawlable.
import { SUPABASE_URL, SUPABASE_ANON_KEY, SITE_URL } from "./_lib/article.js";

const MAIN_PAGES = [
  "/",
  "/blog",
  "/community",
  "/podcast",
  "/mets-game-recaps",
  "/mets-schedule-2026",
  "/mets-scores",
  "/mets-gamecast",
  "/mets-roster",
  "/mets-history",
  "/gameday-live",
  "/replay-games",
  "/video-gallery",
  "/gallery",
  "/tv",
  "/mlb-network",
  "/espn-network",
  "/pix11-network",
  "/msg-network",
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
];

function xmlEscape(input) {
  return String(input ?? "").replace(
    /[&<>"']/g,
    (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[m] || m,
  );
}

async function fetchPosts() {
  const url =
    `${SUPABASE_URL}/rest/v1/blog_posts` +
    `?select=slug,published_at,updated_at` +
    `&published=eq.true&order=published_at.desc&limit=5000`;
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}`);
  const rows = await res.json();
  return Array.isArray(rows) ? rows : [];
}

async function fetchManagedPages() {
  const url =
    `${SUPABASE_URL}/rest/v1/seo_settings` +
    `?select=page_path,sitemap_priority,robots,updated_at` +
    `&include_in_sitemap=eq.true&order=sitemap_priority.desc,page_path.asc`;
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}`);
  const rows = await res.json();
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

function urlEntry(loc, lastmod, priority) {
  const pr = priority != null && !Number.isNaN(Number(priority)) ? `<priority>${Number(priority).toFixed(1)}</priority>` : "";
  return `  <url><loc>${xmlEscape(loc)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}${pr}</url>`;
}

export default async function handler(req, res) {
  let posts = [];
  let postsOk = true;
  try {
    posts = await fetchPosts();
  } catch {
    postsOk = false; // still serve the main pages rather than an error
  }

  let pages = [];
  let pagesOk = true;
  try {
    pages = await fetchManagedPages();
  } catch {
    pagesOk = false;
  }
  if (!pagesOk || pages.length === 0) {
    pages = MAIN_PAGES.map((path) => ({ path, priority: null, updated: null }));
  }

  const seen = new Set();
  const lines = [];
  for (const pg of pages) {
    const loc = pg.path === "/" ? `${SITE_URL}/` : `${SITE_URL}${pg.path}`;
    if (seen.has(loc)) continue;
    seen.add(loc);
    lines.push(urlEntry(loc, null, pg.priority));
  }
  for (const p of posts) {
    const slug = String(p?.slug ?? "").trim();
    if (!slug || /\s/.test(slug)) continue;
    const loc = `${SITE_URL}/blog/${encodeURIComponent(slug)}`;
    if (seen.has(loc)) continue;
    seen.add(loc);
    const stamp = p.updated_at || p.published_at;
    lines.push(urlEntry(loc, stamp ? new Date(stamp).toISOString() : null));
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
