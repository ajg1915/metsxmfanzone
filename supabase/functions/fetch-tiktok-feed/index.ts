// Fetches latest TikTok posts for @metsxmfanzone.
// Reads the account's public RSS feed through RSSHub mirrors.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const USERNAME = "metsxmfanzone";

const RSS_ENDPOINTS = [
  `https://rsshub.app/tiktok/user/@${USERNAME}`,
  `https://rss.shab.fun/tiktok/user/@${USERNAME}`,
  `https://rsshub.rssforever.com/tiktok/user/@${USERNAME}`,
];

function pick(re: RegExp, src: string): string | null {
  const m = src.match(re);
  return m ? m[1] : null;
}

function parseRss(xml: string) {
  const items: any[] = [];
  const blocks = xml.split(/<item[\s>]/i).slice(1);
  for (const raw of blocks) {
    const block = raw.split(/<\/item>/i)[0];
    const link = pick(/<link>([^<]+)<\/link>/i, block) || "";
    const title = (pick(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i, block) || "").trim();
    const desc = pick(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i, block) || "";
    const pubDate = pick(/<pubDate>([^<]+)<\/pubDate>/i, block) || "";
    const thumb =
      pick(/<img[^>]+src="([^"]+)"/i, desc) ||
      pick(/<media:thumbnail[^>]+url="([^"]+)"/i, block) ||
      "";
    const idMatch = link.match(/\/video\/(\d+)/);
    items.push({
      id: idMatch ? idMatch[1] : link,
      url: link,
      thumbnail: thumb,
      title: title || "TikTok post",
      publishedAt: pubDate ? new Date(pubDate).toISOString() : null,
    });
  }
  return items;
}

async function fromRss() {
  for (const endpoint of RSS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        headers: { "User-Agent": "Mozilla/5.0 MetsXMFanZone/1.0" },
      });
      if (!res.ok) continue;
      const xml = await res.text();
      const items = parseRss(xml);
      if (items.length > 0) return items.slice(0, 9);
    } catch (_) { /* try next */ }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const items = await fromRss();
  const source = items ? "rss" : "none";

  return new Response(
    JSON.stringify({
      username: USERNAME,
      profileUrl: `https://www.tiktok.com/@${USERNAME}`,
      items: items || [],
      source,
    }),
    {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=900",
      },
    },
  );
});
