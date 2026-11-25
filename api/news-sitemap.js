// Google News sitemap: /news-sitemap.xml
// Lists articles published in the last 48 hours (Google News only reads those),
// so new posts are discovered within minutes instead of days.
import { SITE_URL, cleanText, fetchPublishedPosts } from "./_lib/article.js";

const PUBLICATION_NAME = "MetsXMFanZone";
const WINDOW_HOURS = 48;

function xmlEscape(input) {
  return String(input ?? "").replace(
    /[&<>"']/g,
    (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[m] || m,
  );
}

async function fetchRecentPosts() {
  const since = new Date(Date.now() - WINDOW_HOURS * 3600 * 1000).toISOString();
  return fetchPublishedPosts({ since, limit: 500, fields: "seo" });
}

export default async function handler(req, res) {
  try {
    const posts = await fetchRecentPosts();
    const urls = posts
      .filter((p) => p.slug && p.published_at)
      .map((p) =>
        [
          "  <url>",
          `    <loc>${xmlEscape(`${SITE_URL}/blog/${encodeURIComponent(p.slug)}`)}</loc>`,
          "    <news:news>",
          "      <news:publication>",
          `        <news:name>${PUBLICATION_NAME}</news:name>`,
          "        <news:language>en</news:language>",
          "      </news:publication>",
          `      <news:publication_date>${xmlEscape(new Date(p.published_at).toISOString())}</news:publication_date>`,
          `      <news:title>${xmlEscape(cleanText(p.title))}</news:title>`,
          "    </news:news>",
          "  </url>",
        ].join("\n"),
      )
      .join("\n");

    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">',
      urls,
      "</urlset>",
    ].join("\n");

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=300, stale-while-revalidate=600");
    res.status(200).send(xml);
  } catch {
    // Valid but empty sitemap rather than a 503: a failed fetch shows up in
    // Search Console as "Couldn't fetch" until Google happens to retry.
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res
      .status(200)
      .send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>');
  }
}
