// Vercel Serverless Function: serves the React SPA shell for /blog/:slug with
// Open Graph / Twitter / canonical / JSON-LD meta tags injected server-side
// based on live data from Lovable Cloud (Supabase). This makes every published
// blog post work on metsxmfanzone.com with no redeploy needed when new posts
// are published — the function fetches the post on every request.
//
// Routing: vercel.json rewrites /blog/:slug → this function so both humans and
// crawlers hit it. Humans get a full SPA boot (React Router renders the post),
// crawlers get the injected OG tags directly out of the head.

import fs from "node:fs";
import path from "node:path";

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  "https://rdmrxeplasttewtlfetc.supabase.co";

const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkbXJ4ZXBsYXN0dGV3dGxmZXRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NTIyNjAsImV4cCI6MjA3NzMyODI2MH0.P5msjdR8tgbx-rL2ifeSjqW1jvFzKtPNT4oapJIAkJA";

const DEFAULT_SITE_URL = process.env.PUBLIC_SITE_URL || "https://metsxmfanzone.com";

function resolveSiteUrl(req) {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const protocol = Array.isArray(forwardedProto)
    ? forwardedProto[0]
    : forwardedProto || "https";
  const forwardedHost = req.headers["x-forwarded-host"];
  const host = Array.isArray(forwardedHost)
    ? forwardedHost[0]
    : forwardedHost || req.headers.host;

  if (!host) return DEFAULT_SITE_URL;

  return `${protocol}://${host}`.replace("://www.", "://");
}

