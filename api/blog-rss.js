// Real RSS 2.0 feed for the blog, served as application/xml so feed readers
// and search engines can fetch it without running JavaScript.
import { SITE_URL, stripHtml, resolveImage, cleanText, cleanCategory, fetchPublishedPosts, sanitizeArticleHtml, escapeHtml } from "./_lib/article.js";

// CDATA can't contain "]]>", so split it if an article ever does.
const cdata = (s) => `<![CDATA[${String(s ?? "").replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
const FEED_URL = `${SITE_URL}/rss.xml`;

function xmlEscape(input) {
  return String(input ?? "").replace(
    /[&<>"']/g,
    (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[m] || m,
  );
}

async function fetchPosts() {
  // Let a database failure surface as a 503 (readers retry) instead of an empty feed
  // (an empty feed makes readers think every article was removed).
  return fetchPublishedPosts({ limit: 500, fields: "full" });
}

export default async function handler(req, res) {
  try {
    const posts = await fetchPosts();
    const items = posts
      .map((post, index) => {
        const link = `${SITE_URL}/blog/${encodeURIComponent(post.slug || "")}`;
        const date = new Date(post.published_at || post.created_at || Date.now()).toUTCString();
        const description = stripHtml(post.excerpt || post.content || "").slice(0, 500);
        const image = post.featured_image_url ? resolveImage(post.featured_image_url) : "";
        const imageType = /\.png(\?|$)/i.test(image) ? "image/png" : /\.webp(\?|$)/i.test(image) ? "image/webp" : "image/jpeg";
        const title = cleanText(post.title) || "Untitled";
        // Full article for feed readers: picture on top, then the story, then a link back.
        const fullHtml = [
          image ? `<p><img src="${escapeHtml(image)}" alt="${escapeHtml(title)}" width="1200" height="630" /></p>` : "",
          sanitizeArticleHtml(post.content) || `<p>${escapeHtml(description)}</p>`,
          `<p><a href="${escapeHtml(link)}">Read it on MetsXMFanZone</a></p>`,
        ].join("\n");
        return [
          "    <item>",
          `      <title>${xmlEscape(title)}</title>`,
          `      <link>${xmlEscape(link)}</link>`,
          `      <guid isPermaLink="true">${xmlEscape(link)}</guid>`,
          `      <pubDate>${xmlEscape(date)}</pubDate>`,
          "      <dc:creator>Anthony Gennaro</dc:creator>",
          cleanCategory(post.category) ? `      <category>${xmlEscape(cleanCategory(post.category))}</category>` : null,
          `      <description>${xmlEscape(description)}</description>`,
          // Full story for the newest 50 (what feed readers show); older ones keep the summary
          // so the feed stays a reasonable size while still listing every article.
          index < 50 ? `      <content:encoded>${cdata(fullHtml)}</content:encoded>` : null,
          image ? `      <media:content url="${xmlEscape(image)}" medium="image" type="${imageType}" />` : null,
          image ? `      <media:thumbnail url="${xmlEscape(image)}" />` : null,
          "    </item>",
        ]
          .filter(Boolean)
          .join("\n");
      })
      .join("\n");

    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:media="http://search.yahoo.com/mrss/">',
      "  <channel>",
      "    <title>MetsXMFanZone — Mets News &amp; Analysis</title>",
      `    <link>${SITE_URL}/blog</link>`,
      "    <description>Original New York Mets news, analysis, trade rumors and game recaps from MetsXMFanZone.</description>",
      "    <language>en-us</language>",
      `    <copyright>© ${new Date().getUTCFullYear()} MetsXMFanZone</copyright>`,
      "    <managingEditor>metsxmfanzone@gmail.com (Anthony Gennaro)</managingEditor>",
      "    <category>Sports</category>",
      "    <ttl>30</ttl>",
      "    <image>",
      `      <url>${SITE_URL}/logo-192.png</url>`,
      "      <title>MetsXMFanZone — Mets News &amp; Analysis</title>",
      `      <link>${SITE_URL}/blog</link>`,
      "    </image>",
      `    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>`,
      `    <atom:link href="${FEED_URL}" rel="self" type="application/rss+xml" />`,
      '    <atom:link href="https://pubsubhubbub.appspot.com/" rel="hub" />',
      items,
      "  </channel>",
      "</rss>",
    ].join("\n");

    res.setHeader("Content-Type", "application/rss+xml; charset=utf-8");
    res.setHeader("X-Robots-Tag", "noindex, follow");
    res.setHeader("Access-Control-Allow-Origin", "*"); // lets the OBS stream bar read the headlines
    res.setHeader(
      "Cache-Control",
      "public, max-age=0, s-maxage=600, stale-while-revalidate=1800",
    );
    res.status(200).send(xml);
  } catch (error) {
    res.setHeader("Content-Type", "application/rss+xml; charset=utf-8");
    res.status(503).setHeader("Retry-After", "300");
    res.send('<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>MetsXMFanZone</title><link>https://metsxmfanzone.com/blog</link><description>Temporarily unavailable</description></channel></rss>');
  }
}
