// Fetches latest TikTok posts for a given username via RSSHub (public instance).
// Returns a normalized JSON list { id, url, thumbnail, title, publishedAt }.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const USERNAME = "onbmedia";

const RSS_ENDPOINTS = [
  `https://rsshub.app/tiktok/user/@${USERNAME}`,
  `https://rss.shab.fun/tiktok/user/@${USERNAME}`,
];

function pick(re: RegExp, src: string): string | null {
  const m = src.match(re);
  return m ? m[1] : null;
}

function parseItems(xml: string) {
  const items: any[] = [];
  const itemBlocks = xml.split(/<item[\s>]/i).slice(1);
  for (const raw of itemBlocks) {
    const block = raw.split(/<\/item>/i)[0];
    const link = pick(/<link>([^<]+)<\/link>/i, block) || "";
    const title = (pick(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i, block) || "").trim();
    const desc = pick(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i, block) || "";
    const pubDate = pick(/<pubDate>([^<]+)<\/pubDate>/i, block) || "";
    const thumb = pick(/<img[^>]+src="([^"]+)"/i, desc) || pick(/<media:thumbnail[^>]+url="([^"]+)"/i, block) || "";
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  for (const endpoint of RSS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        headers: { "User-Agent": "Mozilla/5.0 MetsXMFanZone/1.0" },
      });
      if (!res.ok) continue;
      const xml = await res.text();
      const items = parseItems(xml).slice(0, 9);
      if (items.length === 0) continue;
      return new Response(
        JSON.stringify({ username: USERNAME, items }),
        { headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=900" } },
      );
    } catch (_) { /* try next */ }
  }

  return new Response(
    JSON.stringify({ username: USERNAME, items: [], error: "Feed temporarily unavailable" }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
