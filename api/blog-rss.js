// Real RSS 2.0 feed for the blog, served as application/xml so feed readers
// and search engines can fetch it without running JavaScript.
import { SUPABASE_URL, SUPABASE_ANON_KEY, SITE_URL, stripHtml, resolveImage } from "./_lib/article.js";

function xmlEscape(input) {
  return String(input ?? "").replace(
    /[&<>"']/g,
    (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[m] || m,
  );
}

async function fetchPosts() {
  const url =
    `${SUPABASE_URL}/rest/v1/blog_posts` +
    `?select=title,slug,excerpt,content,category,published_at,created_at,featured_image` +
    `&published=eq.true&order=published_at.desc&limit=30`;
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  });
  if (!res.ok) return [];
  const rows = await res.json();
  return Array.isArray(rows) ? rows : [];
}

export default async function handler(req, res) {
  try {
    const posts = await fetchPosts();
    const items = posts
      .map((post) => {
        const link = `${SITE_URL}/blog/${encodeURIComponent(post.slug || "")}`;
        const date = new Date(post.published_at || post.created_at || Date.now()).toUTCString();
        const description = stripHtml(post.excerpt || post.content || "").slice(0, 500);
        const image = post.featured_image ? resolveImage(post.featured_image) : "";
        return [
          "    <item>",
          `      <title>${xmlEscape(post.title || "Untitled")}</title>`,
          `      <link>${xmlEscape(link)}</link>`,
          `      <guid isPermaLink="true">${xmlEscape(link)}</guid>`,
          `      <pubDate>${xmlEscape(date)}</pubDate>`,
          post.category ? `      <category>${xmlEscape(post.category)}</category>` : null,
          `      <description>${xmlEscape(description)}</description>`,
          image ? `      <enclosure url="${xmlEscape(image)}" type="image/jpeg" />` : null,
          "    </item>",
        ]
          .filter(Boolean)
          .join("\n");
      })
      .join("\n");

    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
      "  <channel>",
      "    <title>MetsXMFanZone Blog</title>",
      `    <link>${SITE_URL}/blog</link>`,
      "    <description>Mets news, analysis and trade rumors from MetsXMFanZone.</description>",
      "    <language>en-us</language>",
      `    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>`,
      `    <atom:link href="${SITE_URL}/blog/rss" rel="self" type="application/rss+xml" />`,
      items,
      "  </channel>",
      "</rss>",
    ].join("\n");

    res.setHeader("Content-Type", "application/rss+xml; charset=utf-8");
    res.setHeader("X-Robots-Tag", "noindex, follow");
    res.setHeader(
      "Cache-Control",
      "public, max-age=0, s-maxage=600, stale-while-revalidate=1800",
    );
    res.status(200).send(xml);
  } catch (error) {
    res.setHeader("Content-Type", "application/rss+xml; charset=utf-8");
    res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>MetsXMFanZone Blog</title></channel></rss>');
  }
}
