// Shared helpers for rendering published blog posts as real HTML.
// Used by /api/blog (app shell + article) and /api/blog-html (standalone page).

export const SUPABASE_URL = "https://rdmrxeplasttewtlfetc.supabase.co";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkbXJ4ZXBsYXN0dGV3dGxmZXRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NTIyNjAsImV4cCI6MjA3NzMyODI2MH0.P5msjdR8tgbx-rL2ifeSjqW1jvFzKtPNT4oapJIAkJA";

export const SITE_URL = process.env.PUBLIC_SITE_URL || "https://metsxmfanzone.com";
export const FALLBACK_IMAGE = `${SITE_URL}/og-image.png`;
const OLD_STORAGE = "https://clwghkbtkofacsjeyrtk.supabase.co";

export function escapeHtml(input) {
  return String(input ?? "").replace(
    /[&<>"']/g,
    (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[m] || m,
  );
}

/** Removes invisible characters (zero-width spaces etc.) and trims. */
export function cleanText(input) {
  return String(input ?? "").replace(/[​-‍⁠﻿]/g, "").trim();
}

/** "MetsXMFanZone News,  " -> "MetsXMFanZone News" */
export function cleanCategory(input) {
  return cleanText(input).replace(/[\s,]+$/g, "").replace(/^[\s,]+/g, "");
}

export function stripHtml(input) {
  return String(input ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveImage(url) {
  if (!url || String(url).startsWith("data:")) return FALLBACK_IMAGE;
  const fixed = String(url).split(OLD_STORAGE).join(SUPABASE_URL);
  if (fixed.startsWith("http")) return fixed;
  return `${SITE_URL}${fixed.startsWith("/") ? "" : "/"}${fixed}`;
}

// Tags the editor can produce that are safe to publish as-is.
const ALLOWED_TAGS = new Set([
  "p", "br", "hr", "strong", "b", "em", "i", "u", "s", "mark", "small", "sub", "sup",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li", "blockquote", "pre", "code",
  "a", "img", "figure", "figcaption",
  "table", "thead", "tbody", "tr", "th", "td", "span", "div",
]);
const ALLOWED_ATTRS = {
  a: ["href", "title", "target", "rel"],
  img: ["src", "alt", "width", "height", "loading"],
  th: ["colspan", "rowspan"],
  td: ["colspan", "rowspan"],
};

function safeUrlValue(value, { allowRelative = true } = {}) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (/^(https?:|mailto:)/i.test(trimmed)) return trimmed;
  if (allowRelative && trimmed.startsWith("/")) return trimmed;
  return "";
}

function cleanAttributes(tag, attrString) {
  const allowed = ALLOWED_ATTRS[tag];
  if (!allowed) return "";
  const out = [];
  const re = /([a-zA-Z-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let match;
  while ((match = re.exec(attrString))) {
    const name = match[1].toLowerCase();
    if (!allowed.includes(name)) continue;
    let value = match[3] ?? match[4] ?? "";
    if (name === "href") value = safeUrlValue(value);
    if (name === "src") value = resolveImage(safeUrlValue(value));
    if (!value) continue;
    out.push(`${name}="${escapeHtml(value)}"`);
  }
  if (tag === "a" && out.some((a) => a.startsWith("target="))) {
    if (!out.some((a) => a.startsWith("rel="))) out.push('rel="noopener noreferrer"');
  }
  if (tag === "img" && !out.some((a) => a.startsWith("loading="))) out.push('loading="lazy"');
  return out.length ? ` ${out.join(" ")}` : "";
}

/** Keeps the author's real HTML formatting, drops anything unsafe. */
export function sanitizeArticleHtml(input) {
  let html = String(input ?? "");
  // Drop dangerous elements together with their contents.
  html = html.replace(
    /<(script|style|iframe|object|embed|form|input|button|svg|math|link|meta)\b[\s\S]*?<\/\1>/gi,
    "",
  );
  html = html.replace(/<(script|style|iframe|object|embed|form|input|link|meta)\b[^>]*>/gi, "");
  html = html.replace(/<!--[\s\S]*?-->/g, "");

  return html.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (full, rawTag, attrs) => {
    const tag = rawTag.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) return "";
    if (full.startsWith("</")) return `</${tag}>`;
    const selfClosing = tag === "br" || tag === "hr" || tag === "img";
    return `<${tag}${cleanAttributes(tag, attrs)}${selfClosing ? " /" : ""}>`;
  });
}

/** Article body markup used on both the in-app page and the standalone page. */
export function renderArticleBody(post) {
  const image = resolveImage(post.featured_image_url);
  const body = sanitizeArticleHtml(post.content) || `<p>${escapeHtml(stripHtml(post.excerpt))}</p>`;
  const date = (post.published_at || "").slice(0, 10);
  const title = cleanText(post.title);
  return `<article class="blog-article">
  <p class="blog-kicker">${escapeHtml(cleanCategory(post.category) || "Mets News")}</p>
  <h1>${escapeHtml(title)}</h1>
  <time datetime="${escapeHtml(post.published_at || "")}">${escapeHtml(date)}</time>
  <img class="blog-hero" src="${escapeHtml(image)}" alt="${escapeHtml(title)}" width="1200" height="630">
  ${post.excerpt ? `<p class="blog-excerpt">${escapeHtml(post.excerpt)}</p>` : ""}
  <div class="blog-body">${body}</div>
</article>`;
}

export function buildDescription(post) {
  const raw =
    (post.excerpt && String(post.excerpt).trim()) || stripHtml(post.content) || String(post.title || "");
  return raw.length > 200 ? `${raw.slice(0, 197)}...` : raw;
}

// JSON for a <script> tag: "<" is escaped so article text can never close the tag early.
function jsonLd(obj) {
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}

export function buildMetaTags(post, slug, { canonical } = {}) {
  const postUrl = canonical || `${SITE_URL}/blog/${encodeURIComponent(slug)}`;
  const image = resolveImage(post.featured_image_url);
  const headline = cleanText(post.title);
  const section = cleanCategory(post.category);
  const title = `${headline} | MetsXMFanZone`;
  const description = cleanText(buildDescription(post));
  const organization = {
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: "MetsXMFanZone",
    url: SITE_URL,
    logo: { "@type": "ImageObject", url: `${SITE_URL}/metsxmfanzone-logo.png` },
  };
  const schema = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: headline.length > 110 ? `${headline.slice(0, 107)}...` : headline,
    description,
    image: [image],
    datePublished: post.published_at,
    dateModified: post.updated_at || post.published_at,
    mainEntityOfPage: { "@type": "WebPage", "@id": postUrl },
    url: postUrl,
    inLanguage: "en-US",
    ...(section ? { articleSection: section } : {}),
    author: organization,
    publisher: organization,
  };
  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE_URL}/blog` },
      { "@type": "ListItem", position: 3, name: headline, item: postUrl },
    ],
  };

  return `
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${escapeHtml(postUrl)}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="MetsXMFanZone">
  <meta property="og:url" content="${escapeHtml(postUrl)}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${escapeHtml(image)}">
  <meta property="og:image:secure_url" content="${escapeHtml(image)}">
  ${image === FALLBACK_IMAGE ? '<meta property="og:image:width" content="1200">\n  <meta property="og:image:height" content="630">' : ""}
  <meta property="og:image:alt" content="${escapeHtml(headline)}">
  <meta property="og:locale" content="en_US">
  <meta property="article:published_time" content="${escapeHtml(post.published_at || "")}">
  ${post.updated_at ? `<meta property="article:modified_time" content="${escapeHtml(post.updated_at)}">` : ""}
  ${section ? `<meta property="article:section" content="${escapeHtml(section)}">` : ""}
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@metsxmfanzone">
  <meta name="twitter:url" content="${escapeHtml(postUrl)}">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(image)}">
  <script type="application/ld+json">${jsonLd(schema)}</script>
  <script type="application/ld+json">${jsonLd(breadcrumbs)}</script>
`;
}

export const ARTICLE_STYLES = `
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: radial-gradient(900px 500px at 10% -10%, rgba(27,82,168,.35), transparent 60%), #07101f;
    color: #eaf1ff;
    font-family: "Segoe UI", system-ui, -apple-system, Roboto, Helvetica, Arial, sans-serif;
    line-height: 1.65;
  }
  a { color: #f5761a; }
  header.site, footer.site { border-color: rgba(255,255,255,.1); }
  header.site { border-bottom: 1px solid rgba(255,255,255,.1); padding: .9rem 0; }
  footer.site { border-top: 1px solid rgba(255,255,255,.1); padding: 1.4rem 0 2.4rem; margin-top: 2.5rem; color: #9fb0cc; font-size: .82rem; }
  .wrap { width: min(760px, 92vw); margin-inline: auto; }
  .brand { font-weight: 800; text-decoration: none; color: #eaf1ff; }
  .blog-article { padding: 1.6rem 0 1rem; }
  .blog-kicker { text-transform: uppercase; letter-spacing: .14em; font-size: .72rem; color: #f5761a; font-weight: 700; margin: 0 0 .5rem; }
  .blog-article h1 { font-size: clamp(1.6rem, 5vw, 2.6rem); line-height: 1.15; margin: 0 0 .5rem; }
  .blog-article time { color: #9fb0cc; font-size: .82rem; }
  .blog-hero { width: 100%; height: auto; border-radius: 14px; margin: 1.1rem 0; border: 1px solid rgba(255,255,255,.1); }
  .blog-excerpt { font-size: 1.05rem; color: #c8d6ee; }
  .blog-body img { max-width: 100%; height: auto; border-radius: 12px; }
  .blog-body h2, .blog-body h3 { margin-top: 1.8rem; }
  .blog-body blockquote { margin: 1.2rem 0; padding: .6rem 1rem; border-left: 3px solid #f5761a; color: #c8d6ee; }
  .blog-body pre { overflow-x: auto; background: rgba(255,255,255,.06); padding: .8rem; border-radius: 10px; }
  .read-more { display: inline-block; margin-top: 1.4rem; background: #f5761a; color: #10182a; text-decoration: none; font-weight: 700; padding: .6rem 1.1rem; border-radius: 999px; }
`;

/** Complete, dependency-free HTML document for one article. */
export function renderStandalonePage(post, slug) {
  const appUrl = `${SITE_URL}/blog/${encodeURIComponent(slug)}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${buildMetaTags(post, slug, { canonical: appUrl })}
<style>${ARTICLE_STYLES}</style>
</head>
<body>
<header class="site"><div class="wrap"><a class="brand" href="${SITE_URL}/">MetsXMFanZone</a></div></header>
<main class="wrap">
${renderArticleBody(post)}
<a class="read-more" href="${escapeHtml(appUrl)}">Read more on MetsXMFanZone</a>
</main>
<footer class="site"><div class="wrap">&copy; ${new Date().getFullYear()} MetsXMFanZone — fan coverage of the New York Mets.</div></footer>
</body>
</html>`;
}

export async function fetchPublishedPost(slug) {
  const query =
    `${SUPABASE_URL}/rest/v1/blog_posts?slug=eq.${encodeURIComponent(slug)}` +
    `&published=eq.true&select=title,slug,excerpt,content,featured_image_url,published_at,updated_at,category&limit=1`;
  const res = await fetch(query, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  });
  if (!res.ok) return null;
  const rows = await res.json();
  return Array.isArray(rows) ? rows[0] || null : null;
}
