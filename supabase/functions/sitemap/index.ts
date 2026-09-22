import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Content-Type': 'application/xml',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('VITE_SUPABASE_PUBLISHABLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const baseUrl = 'https://metsxmfanzone.com';
    const today = new Date().toISOString().split('T')[0];

    // Fetch published blog posts
    const { data: posts } = await supabase
      .from('blog_posts')
      .select('slug, published_at, category')
      .eq('published', true)
      .order('published_at', { ascending: false });

    // Fetch published podcasts
    const { data: podcasts } = await supabase
      .from('podcasts')
      .select('id, published_at, title')
      .eq('published', true)
      .order('published_at', { ascending: false });

    // Fetch upcoming events
    const { data: events } = await supabase
      .from('events')
      .select('id, event_date, title')
      .eq('published', true)
      .order('event_date', { ascending: false });

    // All static pages with priorities
    const staticPages = [
      { url: '/', changefreq: 'daily', priority: '1.0', lastmod: today },
      { url: '/blog', changefreq: 'daily', priority: '0.9' },
      { url: '/podcast', changefreq: 'weekly', priority: '0.9' },
      { url: '/community', changefreq: 'daily', priority: '0.85' },
      { url: '/mets-roster', changefreq: 'weekly', priority: '0.85' },
      { url: '/mets-schedule-2026', changefreq: 'monthly', priority: '0.85' },
      { url: '/mets-scores', changefreq: 'daily', priority: '0.8' },
      { url: '/mets-gamecast', changefreq: 'daily', priority: '0.8' },
      { url: '/mets-history', changefreq: 'monthly', priority: '0.75' },
      { url: '/metsxmfanzone', changefreq: 'daily', priority: '0.85' },
      { url: '/mlb-network', changefreq: 'daily', priority: '0.8' },
      { url: '/espn-network', changefreq: 'daily', priority: '0.8' },
      { url: '/pix11-network', changefreq: 'daily', priority: '0.75' },
      { url: '/gallery', changefreq: 'weekly', priority: '0.75' },
      { url: '/video-gallery', changefreq: 'weekly', priority: '0.75' },
      { url: '/replay-games', changefreq: 'weekly', priority: '0.7' },
      { url: '/nl-scores', changefreq: 'daily', priority: '0.7' },
      { url: '/pricing', changefreq: 'monthly', priority: '0.8' },
      { url: '/shop', changefreq: 'weekly', priority: '0.75' },
      { url: '/merch', changefreq: 'weekly', priority: '0.7' },
      { url: '/whats-new', changefreq: 'weekly', priority: '0.65' },
      { url: '/help-center', changefreq: 'monthly', priority: '0.6' },
      { url: '/contact', changefreq: 'monthly', priority: '0.65' },
      { url: '/feedback', changefreq: 'monthly', priority: '0.6' },
      { url: '/faqs', changefreq: 'monthly', priority: '0.6' },
      { url: '/business-partner', changefreq: 'monthly', priority: '0.5' },
      { url: '/podcaster-application', changefreq: 'monthly', priority: '0.5' },
      // Auth & payment pages
      { url: '/auth', changefreq: 'monthly', priority: '0.4' },
      { url: '/writer-auth', changefreq: 'monthly', priority: '0.3' },
      { url: '/paypal-success', changefreq: 'monthly', priority: '0.4' },
      { url: '/payment-success', changefreq: 'monthly', priority: '0.4' },
      { url: '/payment-error', changefreq: 'monthly', priority: '0.4' },
      // Help center sub-pages
      { url: '/help/create-account', changefreq: 'monthly', priority: '0.5' },
      { url: '/help/navigate-platform', changefreq: 'monthly', priority: '0.5' },
      { url: '/help/watch-streams', changefreq: 'monthly', priority: '0.5' },
      { url: '/help/community-guidelines', changefreq: 'monthly', priority: '0.5' },
      { url: '/help/video-quality', changefreq: 'monthly', priority: '0.5' },
      { url: '/help/premium-content', changefreq: 'monthly', priority: '0.5' },
      { url: '/help/subscription-plans', changefreq: 'monthly', priority: '0.5' },
      { url: '/help/payment-methods', changefreq: 'monthly', priority: '0.5' },
      // Matchups
      { url: '/matchup/yankees', changefreq: 'weekly', priority: '0.7' },
      { url: '/matchup/braves', changefreq: 'weekly', priority: '0.7' },
      { url: '/matchup/astros', changefreq: 'weekly', priority: '0.7' },
      { url: '/matchup/cardinals', changefreq: 'weekly', priority: '0.7' },
      { url: '/matchup/nationals', changefreq: 'weekly', priority: '0.7' },
      { url: '/matchup/redsox', changefreq: 'weekly', priority: '0.7' },
      { url: '/matchup/bluejays', changefreq: 'weekly', priority: '0.7' },
      // Legal
      { url: '/privacy', changefreq: 'yearly', priority: '0.3' },
      { url: '/terms', changefreq: 'yearly', priority: '0.3' },
    ];

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n';
    xml += '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"\n';
    xml += '        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n';

    // Homepage with image
    xml += '  <url>\n';
    xml += `    <loc>${baseUrl}/</loc>\n`;
    xml += `    <lastmod>${today}</lastmod>\n`;
    xml += '    <changefreq>daily</changefreq>\n';
    xml += '    <priority>1.0</priority>\n';
    xml += '    <image:image>\n';
    xml += `      <image:loc>${baseUrl}/og-image.png</image:loc>\n`;
    xml += '      <image:title>MetsXMFanZone - New York Mets Fan Community</image:title>\n';
    xml += '    </image:image>\n';
    xml += '  </url>\n';

    // Static pages (skip homepage, already added)
    staticPages.filter(p => p.url !== '/').forEach(page => {
      xml += '  <url>\n';
      xml += `    <loc>${baseUrl}${page.url}</loc>\n`;
      if (page.lastmod) xml += `    <lastmod>${page.lastmod}</lastmod>\n`;
      xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
      xml += `    <priority>${page.priority}</priority>\n`;
      xml += '  </url>\n';
    });

    // Blog posts
    if (posts && posts.length > 0) {
      posts.forEach(post => {
        xml += '  <url>\n';
        xml += `    <loc>${baseUrl}/blog/${post.slug}</loc>\n`;
        if (post.published_at) {
          xml += `    <lastmod>${post.published_at.split('T')[0]}</lastmod>\n`;
        }
        xml += '    <changefreq>monthly</changefreq>\n';
        xml += '    <priority>0.7</priority>\n';
        xml += '  </url>\n';
      });
    }

    xml += '</urlset>';

    return new Response(xml, {
      headers: { ...corsHeaders, 'Cache-Control': 'public, max-age=3600' },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
