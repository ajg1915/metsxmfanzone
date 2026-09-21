/**
 * Cloudflare Worker: Blog Open Graph Proxy
 * ----------------------------------------
 * Purpose:
 *   Make /blog/:slug share previews work on Facebook, WhatsApp, iMessage,
 *   LinkedIn, Slack, Telegram, Discord, Pinterest, Reddit, etc.
 *
 *   These crawlers fetch the URL with a static HTTP request — they do NOT
 *   execute JavaScript, and they cannot send the Supabase `apikey` header
 *   that the Supabase API gateway requires. So they normally see the SPA
 *   shell (index.html) and fall back to your site-wide OG image/title.
 *
 *   This Worker sits in front of metsxmfanzone.com and:
 *     1. Detects crawler User-Agents on /blog/:slug requests.
 *     2. Calls the `blog-og-meta` Supabase Edge Function on their behalf,
 *        injecting the `apikey` header server-side.
 *     3. Returns the OG-tagged HTML directly to the crawler.
 *     4. Lets all human / non-crawler traffic pass through untouched to
 *        Lovable's hosting (the SPA loads as normal).
 *
 * ----------------------------------------------------------------------
 * SETUP (one-time)
 * ----------------------------------------------------------------------
 * 1. Cloudflare Dashboard → your domain (metsxmfanzone.com)
 *    → Workers & Pages → Create Worker → paste this file.
 * 2. Save and Deploy.
 * 3. Workers & Pages → your worker → Settings → Triggers → Routes:
 *      Add route:  metsxmfanzone.com/blog/*       (Zone: metsxmfanzone.com)
 *      Add route:  www.metsxmfanzone.com/blog/*   (Zone: metsxmfanzone.com)
 * 4. Workers & Pages → your worker → Settings → Variables:
 *      Add Environment Variable:
 *        Name:  SUPABASE_ANON_KEY
 *        Value: <paste the anon key from Lovable Cloud / Supabase>
 *        (Encrypt is recommended.)
 * 5. Test:
 *      curl -A "facebookexternalhit/1.1" \
 *        https://metsxmfanzone.com/blog/<any-published-slug>
 *      → should return HTML containing <meta property="og:image" ...>
 *        with the article's image, NOT the homepage OG image.
 *
 *      Then re-scrape on:
 *        - Facebook:  https://developers.facebook.com/tools/debug/
 *        - LinkedIn:  https://www.linkedin.com/post-inspector/
 *        - Twitter:   https://cards-dev.twitter.com/validator (or just paste in DM)
 * ----------------------------------------------------------------------
 */

const SUPABASE_PROJECT_REF = "rdmrxeplasttewtlfetc";
const EDGE_FUNCTION_URL = `https://${SUPABASE_PROJECT_REF}.supabase.co/functions/v1/blog-og-meta`;

const CRAWLER_UA_PATTERNS = [
  "facebookexternalhit",
  "facebot",
  "twitterbot",
  "linkedinbot",
  "whatsapp",
  "slackbot",
  "telegrambot",
  "discordbot",
  "pinterest",
  "redditbot",
  "googlebot",
  "bingbot",
  "applebot",
  "embedly",
  "quora link preview",
  "showyoubot",
  "outbrain",
  "vkshare",
  "w3c_validator",
  "skypeuripreview",
  "nuzzel",
  "bitlybot",
  "tumblr",
  "yahoo",
  "bingpreview",
  "ia_archiver",
];

function isCrawler(userAgent) {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();

  // Facebook in-app browser contains FBAN/FBAV/FBIOS — NOT a crawler, let it through
  if (ua.includes("fban") || ua.includes("fbav") || ua.includes("fbios")) {
    return false;
  }

  return CRAWLER_UA_PATTERNS.some((p) => ua.includes(p));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Only intercept /blog/:slug GET requests.
    const blogMatch = url.pathname.match(/^\/blog\/([^/?#]+)\/?$/);
    if (!blogMatch || request.method !== "GET") {
      return fetch(request);
    }

    const userAgent = request.headers.get("user-agent") || "";
    if (!isCrawler(userAgent)) {
      // Real human → let Lovable's SPA handle it normally.
      return fetch(request);
    }

    const slug = decodeURIComponent(blogMatch[1]);
    const anonKey = env.SUPABASE_ANON_KEY;

    if (!anonKey) {
      // Misconfigured worker — fail open to the SPA so the link still works.
      return fetch(request);
    }

    try {
      const ogUrl = `${EDGE_FUNCTION_URL}?slug=${encodeURIComponent(slug)}`;
      const ogResponse = await fetch(ogUrl, {
        method: "GET",
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          "User-Agent": userAgent,
          Accept: "text/html",
        },
        // Crawlers expect a fast response — cache aggressively at the edge.
        cf: { cacheTtl: 3600, cacheEverything: true },
      });

      if (!ogResponse.ok) {
        // Edge function failed → fall back to SPA.
        return fetch(request);
      }

      const html = await ogResponse.text();
      return new Response(html, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=3600, s-maxage=7200",
          "X-OG-Proxy": "metsxmfanzone-blog",
        },
      });
    } catch (err) {
      // Any failure → fall back to SPA so links never break.
      return fetch(request);
    }
  },
};
