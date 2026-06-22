// Fetches latest TikTok posts for @onbmedia.
// Priority: 1) TikTok connector (official API) if connected account matches,
//           2) RSSHub public mirrors as fallback.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const USERNAME = "onbmedia";
const GATEWAY_URL = "https://connector-gateway.lovable.dev/tiktok";

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

async function fromConnector() {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const TIKTOK_API_KEY = Deno.env.get("TIKTOK_API_KEY");
  if (!LOVABLE_API_KEY || !TIKTOK_API_KEY) return null;

  // Confirm the connected account is @onbmedia
  const profileRes = await fetch(
    `${GATEWAY_URL}/user/info/?fields=open_id,display_name,username`,
    {
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TIKTOK_API_KEY,
      },
    },
  );
  if (!profileRes.ok) return null;
  const profile = await profileRes.json().catch(() => null);
  const connectedHandle: string | undefined =
    profile?.data?.user?.username || profile?.data?.user?.display_name;
  if (!connectedHandle) return null;
  if (connectedHandle.toLowerCase() !== USERNAME.toLowerCase()) {
    // Connected to a different account — fall back to RSS
    return null;
  }

  const listRes = await fetch(
    `${GATEWAY_URL}/video/list/?fields=id,title,video_description,share_url,cover_image_url,create_time`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TIKTOK_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ max_count: 9 }),
    },
  );
  if (!listRes.ok) return null;
  const data = await listRes.json().catch(() => null);
  const videos: any[] = data?.data?.videos || [];
  if (videos.length === 0) return null;

  return videos.map((v) => ({
    id: String(v.id),
    url: v.share_url || `https://www.tiktok.com/@${USERNAME}/video/${v.id}`,
    thumbnail: v.cover_image_url || "",
    title: v.title || v.video_description || "TikTok post",
    publishedAt: v.create_time ? new Date(v.create_time * 1000).toISOString() : null,
  }));
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

  let items: any[] | null = null;
  let source = "none";

  try {
    items = await fromConnector();
    if (items) source = "connector";
  } catch (_) { /* ignore */ }

  if (!items) {
    items = await fromRss();
    if (items) source = "rss";
  }

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
