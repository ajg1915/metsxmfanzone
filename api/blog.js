// Serves /blog/:slug for BOTH humans and social crawlers.
// It loads the normal app shell and injects the article's real title,
// description, image and readable body, so link previews and in-app
// browsers always see the article — even for posts published after
// the last site build.

const SUPABASE_URL = "https://rdmrxeplasttewtlfetc.supabase.co";

const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkbXJ4ZXBsYXN0dGV3dGxmZXRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NTIyNjAsImV4cCI6MjA3NzMyODI2MH0.P5msjdR8tgbx-rL2ifeSjqW1jvFzKtPNT4oapJIAkJA";

const SITE_URL = process.env.PUBLIC_SITE_URL || "https://metsxmfanzone.com";
const FALLBACK_IMAGE = `${SITE_URL}/og-image.jpg`;
const OLD_STORAGE = "https://clwghkbtkofacsjeyrtk.supabase.co";

function escapeHtml(input) {
  return String(input ?? "").replace(
    /[&<>"']/g,
    (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[m] || m,
  );
}

function stripHtml(input) {
  return String(input ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveImage(url) {
  if (!url || url.startsWith("data:")) return FALLBACK_IMAGE;
  const fixed = url.split(OLD_STORAGE).join(SUPABASE_URL);
  if (fixed.startsWith("http")) return fixed;
  return `${SITE_URL}${fixed.startsWith("/") ? "" : "/"}${fixed}`;
}

// Remove the template's own social/canonical/title tags so ours are the only set.
function stripExistingMeta(head) {
  return head
    .replace(/<title>[\s\S]*?<\/title>/gi, "")
    .replace(/<meta[^>]+(property|name)=["'](og:[^"']*|twitter:[^"']*|description)["'][^>]*>/gi, "")
    .replace(/<link[^>]+rel=["']canonical["'][^>]*>/gi, "");
}

function buildHead(post, slug) {
  const postUrl = `${SITE_URL}/blog/${slug}`;
  const image = resolveImage(post.featured_image_url);
  const title = `${post.title} | MetsXMFanZone`;
  const raw =
    (post.excerpt && String(post.excerpt).trim()) || stripHtml(post.content) || String(post.title || "");
  const description = raw.length > 200 ? `${raw.slice(0, 197)}...` : raw;

  const schema = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: post.title,
    description,
    image: [image],
    datePublished: post.published_at,
    dateModified: post.updated_at || post.published_at,
    mainEntityOfPage: postUrl,
    publisher: { "@type": "Organization", name: "MetsXMFanZone" },
  };

  return `
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${postUrl}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="MetsXMFanZone">
  <meta property="og:url" content="${postUrl}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${escapeHtml(image)}">
  <meta property="og:image:secure_url" content="${escapeHtml(image)}">
  ${image === FALLBACK_IMAGE ? '<meta property="og:image:width" content="1200">\n  <meta property="og:image:height" content="630">' : ""}
  <meta property="og:image:alt" content="${escapeHtml(post.title || "")}">
  <meta property="og:locale" content="en_US">
  <meta property="article:published_time" content="${escapeHtml(post.published_at || "")}">
  <meta property="article:section" content="${escapeHtml(post.category || "")}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${postUrl}">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(image)}">
  <script type="application/ld+json">${JSON.stringify(schema)}</script>
`;
}

function buildBody(post) {
  const image = resolveImage(post.featured_image_url);
  const paragraphs = stripHtml(post.content)
    .split(/(?<=\.)\s+(?=[A-Z])/)
    .reduce((acc, sentence) => {
      if (!acc.length || acc[acc.length - 1].length > 320) acc.push(sentence);
      else acc[acc.length - 1] += ` ${sentence}`;
      return acc;
    }, [])
    .slice(0, 40)
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join("\n");

  return `<article>
  <h1>${escapeHtml(post.title || "")}</h1>
  <time datetime="${escapeHtml(post.published_at || "")}">${escapeHtml(
    (post.published_at || "").slice(0, 10),
  )}</time>
  <img src="${escapeHtml(image)}" alt="${escapeHtml(post.title || "")}" width="1200" height="630">
  ${paragraphs}
</article>`;
}

async function loadShell(req) {
  const host = req.headers["x-forwarded-host"] || req.headers.host || "metsxmfanzone.com";
  const proto = req.headers["x-forwarded-proto"] || "https";
  // Root path only — never /blog/*, so this can never call back into itself.
  const res = await fetch(`${proto}://${host}/`, {
    headers: { "user-agent": "metsxmfanzone-blog-renderer" },
  });
  if (!res.ok) throw new Error(`shell ${res.status}`);
  return res.text();
}

export default async function handler(req, res) {
  const slugParam = req.query?.slug;
  const slug = decodeURIComponent(
    (Array.isArray(slugParam) ? slugParam.join("/") : slugParam || "").trim(),
  );

  try {
    if (!slug) {
      res.status(400).send("Missing slug");
      return;
    }

    const query =
      `${SUPABASE_URL}/rest/v1/blog_posts?slug=eq.${encodeURIComponent(slug)}` +
      `&published=eq.true&select=title,excerpt,content,featured_image_url,published_at,updated_at,category&limit=1`;

    const [shell, postRes] = await Promise.all([
      loadShell(req),
      fetch(query, {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      }),
    ]);

    const rows = postRes.ok ? await postRes.json() : [];
    const post = Array.isArray(rows) ? rows[0] : null;

    if (!post) {
      // Unknown slug: hand the app the shell so it can show its own 404 page.
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
      res.status(404).send(shell);
      return;
    }

    let html = shell;
    const headEnd = html.indexOf("</head>");
    if (headEnd !== -1) {
      const head = stripExistingMeta(html.slice(0, headEnd));
      html = head + buildHead(post, slug) + html.slice(headEnd);
    }
    // Replace everything inside #root (the prerendered homepage markup) with
    // this article, using the last </div> before the first <script> as the end.
    const rootMatch = html.match(/<div id="root"[^>]*>/);
    if (rootMatch) {
      const start = rootMatch.index + rootMatch[0].length;
      const scriptAt = html.indexOf("<script", start);
      const endAt = html.lastIndexOf("</div>", scriptAt === -1 ? html.length : scriptAt);
      if (endAt > start) {
        html = html.slice(0, start) + buildBody(post) + html.slice(endAt);
      }
    }

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=300, stale-while-revalidate=600");
    res.status(200).send(html);
  } catch (err) {
    // Never fail the page: fall back to the plain app shell.
    try {
      const shell = await loadShell(req);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.status(200).send(shell);
    } catch {
      res.status(500).send("Internal error");
    }
  }
}
