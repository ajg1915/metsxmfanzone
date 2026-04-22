// Vercel Serverless Function: serves prerendered OG/Twitter meta HTML for
// social media crawlers hitting /blog/:slug. Real users are routed to the
// React SPA via vercel.json (only bots are rewritten here).

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  "https://clwghkbtkofacsjeyrtk.supabase.co";

const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  "";

const SITE_URL = process.env.PUBLIC_SITE_URL || "https://metsxmfanzone.com";
const FALLBACK_IMAGE = `${SITE_URL}/logo-512.png`;

function escapeHtml(input) {
  return String(input ?? "").replace(/[&<>"']/g, (m) =>
    ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[m] || m
  );
}

function stripHtml(input) {
  return String(input ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveImage(url) {
  if (!url) return FALLBACK_IMAGE;
  if (url.startsWith("data:")) return FALLBACK_IMAGE;
  if (url.startsWith("http")) return url;
  return `${SITE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

function buildHtml(post, slug) {
  const postUrl = `${SITE_URL}/blog/${slug}`;
  const image = resolveImage(post.featured_image_url);

  const rawDescription =
    (post.excerpt && String(post.excerpt).trim().length > 0
      ? String(post.excerpt)
      : stripHtml(post.content || "")) || String(post.title || "");

  const description =
    rawDescription.length > 160
      ? rawDescription.substring(0, 157) + "..."
      : rawDescription;

  const title = `${post.title} | MetsXMFanZone`;

  const tagsMeta = (post.tags || [])
    .map(
      (tag) =>
        `<meta property="article:tag" content="${escapeHtml(tag)}">`
    )
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

  <link rel="canonical" href="${postUrl}" />
  <meta http-equiv="refresh" content="0;url=${postUrl}">
</head>
<body>
  <h1>${escapeHtml(post.title || "")}</h1>
  <p>${escapeHtml(description)}</p>
  <p>Redirecting to <a href="${postUrl}">${postUrl}</a>...</p>
</body>
</html>`;
}

export default async function handler(req, res) {
  try {
    const slugParam = req.query?.slug;
    const slug = Array.isArray(slugParam) ? slugParam[0] : slugParam;

    if (!slug) {
      res.status(400).send("Missing slug");
      return;
    }

    if (!SUPABASE_ANON_KEY) {
      res.status(500).send("Supabase key not configured");
      return;
    }

    const url = `${SUPABASE_URL}/rest/v1/blog_posts?slug=eq.${encodeURIComponent(
      slug
    )}&published=eq.true&select=title,excerpt,content,featured_image_url,published_at,category,tags&limit=1`;

    const response = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });

    if (!response.ok) {
      res.status(502).send("Failed to fetch post");
      return;
    }

    const rows = await response.json();
    const post = Array.isArray(rows) ? rows[0] : null;

    if (!post) {
      res.status(404).send("Post not found");
      return;
    }

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600");
    res.status(200).send(buildHtml(post, slug));
  } catch (err) {
    res.status(500).send("Internal error");
  }
}
