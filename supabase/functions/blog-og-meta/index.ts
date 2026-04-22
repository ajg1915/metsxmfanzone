import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

const SITE_URL = Deno.env.get("PUBLIC_SITE_URL") || "https://metsxmfanzone.com";

const escapeHtml = (input: string) =>
  input.replace(/[&<>"']/g, (m) =>
    ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[m] || m)
  );

const stripHtml = (input: string) =>
  input.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

const CRAWLER_USER_AGENTS = [
  "facebookexternalhit",
  "Facebot",
  "Twitterbot",
  "LinkedInBot",
  "WhatsApp",
  "Slackbot",
  "TelegramBot",
  "DiscordBot",
  "pinterest",
  "redditbot",
  "Googlebot",
];

function isCrawler(userAgent: string): boolean {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return CRAWLER_USER_AGENTS.some((bot) => ua.includes(bot.toLowerCase()));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    // Accept slug from ?slug=... OR from path segment (/blog-og-meta/<slug>)
    let slug = url.searchParams.get("slug");
    if (!slug) {
      const segments = url.pathname.split("/").filter(Boolean);
      const idx = segments.indexOf("blog-og-meta");
      if (idx !== -1 && segments[idx + 1]) {
        slug = decodeURIComponent(segments[idx + 1]);
      }
    }

    if (!slug) {
      return new Response("Missing slug parameter", {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "text/plain; charset=utf-8",
        },
      });
    }

    const encodedSlug = encodeURIComponent(slug);
    const postUrl = `${SITE_URL}/blog/${encodedSlug}`;
    const userAgent = req.headers.get("user-agent") || "";
    const crawler = isCrawler(userAgent);

    // IMPORTANT: Always return the OG HTML (even for non-crawler user agents).
    // Some platforms fetch with generic user agents; if we 302, they end up scraping
    // the SPA index.html and show the homepage OG instead of the article.
    //
    // For humans, we add a meta-refresh redirect inside the HTML so clicking the
    // shared link still lands on the real article URL.


    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const { data: post, error } = await supabase
      .from("blog_posts")
      .select(
        "id, title, slug, excerpt, content, featured_image_url, category, tags, published_at"
      )
      .eq("slug", slug)
      .eq("published", true)
      .maybeSingle();

    if (error || !post) {
      return new Response("Post not found", {
        status: 404,
        headers: {
          ...corsHeaders,
          "Content-Type": "text/plain; charset=utf-8",
        },
      });
    }

    // Important: set og:url to the *share URL* (this function endpoint), not the blog URL,
    // otherwise some platforms canonicalize to /blog/:slug and fall back to your site-wide OG.
    const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
    const sharePageUrl = supabaseUrl
      ? `${supabaseUrl}/functions/v1/blog-og-meta?slug=${encodedSlug}`
      : url.toString();


    // Ensure proper absolute image URL (avoid base64)
    let socialImage = post.featured_image_url || `${SITE_URL}/logo-512.png`;
    if (socialImage.startsWith("data:")) {
      socialImage = `${SITE_URL}/logo-512.png`;
    } else if (!socialImage.startsWith("http")) {
      socialImage = `${SITE_URL}${socialImage}`;
    }

    const socialTitle = `${post.title} | MetsXMFanZone`;

    const rawDescription =
      (post.excerpt && post.excerpt.trim().length > 0
        ? post.excerpt
        : stripHtml(post.content || "")) || post.title;

    const socialDescription =
      rawDescription.length > 160
        ? rawDescription.substring(0, 157) + "..."
        : rawDescription;

    const publishedTime = post.published_at || new Date().toISOString();

    const tagsMetaTags = (post.tags || [])
      .map(
        (tag: string) =>
          `<meta property="article:tag" content="${escapeHtml(tag)}" />`
      )
      .join("\n    ");

    // JSON-LD structured data for richer search/social previews
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      headline: post.title,
      description: socialDescription,
      image: [socialImage],
      datePublished: publishedTime,
      dateModified: publishedTime,
      author: { "@type": "Organization", name: "MetsXMFanZone", url: SITE_URL },
      publisher: {
        "@type": "Organization",
        name: "MetsXMFanZone",
        logo: { "@type": "ImageObject", url: `${SITE_URL}/logo-512.png` },
      },
      mainEntityOfPage: { "@type": "WebPage", "@id": postUrl },
      articleSection: post.category || undefined,
      keywords: (post.tags || []).join(", ") || undefined,
    };

    // Escape values for HTML/meta attributes (prevents broken tags + improves scraper reliability)
    const safeTitleAttr = escapeHtml(socialTitle);
    const safeDescriptionAttr = escapeHtml(socialDescription);
    const safePostTitleAttr = escapeHtml(post.title);
    const safeCategoryAttr = escapeHtml(post.category || "");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(socialTitle)}</title>
    <meta name="description" content="${safeDescriptionAttr}">

    ${crawler ? "" : `<meta http-equiv=\"refresh\" content=\"0;url=${postUrl}\">`}

    <!-- Facebook App ID -->
    <meta property="fb:app_id" content="1151558476948104" />

    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="article">
    <meta property="og:url" content="${sharePageUrl}">
    <meta property="og:site_name" content="MetsXMFanZone">
    <meta property="og:title" content="${safeTitleAttr}">
    <meta property="og:description" content="${safeDescriptionAttr}">
    <meta property="og:image" content="${socialImage}">
    <meta property="og:image:secure_url" content="${socialImage}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="${safePostTitleAttr}">
    <meta property="og:locale" content="en_US">

    <!-- Article metadata -->
    <meta property="article:published_time" content="${publishedTime}">
    <meta property="article:modified_time" content="${publishedTime}">
    <meta property="article:section" content="${safeCategoryAttr}">
    <meta property="article:author" content="MetsXMFanZone">
    ${tagsMetaTags}

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:site" content="@metsxmfanzone">
    <meta name="twitter:creator" content="@metsxmfanzone">
    <meta name="twitter:url" content="${sharePageUrl}">
    <meta name="twitter:title" content="${safeTitleAttr}">
    <meta name="twitter:description" content="${safeDescriptionAttr}">
    <meta name="twitter:image" content="${socialImage}">
    <meta name="twitter:image:alt" content="${safePostTitleAttr}">

    <!-- Canonical (real article URL) -->
    <link rel="canonical" href="${postUrl}">

    <!-- Structured Data -->
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body>
    <div style="font-family: system-ui, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; text-align: center;">
        <h1 style="margin-bottom: 16px;">${escapeHtml(post.title)}</h1>
        <p style="color: #666; font-size: 18px; line-height: 1.6;">${escapeHtml(socialDescription)}</p>
        <p style="color: #999; margin-top: 20px;">This is the share preview page for social media crawlers.</p>
        <p style="margin-top: 12px;"><a href="${postUrl}">Continue to the article</a></p>
    </div>
</body>
</html>`;

    const headers = new Headers(corsHeaders);
    headers.set("Cache-Control", "public, max-age=3600, s-maxage=7200");
    headers.set("Content-Type", "text/html; charset=utf-8");

    return new Response(html, {
      headers,
      status: 200,
    });

  } catch (error) {
    console.error("Error generating meta tags:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json; charset=utf-8",
      },
    });
  }
});
