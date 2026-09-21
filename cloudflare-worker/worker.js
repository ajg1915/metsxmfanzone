/**
 * Cloudflare Worker: Standalone Blog OG Tag Injector
 * --------------------------------------------------
 * Self-contained alternative to blog-og-proxy.js. Queries Supabase REST
 * directly (no edge function dependency).
 *
 * Behavior:
 *   - Non-crawler traffic → pass through to Lovable SPA untouched.
 *   - Crawler hits on /blog/:slug → fetch article from Supabase and return
 *     OG/Twitter-tagged HTML inline.
 *
 * SETUP
 * -----
 * 1. Cloudflare Dashboard → Workers & Pages → Create Worker → paste this file.
 * 2. Settings → Variables, add:
 *      SUPABASE_URL          = https://rdmrxeplasttewtlfetc.supabase.co
 *      SUPABASE_ANON_KEY     = <your anon key>      (encrypt recommended)
 *      SITE_URL              = https://metsxmfanzone.com   (optional)
 * 3. Settings → Triggers → Routes:
 *      metsxmfanzone.com/blog/*
 *      www.metsxmfanzone.com/blog/*
 * 4. Verify:
 *      curl -A "facebookexternalhit/1.1" https://metsxmfanzone.com/blog/<slug>
 */

const DEFAULT_SITE_URL = "https://metsxmfanzone.com";

const CRAWLER_UA_PATTERNS = [
  "facebookexternalhit", "facebot", "twitterbot", "linkedinbot", "whatsapp",
  "slackbot", "telegrambot", "discordbot", "pinterest", "redditbot",
  "googlebot", "bingbot", "applebot", "embedly", "quora link preview",
  "showyoubot", "outbrain", "vkshare", "w3c_validator", "skypeuripreview",
  "nuzzel", "bitlybot", "tumblr", "yahoo", "bingpreview", "ia_archiver",
];

function isCrawler(ua) {
  if (!ua) return false;
  const lower = ua.toLowerCase();

  // Facebook in-app browser contains FBAN/FBAV/FBIOS — NOT a crawler, let it through
  if (lower.includes("fban") || lower.includes("fbav") || lower.includes("fbios")) {
    return false;
  }

  return CRAWLER_UA_PATTERNS.some((p) => lower.includes(p));
}

function escapeHtml(input) {
  return String(input ?? "").replace(/[&<>"']/g, (m) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m] || m)
  );
}

function stripHtml(input) {
  return String(input ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function resolveImage(url, siteUrl) {
  const fallback = `${siteUrl}/logo-512.png`;
  if (!url) return fallback;
  if (url.startsWith("data:")) return fallback;
  if (url.startsWith("http")) return url;
  return `${siteUrl}${url.startsWith("/") ? "" : "/"}${url}`;
}

function buildHtml(post, slug, siteUrl) {
  const postUrl = `${siteUrl}/blog/${encodeURIComponent(slug)}`;
  const image = resolveImage(post.featured_image_url, siteUrl);
  const rawDesc =
    (post.excerpt && String(post.excerpt).trim().length > 0
      ? String(post.excerpt)
      : stripHtml(post.content || "")) || String(post.title || "");
  const description = rawDesc.length > 160 ? rawDesc.slice(0, 157) + "..." : rawDesc;
  const title = `${post.title} | MetsXMFanZone`;
  const tagsMeta = (post.tags || [])
    .map((t) => `<meta property="article:tag" content="${escapeHtml(t)}">`)
    .join("\n  ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">

  <meta property="fb:app_id" content="1151558476948104">

  <meta property="og:type" content="article">
  <meta property="og:url" content="${postUrl}">
  <meta property="og:site_name" content="MetsXMFanZone">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${image}">
  <meta property="og:image:secure_url" content="${image}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${escapeHtml(post.title || "")}">
  <meta property="og:locale" content="en_US">

  <meta property="article:published_time" content="${escapeHtml(post.published_at || "")}">
  <meta property="article:section" content="${escapeHtml(post.category || "")}">
  <meta property="article:author" content="MetsXMFanZone">
  ${tagsMeta}

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@metsxmfanzone">
  <meta name="twitter:url" content="${postUrl}">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${image}">
  <meta name="twitter:image:alt" content="${escapeHtml(post.title || "")}">

  <link rel="canonical" href="${postUrl}">
</head>
<body>
  <h1>${escapeHtml(post.title || "")}</h1>
  <p>${escapeHtml(description)}</p>
  <p><a href="${postUrl}">Read the full article</a></p>
</body>
</html>`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const blogMatch = url.pathname.match(/^\/blog\/([^/?#]+)\/?$/);

    // Not a blog article route → pass through.
    if (!blogMatch || request.method !== "GET") {
      return fetch(request);
    }

    const ua = request.headers.get("user-agent") || "";

    // Real human → let the SPA render normally.
    if (!isCrawler(ua)) {
      return fetch(request);
    }

    const supabaseUrl = env.SUPABASE_URL;
    const anonKey = env.SUPABASE_ANON_KEY;
    const siteUrl = env.SITE_URL || DEFAULT_SITE_URL;

    // Misconfigured → fail open so the link still works.
    if (!supabaseUrl || !anonKey) {
      return fetch(request);
    }

    const slug = decodeURIComponent(blogMatch[1]);

    try {
      const apiUrl =
        `${supabaseUrl}/rest/v1/blog_posts` +
        `?slug=eq.${encodeURIComponent(slug)}` +
        `&published=eq.true` +
        `&select=title,excerpt,content,featured_image_url,published_at,category,tags` +
        `&limit=1`;

      const resp = await fetch(apiUrl, {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          Accept: "application/json",
        },
        cf: { cacheTtl: 3600, cacheEverything: true },
      });

      if (!resp.ok) return fetch(request);

      const rows = await resp.json();
      const post = Array.isArray(rows) ? rows[0] : null;
      if (!post) return fetch(request);

      const html = buildHtml(post, slug, siteUrl);
      return new Response(html, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=3600, s-maxage=7200",
          "X-OG-Worker": "metsxmfanzone-standalone",
        },
      });
    } catch {
      return fetch(request);
    }
  },
};
