// Serves /blog. The page itself is still the React app, but the latest
// articles are written into the HTML as plain links first. Google reads the
// raw HTML before it runs any JavaScript, and without these links the /blog
// page (and the home page) gave it nothing to follow to the articles, so it
// only found them through the sitemap and crawled them rarely. React replaces
// this list as soon as the app starts, so visitors see the normal blog page.
import { SITE_URL, fetchPublishedPosts, escapeHtml, cleanText, cleanCategory } from "./_lib/article.js";

const LIMIT = 60;

async function loadShell(req) {
  const host = req.headers["x-forwarded-host"] || req.headers.host || "metsxmfanzone.com";
  const proto = req.headers["x-forwarded-proto"] || "https";
  // Built copy of the /blog page (title, description, canonical for /blog).
  const res = await fetch(`${proto}://${host}/blog-shell`, {
    headers: { "user-agent": "internal-prerender" },
    signal: AbortSignal.timeout(4000),
  });
  if (res.ok) return await res.text();
  throw new Error("Shell load failed");
}

function fmtDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "America/New_York" });
}

export function renderList(posts) {
  const items = posts
    .filter((p) => p && p.slug && !/\s/.test(String(p.slug)))
    .map((p) => {
      const url = `${SITE_URL}/blog/${encodeURIComponent(String(p.slug).trim())}`;
      const title = escapeHtml(cleanText(p.title));
      const excerpt = p.excerpt ? `<p style="margin:.2rem 0 0;color:#c3d0e6">${escapeHtml(cleanText(p.excerpt))}</p>` : "";
      const cat = p.category ? `${escapeHtml(cleanCategory(p.category))} · ` : "";
      const when = p.published_at
        ? `<small style="color:#8fa3c2">${cat}<time datetime="${escapeHtml(p.published_at)}">${fmtDate(p.published_at)}</time></small>`
        : "";
      return `<li style="margin:0 0 1.2rem"><a href="${url}" style="color:#ff8a4d;font-weight:700;font-size:1.1rem">${title}</a><br>${when}${excerpt}</li>`;
    })
    .join("");
  return `<main id="blog-ssr" style="max-width:740px;margin:0 auto;padding:2rem 1rem;color:#e8eef9;font-family:system-ui,sans-serif;line-height:1.5"><h1>Mets News, Analysis &amp; Trade Rumors</h1><ul style="list-style:none;padding:0">${items}</ul><p><a href="${SITE_URL}/" style="color:#ff8a4d">MetsXMFanZone home</a></p></main>`;
}

export default async function handler(req, res) {
  let shell;
  try {
    shell = await loadShell(req);
  } catch {
    // Never fall back to another page's shell: it would carry that page's
    // title and canonical. Ask crawlers to retry instead.
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Retry-After", "120");
    res.status(503).send("Temporarily unavailable");
    return;
  }

  let list = "";
  try {
    // Articles live in Cloudflare D1, read through the articles Worker (newest first, published only).
    const rows = await fetchPublishedPosts({ limit: LIMIT, fields: "card" });
    if (Array.isArray(rows) && rows.length) list = renderList(rows);
  } catch {
    // Database unreachable: still serve the normal blog page.
  }

  const html = list ? shell.replace("<!--app-html-->", () => list) : shell;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", list ? "public, max-age=0, s-maxage=300, stale-while-revalidate=600" : "no-store");
  res.status(200).send(html);
}
