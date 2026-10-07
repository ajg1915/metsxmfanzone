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
  <p class="crumbs"><a href="${SITE_URL}/">Home</a> / <a href="${SITE_URL}/blog">Blog</a></p>
  <p class="blog-kicker">${escapeHtml(cleanCategory(post.category) || "Mets News")}</p>
  <h1>${escapeHtml(title)}</h1>
  <div class="byline"><span>By MetsXMFanZone</span><i class="dot"></i><time datetime="${escapeHtml(post.published_at || "")}">${escapeHtml(formatDate(post.published_at) || date)}</time><i class="dot"></i><span>${readMinutes(post)} min read</span></div>
  <img class="blog-hero" fetchpriority="high" src="${escapeHtml(image)}" alt="${escapeHtml(title)}" width="1200" height="630">
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
  :root { --bg:#0b1426; --bg2:#0f1b33; --panel:#12203a; --line:#24365a; --text:#e8eef9; --soft:#c3d0e6; --muted:#8fa3c2; --orange:#ff5910; --blue:#2f6df6; }
  * { box-sizing: border-box; }
  html { -webkit-text-size-adjust: 100%; }
  body { margin:0; background: radial-gradient(1000px 520px at 8% -8%, rgba(47,109,246,.22), transparent 60%), radial-gradient(800px 420px at 100% 0%, rgba(255,89,16,.10), transparent 55%), var(--bg); color:var(--text); font-family: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height:1.7; }
  a { color:#ff8a4d; }
  img { max-width:100%; height:auto; }
  .wrap { width:min(1080px, 92vw); margin-inline:auto; }
  .narrow { width:min(740px, 92vw); margin-inline:auto; }

  /* header */
  .topbar { position:sticky; top:0; z-index:20; background:rgba(11,20,38,.92); -webkit-backdrop-filter:blur(12px); backdrop-filter:blur(12px); border-bottom:2px solid var(--orange); }
  .topbar .wrap { display:flex; align-items:center; gap:1rem; height:60px; }
  .brand { display:flex; align-items:center; gap:.55rem; color:var(--text); text-decoration:none; font-weight:800; font-size:1.05rem; white-space:nowrap; }
  .brand img { width:34px; height:34px; border-radius:8px; }
  .brand b { color:var(--orange); font-weight:800; }
  .nav { display:flex; gap:.25rem; margin-left:auto; overflow-x:auto; scrollbar-width:none; }
  .nav::-webkit-scrollbar { display:none; }
  .nav a { color:var(--soft); text-decoration:none; font-weight:600; font-size:.88rem; padding:.45rem .7rem; border-radius:999px; white-space:nowrap; }
  .nav a:hover, .nav a.on { color:#fff; background:var(--panel); }
  .nav a.join { background:var(--orange); color:#fff; }
  @media (max-width:640px) { .brand span { display:none; } .topbar .wrap { gap:.5rem; } }

  /* article */
  .blog-article { padding:2rem 0 .5rem; }
  .crumbs { font-size:.8rem; color:var(--muted); margin:0 0 1rem; }
  .crumbs a { color:var(--muted); text-decoration:none; }
  .crumbs a:hover { color:#fff; }
  .blog-kicker { display:inline-block; text-transform:uppercase; letter-spacing:.14em; font-size:.72rem; color:#fff; background:var(--orange); font-weight:800; margin:0 0 .8rem; padding:.28rem .6rem; border-radius:6px; }
  .blog-article h1 { font-size:clamp(1.75rem,5.4vw,2.9rem); line-height:1.12; letter-spacing:-.02em; margin:0 0 .8rem; }
  .byline { display:flex; flex-wrap:wrap; align-items:center; gap:.4rem .9rem; color:var(--muted); font-size:.86rem; margin-bottom:1.2rem; }
  .byline .dot { width:4px; height:4px; border-radius:50%; background:var(--line); }
  .blog-hero { display:block; width:100%; height:auto; aspect-ratio:1200/630; object-fit:cover; border-radius:16px; border:1px solid var(--line); margin:0 0 1.4rem; background:var(--panel); }
  .blog-excerpt { font-size:1.18rem; line-height:1.55; color:var(--soft); border-left:4px solid var(--orange); padding-left:1rem; margin:0 0 1.6rem; }
  .blog-body { font-size:1.07rem; color:#dbe5f6; }
  .blog-body p { margin:0 0 1.2rem; }
  .blog-body img { border-radius:12px; margin:.4rem 0; }
  .blog-body h2, .blog-body h3 { line-height:1.25; margin:2rem 0 .7rem; color:#fff; }
  .blog-body blockquote { margin:1.4rem 0; padding:.7rem 1.1rem; border-left:4px solid var(--blue); background:var(--panel); border-radius:0 12px 12px 0; color:var(--soft); }
  .blog-body pre { overflow-x:auto; background:var(--panel); padding:.9rem; border-radius:10px; }
  .blog-body ul, .blog-body ol { padding-left:1.3rem; margin:0 0 1.2rem; }
  .blog-body li { margin:.3rem 0; }

  /* share */
  .share { display:flex; flex-wrap:wrap; align-items:center; gap:.5rem; margin:2rem 0 0; padding:1.1rem 0; border-top:1px solid var(--line); border-bottom:1px solid var(--line); }
  .share span { color:var(--muted); font-weight:700; font-size:.82rem; text-transform:uppercase; letter-spacing:.1em; margin-right:.3rem; }
  .share a { color:var(--text); text-decoration:none; font-weight:600; font-size:.85rem; background:var(--panel); border:1px solid var(--line); padding:.45rem .85rem; border-radius:999px; }
  .share a:hover, .sbtn:hover { border-color:var(--orange); color:#fff; }
  .sbtn { font:inherit; cursor:pointer; color:#fff; font-weight:700; font-size:.85rem; background:var(--orange); border:1px solid var(--orange); padding:.45rem .95rem; border-radius:999px; }
  .sbtn[hidden] { display:none; }
  .sbtn:last-of-type { background:var(--panel); border-color:var(--line); }

  /* related */
  .related { padding:2.6rem 0 .5rem; }
  .related h2 { font-size:1.15rem; text-transform:uppercase; letter-spacing:.1em; margin:0 0 1rem; display:flex; align-items:center; gap:.6rem; }
  .related h2::before { content:""; width:4px; height:1.1rem; background:var(--orange); }
  .cards { display:grid; grid-template-columns:repeat(3,1fr); gap:1rem; }
  .card { display:block; background:var(--panel); border:1px solid var(--line); border-radius:14px; overflow:hidden; text-decoration:none; color:var(--text); transition:border-color .15s, transform .15s; }
  .card:hover { border-color:var(--orange); transform:translateY(-2px); }
  .card img { display:block; width:100%; aspect-ratio:16/9; object-fit:cover; background:var(--bg2); }
  .card div { padding:.8rem .9rem 1rem; }
  .card small { color:var(--orange); font-weight:800; text-transform:uppercase; letter-spacing:.1em; font-size:.68rem; }
  .card strong { display:block; margin-top:.3rem; font-size:.97rem; line-height:1.3; }
  @media (max-width:760px) { .cards { grid-template-columns:1fr; } }

  /* call to action */
  .cta { margin:2.6rem 0 0; padding:1.6rem; border-radius:18px; background:linear-gradient(135deg, rgba(47,109,246,.35), rgba(255,89,16,.28)), var(--panel); border:1px solid var(--line); display:flex; flex-wrap:wrap; gap:1rem; align-items:center; justify-content:space-between; }
  .cta h3 { margin:0 0 .2rem; font-size:1.25rem; }
  .cta p { margin:0; color:var(--soft); font-size:.95rem; }
  .btns { display:flex; gap:.6rem; flex-wrap:wrap; }
  .btn { display:inline-block; text-decoration:none; font-weight:800; font-size:.9rem; padding:.7rem 1.2rem; border-radius:999px; background:var(--orange); color:#fff; }
  .btn.alt { background:transparent; border:1px solid #fff; color:#fff; }

  /* footer */
  .foot { margin-top:3rem; background:rgba(7,12,24,.7); border-top:2px solid var(--orange); }
  .foot .wrap { padding:2rem 0 2.4rem; }
  .foot-top { display:flex; flex-wrap:wrap; gap:1rem; align-items:center; justify-content:space-between; padding-bottom:1.3rem; border-bottom:1px solid var(--line); }
  .foot-top strong { color:var(--orange); font-size:1.15rem; }
  .foot-top p { margin:.15rem 0 0; font-size:.82rem; color:var(--muted); }
  .soc { display:flex; gap:.6rem; }
  .soc a { width:40px; height:40px; border-radius:50%; display:grid; place-items:center; background:var(--panel); border:1px solid var(--line); color:var(--text); }
  .soc a:hover { border-color:var(--orange); color:var(--orange); }
  .soc svg { width:18px; height:18px; fill:none; stroke:currentColor; stroke-width:2; stroke-linecap:round; stroke-linejoin:round; }
  .fgrid { display:grid; grid-template-columns:repeat(4,1fr); gap:1.6rem; padding:1.6rem 0; }
  .fgrid h4 { margin:0 0 .6rem; font-size:.74rem; text-transform:uppercase; letter-spacing:.12em; color:var(--muted); display:flex; gap:.5rem; align-items:center; }
  .fgrid h4::before { content:""; width:3px; height:.9rem; background:var(--orange); }
  .fgrid a { display:block; padding:.28rem 0; color:var(--soft); text-decoration:none; font-size:.92rem; }
  .fgrid a:hover { color:var(--orange); }
  .legal { display:flex; flex-wrap:wrap; gap:.3rem 1.1rem; justify-content:center; font-size:.85rem; }
  .legal a { color:var(--muted); text-decoration:none; }
  .legal a:hover { color:var(--orange); }
  .fine { text-align:center; color:#6f84a6; font-size:.74rem; margin:.7rem 0 0; }
  @media (max-width:720px) { .fgrid { grid-template-columns:repeat(2,1fr); } .foot-top { justify-content:center; text-align:center; } }
`;

const FOOT_COLUMNS = [
  ["Watch", [["/metsxmfanzone", "Live Network"], ["/gameday-live", "Game Day Live"], ["/replay-games", "Game Replays"], ["/broadcast-schedule", "TV Schedule"], ["/tv", "TV Mode"]]],
  ["Read", [["/blog", "News"], ["/mets-game-recaps", "Game Recaps"], ["/mets-scores", "Scores"], ["/mets-schedule-2026", "2026 Schedule"], ["/mets-roster", "Roster"]]],
  ["Community", [["/community", "Community"], ["/podcast", "Podcast"], ["/video-gallery", "Highlights"], ["/social", "Follow Us"], ["/business-partner", "Business Partners"]]],
  ["Support", [["/help-center", "Help Center"], ["/faqs", "FAQ"], ["/contact", "Contact Us"], ["/pricing", "Plans & Pricing"], ["/install", "Install App"]]],
];
const svg = (inner) => `<svg viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
const FOOT_SOCIALS = [
  ["TikTok", "https://www.tiktok.com/@metsxmfanzone", svg('<path d="M9 12a4 4 0 1 0 4 4V3a5 5 0 0 0 5 5"/>')],
  ["Instagram", "https://www.instagram.com/metsxmfanzone", svg('<rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>')],
  ["Facebook", "https://www.facebook.com/metsxmfanzoneofficial", svg('<path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>')],
  ["X", "https://x.com/metsxmfanzone", svg('<path d="M4 4l16 16M20 4L4 20"/>')],
  ["YouTube", "https://www.youtube.com/@metsxmfanzone", svg('<path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/><path d="m10 15 5-3-5-3z"/>')],
];

function readMinutes(post) {
  const words = stripHtml(post.content || "").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

function formatDate(iso) {
  const d = new Date(iso || "");
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "America/New_York" });
}

function siteHeader() {
  return `<header class="topbar"><div class="wrap">
  <a class="brand" href="${SITE_URL}/"><img src="${SITE_URL}/logo-192.png" alt="" width="34" height="34"><span>MetsXM<b>FanZone</b></span></a>
  <nav class="nav" aria-label="Main">
    <a href="${SITE_URL}/">Home</a>
    <a href="${SITE_URL}/metsxmfanzone">Watch Live</a>
    <a class="on" href="${SITE_URL}/blog">Blog</a>
    <a href="${SITE_URL}/mets-schedule-2026">Games</a>
    <a href="${SITE_URL}/podcast">Podcast</a>
    <a href="${SITE_URL}/auth?mode=signup" class="join">Join</a>
  </nav>
</div></header>`;
}

function siteFooter() {
  return `<footer class="foot"><div class="wrap">
  <div class="foot-top">
    <div><strong>MetsXMFanZone.com</strong><p>Fan-run coverage of the New York Mets</p></div>
    <div class="soc">${FOOT_SOCIALS.map(([n, u, i]) => `<a href="${u}" target="_blank" rel="noopener noreferrer" aria-label="MetsXMFanZone on ${n}">${i}</a>`).join("")}</div>
  </div>
  <div class="fgrid">${FOOT_COLUMNS.map(([t, links]) => `<div><h4>${t}</h4>${links.map(([h, l]) => `<a href="${SITE_URL}${h}">${escapeHtml(l)}</a>`).join("")}</div>`).join("")}</div>
  <div class="legal"><a href="${SITE_URL}/privacy">Privacy</a><a href="${SITE_URL}/terms">Terms</a><a href="${SITE_URL}/contact">Contact</a></div>
  <p class="fine">&copy; ${new Date().getFullYear()} MetsXMFanZone. Fan-run coverage of the New York Mets. Not affiliated with MLB or the New York Mets.</p>
</div></footer>`;
}

function shareRow(post, slug) {
  const url = encodeURIComponent(`${SITE_URL}/blog/${encodeURIComponent(slug)}`);
  const title = encodeURIComponent(cleanText(post.title));
  const rawUrl = `${SITE_URL}/blog/${encodeURIComponent(slug)}`;
  const data = JSON.stringify({ u: rawUrl, t: cleanText(post.title) }).replace(/</g, "\\u003c");
  return `<div class="share"><span>Share</span>
  <button type="button" class="sbtn" data-share hidden>Share&hellip;</button>
  <button type="button" class="sbtn" data-copy hidden>Copy link</button>
  <a href="https://www.facebook.com/sharer/sharer.php?u=${url}" target="_blank" rel="noopener noreferrer">Facebook</a>
  <a href="https://twitter.com/intent/tweet?url=${url}&amp;text=${title}" target="_blank" rel="noopener noreferrer">X</a>
  <a href="https://api.whatsapp.com/send?text=${title}%20${url}" target="_blank" rel="noopener noreferrer">WhatsApp</a>
  <a href="mailto:?subject=${title}&amp;body=${url}">Email</a>
</div>
<script>(function(){try{var d=${data},sh=document.querySelector("[data-share]"),cp=document.querySelector("[data-copy]");
if(sh&&navigator.share){sh.hidden=false;sh.addEventListener("click",function(){try{navigator.share({title:d.t,url:d.u}).catch(function(){});}catch(e){}});}
if(cp){cp.hidden=false;cp.addEventListener("click",function(){var done=function(){cp.textContent="Link copied!";setTimeout(function(){cp.textContent="Copy link";},2000);};
var fb=function(){try{var a=document.createElement("textarea");a.value=d.u;a.setAttribute("readonly","");a.style.position="fixed";a.style.opacity="0";document.body.appendChild(a);a.select();a.setSelectionRange(0,99999);document.execCommand("copy");document.body.removeChild(a);done();}catch(e){window.prompt("Copy this link:",d.u);}};
try{if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(d.u).then(done,fb);}else{fb();}}catch(e){fb();}});}
}catch(e){}})();</script>`;
}

function relatedBlock(related) {
  if (!related || !related.length) return "";
  return `<section class="related"><h2>More Mets news</h2><div class="cards">${related
    .map(
      (r) => `<a class="card" href="${SITE_URL}/blog/${encodeURIComponent(r.slug)}"><img src="${escapeHtml(resolveImage(r.featured_image_url))}" alt="" loading="lazy" width="640" height="360"><div><small>${escapeHtml(cleanCategory(r.category) || "Mets News")}</small><strong>${escapeHtml(cleanText(r.title))}</strong></div></a>`
    )
    .join("")}</div></section>`;
}

/** Complete, dependency-free HTML document for one article (works in every browser, incl. in-app ones). */
export function renderStandalonePage(post, slug, related = []) {
  const appUrl = `${SITE_URL}/blog/${encodeURIComponent(slug)}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0b1426">
<link rel="icon" href="${SITE_URL}/favicon.ico">
<link rel="apple-touch-icon" href="${SITE_URL}/apple-touch-icon.png">
${buildMetaTags(post, slug, { canonical: appUrl })}
<style>${ARTICLE_STYLES}</style>
</head>
<body>
${siteHeader()}
<main class="narrow">
${renderArticleBody(post)}
${shareRow(post, slug)}
<div class="cta"><div><h3>Never miss a Mets moment</h3><p>Live games, podcasts and breaking news, all in one place.</p></div><div class="btns"><a class="btn" href="${SITE_URL}/auth?mode=signup">Join MetsXMFanZone</a><a class="btn alt" href="${SITE_URL}/blog">More stories</a></div></div>
</main>
<div class="wrap">${relatedBlock(related)}</div>
${siteFooter()}
</body>
</html>`;
}

export async function fetchRelatedPosts(slug, limit = 3) {
  try {
    const query =
      `${SUPABASE_URL}/rest/v1/blog_posts?published=eq.true&slug=neq.${encodeURIComponent(slug)}` +
      `&select=title,slug,category,featured_image_url&order=published_at.desc.nullslast&limit=${limit}`;
    const res = await fetch(query, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    });
    if (!res.ok) return [];
    const rows = await res.json();
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
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
