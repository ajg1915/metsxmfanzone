import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

// Social media crawler user agents
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
];

const SITE_URL = Deno.env.get("PUBLIC_SITE_URL") || "https://www.metsxmfanzone.com";

function isCrawler(userAgent: string): boolean {
  if (!userAgent) return false;
  const lowerUA = userAgent.toLowerCase();
  return CRAWLER_USER_AGENTS.some((bot) => lowerUA.includes(bot.toLowerCase()));
}

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

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get("slug");
    const userAgent = req.headers.get("user-agent") || "";

    // Only process for crawlers with a slug
    if (!slug || !isCrawler(userAgent)) {
      const headers = new Headers(corsHeaders);
      headers.set("content-type", "application/json; charset=utf-8");
      return new Response(
        JSON.stringify({
          isCrawler: isCrawler(userAgent),
          message: "Not a crawler request or missing slug",
        }),
        {
          headers,
          status: 200,
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch blog post
    const { data: post, error } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("slug", slug)
      .eq("published", true)
      .single();

    if (error || !post) {
      console.error("Error fetching post:", error);
      return new Response("Post not found", { status: 404 });
    }

    const postUrl = `${SITE_URL}/blog/${slug}`;

    // Handle featured image (avoid base64)
    let socialImage = post.featured_image_url || `${SITE_URL}/logo-512.png`;
    if (socialImage.startsWith("data:")) {
      socialImage = `${SITE_URL}/logo-512.png`;
    } else if (!socialImage.startsWith("http")) {
      socialImage = `${SITE_URL}${socialImage}`;
    }

    // Only the site's own logo fallback has a known size (512x512). A post's own
    // featured image can be any size, so leave the size off and let crawlers measure it.
    const socialImageSize = socialImage === `${SITE_URL}/logo-512.png`
      ? `<meta property="og:image:width" content="512">\n  <meta property="og:image:height" content="512">`
      : "";

    const socialTitle = `${post.title} | MetsXMFanZone`;

    const rawDescription =
      (post.excerpt && String(post.excerpt).trim().length > 0
        ? String(post.excerpt)
        : stripHtml(String(post.content || ""))) || String(post.title);

    const socialDescription =
      rawDescription.length > 160
        ? rawDescription.substring(0, 157) + "..."
        : rawDescription;

    const tagsMetaTags = (post.tags || [])
      .map((tag: string) => `<meta property="article:tag" content="${escapeHtml(tag)}">`)
      .join("\n  ");

    const safeTitleAttr = escapeHtml(socialTitle);
    const safeDescriptionAttr = escapeHtml(socialDescription);
    const safePostTitleAttr = escapeHtml(String(post.title));

    // Generate pre-rendered HTML for crawlers
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(socialTitle)}</title>
  <meta name="description" content="${safeDescriptionAttr}">

  <!-- Facebook App ID -->
  <meta property="fb:app_id" content="1151558476948104">

  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="article">
  <meta property="og:url" content="${postUrl}">
  <meta property="og:site_name" content="MetsXMFanZone">
  <meta property="og:title" content="${safeTitleAttr}">
  <meta property="og:description" content="${safeDescriptionAttr}">
  <meta property="og:image" content="${socialImage}">
  <meta property="og:image:secure_url" content="${socialImage}">
  ${socialImageSize}
  <meta property="og:image:alt" content="${safePostTitleAttr}">
  <meta property="og:locale" content="en_US">

  <!-- Article tags -->
  <meta property="article:published_time" content="${post.published_at}">
  <meta property="article:section" content="${escapeHtml(String(post.category || ""))}">
  <meta property="article:author" content="MetsXMFanZone">
  ${tagsMetaTags}

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@metsxmfanzone">
  <meta name="twitter:url" content="${postUrl}">
  <meta name="twitter:title" content="${safeTitleAttr}">
  <meta name="twitter:description" content="${safeDescriptionAttr}">
  <meta name="twitter:image" content="${socialImage}">
  <meta name="twitter:image:alt" content="${safePostTitleAttr}">

  <link rel="canonical" href="${postUrl}" />
  <meta http-equiv="refresh" content="0;url=${postUrl}">
</head>
<body>
  <h1>${escapeHtml(String(post.title))}</h1>
  <p>${escapeHtml(socialDescription)}</p>
  <p>Redirecting to <a href="${postUrl}">${postUrl}</a>...</p>
</body>
</html>`;

    const headers = new Headers(corsHeaders);
    headers.set("content-type", "text/html; charset=utf-8");
    headers.set("cache-control", "public, max-age=3600");

    return new Response(html, { headers });
  } catch (error) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    const headers = new Headers(corsHeaders);
    headers.set("content-type", "application/json; charset=utf-8");

    return new Response(JSON.stringify({ error: errorMessage }), {
      headers,
      status: 500,
    });
  }
});
