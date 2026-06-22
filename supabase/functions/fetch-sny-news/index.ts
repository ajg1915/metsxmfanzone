// Fetches SNY Mets RSS feed, parses items, returns JSON. Cached 24h via CDN.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FEED_URL = "https://sny.tv/mets-feed";

function pick(block: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = block.match(re);
  if (!m) return "";
  let v = m[1].trim();
  v = v.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "");
  return v.trim();
}

function firstImage(block: string): string {
  // Prefer a 1024-wide media:content
  const all = [...block.matchAll(/<media:content[^>]*url="([^"]+)"[^>]*medium="image"[^>]*>/g)];
  if (all.length) {
    const preferred = all.find((m) => /width="(1024|1152|1280)"/.test(m[0]));
    return (preferred ?? all[0])[1];
  }
  const thumb = block.match(/<media:thumbnail[^>]*url="([^"]+)"/);
  return thumb?.[1] ?? "";
}

function parse(xml: string) {
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => {
    const b = m[1];
    return {
      title: pick(b, "title"),
      link: pick(b, "link"),
      description: pick(b, "description").replace(/<[^>]+>/g, "").trim(),
      pubDate: pick(b, "pubDate"),
      creator: pick(b, "dc:creator"),
      image: firstImage(b),
    };
  });
  return items;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const res = await fetch(FEED_URL, { headers: { "User-Agent": "MetsXMFanZone/1.0" } });
    if (!res.ok) throw new Error(`Upstream ${res.status}`);
    const xml = await res.text();
    const items = parse(xml).slice(0, 20);
    return new Response(JSON.stringify({ items, fetchedAt: new Date().toISOString() }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e), items: [] }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
