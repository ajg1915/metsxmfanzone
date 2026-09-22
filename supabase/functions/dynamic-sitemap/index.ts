import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/xml; charset=utf-8",
  "Cache-Control": "public, max-age=3600, s-maxage=3600",
};

const BASE_URL = "https://metsxmfanzone.com";

// All static pages with their SEO priorities and change frequencies
const staticPages = [
  { url: "/", changefreq: "daily", priority: "1.0" },
  { url: "/blog", changefreq: "daily", priority: "0.9" },
  { url: "/podcast", changefreq: "weekly", priority: "0.9" },
  { url: "/community", changefreq: "daily", priority: "0.85" },
  { url: "/mets-roster", changefreq: "weekly", priority: "0.85" },
  { url: "/mets-schedule-2026", changefreq: "monthly", priority: "0.85" },
  { url: "/mets-scores", changefreq: "daily", priority: "0.8" },
  { url: "/mets-gamecast", changefreq: "daily", priority: "0.8" },
  { url: "/mets-history", changefreq: "monthly", priority: "0.75" },
  { url: "/gallery", changefreq: "weekly", priority: "0.75" },
  { url: "/video-gallery", changefreq: "weekly", priority: "0.75" },
  { url: "/pricing", changefreq: "monthly", priority: "0.8" },
  { url: "/merch", changefreq: "weekly", priority: "0.7" },
  { url: "/metsxmfanzone", changefreq: "daily", priority: "0.85" },
  { url: "/mlb-network", changefreq: "daily", priority: "0.8" },
  { url: "/espn-network", changefreq: "daily", priority: "0.8" },
  { url: "/pix11-network", changefreq: "daily", priority: "0.75" },
  { url: "/msg-network", changefreq: "daily", priority: "0.75" },
  { url: "/nl-scores", changefreq: "daily", priority: "0.7" },
  { url: "/help-center", changefreq: "monthly", priority: "0.6" },
  { url: "/contact", changefreq: "monthly", priority: "0.65" },
  { url: "/feedback", changefreq: "monthly", priority: "0.6" },
  { url: "/faqs", changefreq: "monthly", priority: "0.6" },
  { url: "/whats-new", changefreq: "weekly", priority: "0.65" },
  { url: "/business-partner", changefreq: "monthly", priority: "0.5" },
  { url: "/podcaster-application", changefreq: "monthly", priority: "0.5" },
  { url: "/privacy", changefreq: "yearly", priority: "0.3" },
  { url: "/terms", changefreq: "yearly", priority: "0.3" },
  // Auth & payment pages
  { url: "/auth", changefreq: "monthly", priority: "0.4" },
  { url: "/writer-auth", changefreq: "monthly", priority: "0.3" },
  { url: "/paypal-success", changefreq: "monthly", priority: "0.4" },
  { url: "/payment-success", changefreq: "monthly", priority: "0.4" },
  { url: "/payment-error", changefreq: "monthly", priority: "0.4" },
  // Help center sub-pages
  { url: "/help/create-account", changefreq: "monthly", priority: "0.5" },
  { url: "/help/navigate-platform", changefreq: "monthly", priority: "0.5" },
  { url: "/help/watch-streams", changefreq: "monthly", priority: "0.5" },
  { url: "/help/community-guidelines", changefreq: "monthly", priority: "0.5" },
  { url: "/help/video-quality", changefreq: "monthly", priority: "0.5" },
  { url: "/help/premium-content", changefreq: "monthly", priority: "0.5" },
  { url: "/help/subscription-plans", changefreq: "monthly", priority: "0.5" },
  { url: "/help/payment-methods", changefreq: "monthly", priority: "0.5" },
  // Matchup pages — programmatic SEO (one per opponent)
  ...[
    "yankees", "braves", "phillies", "nationals", "marlins",
    "astros", "redsox", "bluejays", "cardinals", "cubs",
    "dodgers", "giants", "padres", "rockies", "diamondbacks",
    "brewers", "reds", "pirates",
  ].map((slug) => ({
    url: `/matchup/${slug}`,
    changefreq: "weekly",
    priority: "0.75",
  })),
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all published blog posts
    const { data: blogPosts } = await supabase
      .from("blog_posts")
      .select("slug, published_at, updated_at")
      .eq("published", true)
      .order("published_at", { ascending: false });

    // Fetch published podcasts
    const { data: podcasts } = await supabase
      .from("podcasts")
      .select("id, published_at, updated_at")
      .eq("published", true)
      .order("published_at", { ascending: false })
      .limit(50);

    // Fetch published events
    const { data: events } = await supabase
      .from("events")
      .select("id, event_date, updated_at")
      .eq("published", true)
      .order("event_date", { ascending: false })
      .limit(50);

    // Fetch published videos
    const { data: videos } = await supabase
      .from("videos")
      .select("id, published_at, updated_at")
      .eq("published", true)
      .order("published_at", { ascending: false })
      .limit(100);

    const today = new Date().toISOString().split("T")[0];

    // Build XML sitemap
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n';
    xml += '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"\n';
    xml += '        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1"\n';
    xml += '        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n';

    // Add static pages
    for (const page of staticPages) {
      xml += "  <url>\n";
      xml += `    <loc>${BASE_URL}${page.url}</loc>\n`;
      xml += `    <lastmod>${today}</lastmod>\n`;
      xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
      xml += `    <priority>${page.priority}</priority>\n`;
      xml += "  </url>\n";
    }

    // Add blog posts
    if (blogPosts && blogPosts.length > 0) {
      for (const post of blogPosts) {
        const lastmod = post.updated_at?.split("T")[0] || post.published_at?.split("T")[0] || today;
        xml += "  <url>\n";
        xml += `    <loc>${BASE_URL}/blog/${post.slug}</loc>\n`;
        xml += `    <lastmod>${lastmod}</lastmod>\n`;
        xml += `    <changefreq>weekly</changefreq>\n`;
        xml += `    <priority>0.75</priority>\n`;
        xml += "  </url>\n";
      }
    }

    // Add videos if present
    if (videos && videos.length > 0) {
      for (const video of videos) {
        const lastmod = video.updated_at?.split("T")[0] || video.published_at?.split("T")[0] || today;
        xml += "  <url>\n";
        xml += `    <loc>${BASE_URL}/video-gallery?id=${video.id}</loc>\n`;
        xml += `    <lastmod>${lastmod}</lastmod>\n`;
        xml += `    <changefreq>monthly</changefreq>\n`;
        xml += `    <priority>0.6</priority>\n`;
        xml += "  </url>\n";
      }
    }

    xml += "</urlset>";

    return new Response(xml, {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error) {
    console.error("Error generating sitemap:", error);
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>',
      { status: 500, headers: corsHeaders }
    );
  }
});