function escapeHtml(input) {
  return String(input ?? "").replace(/[&<>"']/g, (m) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[m] || m
  );
}

function stripHtml(input) {
  return String(input ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveImage(url, siteUrl) {
  const fallbackImage = `${siteUrl}/logo-512.png`;
  if (!url) return fallbackImage;
  if (url.startsWith("data:")) return fallbackImage;
  if (url.startsWith("http://")) return `https://${url.slice(7)}`;
  if (url.startsWith("https://")) return url;
  return `${siteUrl}${url.startsWith("/") ? "" : "/"}${url}`;
}

// Strip any placeholder/site-wide social tags from the SPA shell so the
// crawler doesn't pick up the homepage OG image instead of the article's.
function stripSocialTags(html) {
  return html
    .replace(/<title>[\s\S]*?<\/title>\s*/i, "")
    .replace(/<meta\s+name="title"[^>]*>\s*/gi, "")
    .replace(/<meta\s+name="description"[^>]*>\s*/gi, "")
    .replace(/<meta\s+name="keywords"[^>]*>\s*/gi, "")
    .replace(/<link\s+rel="canonical"[^>]*>\s*/gi, "")
    .replace(/<meta\s+property="fb:app_id"[^>]*>\s*/gi, "")
    .replace(/<meta\s+property="og:[^"]+"[^>]*>\s*/gi, "")
    .replace(/<meta\s+name="twitter:[^"]+"[^>]*>\s*/gi, "");
}

function buildHead(post, slug, siteUrl) {
  const postUrl = `${siteUrl}/blog/${String(slug)
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
  const image = resolveImage(post.featured_image_url, siteUrl);
  const rawDescription =
    (post.excerpt && String(post.excerpt).trim().length > 0
      ? String(post.excerpt)
      : stripHtml(post.content || "")) || String(post.title || "");
  const description =
    rawDescription.length > 160 ? rawDescription.substring(0, 157) + "..." : rawDescription;
  const title = `${post.title} | MetsXMFanZone`;
  const publishedTime = post.published_at || new Date().toISOString();
  const modifiedTime = post.updated_at || publishedTime;
  const keywords = [post.category, ...(Array.isArray(post.tags) ? post.tags : [])]
    .map((v) => String(v || "").trim())
    .filter(Boolean)
    .join(", ");
  const tagsMeta = (Array.isArray(post.tags) ? post.tags : [])
    .map((tag) => `<meta property="article:tag" content="${escapeHtml(tag)}" />`)
    .join("\n    ");

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: post.title,
    description,
    image: [image],
    datePublished: publishedTime,
    dateModified: modifiedTime,
    author: { "@type": "Organization", name: "MetsXMFanZone", url: siteUrl },
    publisher: {
      "@type": "Organization",
      name: "MetsXMFanZone",
      logo: { "@type": "ImageObject", url: `${siteUrl}/logo-512.png` },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": postUrl },
    articleSection: post.category || undefined,
    keywords: keywords || undefined,
  };

  return `
    <title>${escapeHtml(title)}</title>
    <meta name="title" content="${escapeHtml(title)}" />
    <meta name="description" content="${escapeHtml(description)}" />
    ${keywords ? `<meta name="keywords" content="${escapeHtml(keywords)}" />` : ""}
    <link rel="canonical" href="${postUrl}" />

    <meta property="fb:app_id" content="1151558476948104" />
    <meta property="og:type" content="article" />
    <meta property="og:url" content="${postUrl}" />
    <meta property="og:site_name" content="MetsXMFanZone" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:image" content="${image}" />
    <meta property="og:image:secure_url" content="${image}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${escapeHtml(post.title || "")}" />
    <meta property="og:locale" content="en_US" />
    <meta property="article:published_time" content="${escapeHtml(publishedTime)}" />
    <meta property="article:modified_time" content="${escapeHtml(modifiedTime)}" />
    <meta property="article:section" content="${escapeHtml(post.category || "")}" />
    <meta property="article:author" content="MetsXMFanZone" />
    ${tagsMeta}

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:site" content="@metsxmfanzone" />
    <meta name="twitter:creator" content="@metsxmfanzone" />
    <meta name="twitter:domain" content="metsxmfanzone.com" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${image}" />
    <meta name="twitter:image:alt" content="${escapeHtml(post.title || "")}" />

    <script type="application/ld+json">${JSON.stringify(articleSchema)}</script>
  `.trim();
}

// Locate the built SPA shell (dist/index.html on Vercel deployments).
let cachedShell = null;
function loadShell() {
  if (cachedShell) return cachedShell;
  const candidates = [
    path.join(process.cwd(), "dist", "index.html"),
    path.join(process.cwd(), "public", "index.html"),
    path.join(process.cwd(), "index.html"),
  ];
  for (const p of candidates) {
    try {
      cachedShell = fs.readFileSync(p, "utf-8");
      return cachedShell;
    } catch {
      /* try next */
    }
  }
  return null;
}

function buildFallbackShell(post, slug, siteUrl) {
  // Used only if dist/index.html is unavailable for some reason. Crawlers still
  // get full meta; humans get a redirect to the live SPA on Lovable hosting.
  const headHtml = buildHead(post, slug, siteUrl);
  const postUrl = `${siteUrl}/blog/${encodeURIComponent(slug)}`;
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">${headHtml}<meta http-equiv="refresh" content="0;url=${postUrl}"></head><body><h1>${escapeHtml(post.title || "")}</h1></body></html>`;
}

export default async function handler(req, res) {
  try {
    const siteUrl = resolveSiteUrl(req);
    const slugParam = req.query?.slug;
    // Nested paths (e.g. /blog/tech/my-post) arrive as an array of segments.
    const slug = (Array.isArray(slugParam) ? slugParam.join("/") : slugParam || "")
      .replace(/^\/+|\/+$/g, "");

    if (!slug) {
      res.status(400).send("Missing slug");
      return;
    }

    const url = `${SUPABASE_URL}/rest/v1/blog_posts?slug=eq.${encodeURIComponent(
      slug
    )}&published=eq.true&select=title,excerpt,content,featured_image_url,published_at,updated_at,category,tags&limit=1`;

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

    const shell = loadShell();
    let html;
    if (shell) {
      const cleaned = stripSocialTags(shell);
      html = cleaned.replace("</head>", `${buildHead(post, slug, siteUrl)}\n</head>`);
    } else {
      html = buildFallbackShell(post, slug, siteUrl);
    }

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader(
      "Cache-Control",
      "public, max-age=300, s-maxage=300, stale-while-revalidate=3600"
    );
    res.status(200).send(html);
  } catch (err) {
    res.status(500).send("Internal error");
  }
}
