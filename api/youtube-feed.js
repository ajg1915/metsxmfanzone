// Latest videos from the MetsXMFanZone YouTube channel, for the TV app's YouTube row.
// Finds the channel from its @handle, reads the channel's public video feed, and returns
// a short JSON list. Cached for 30 minutes so it barely touches the server.

const HANDLE = "MetsXMFanZonePodcast";
const UA = "Mozilla/5.0 (compatible; MetsXMFanZone/1.0)";

const decode = (s) =>
  s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");

async function channelId() {
  const res = await fetch(`https://www.youtube.com/@${HANDLE}`, {
    headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9", Cookie: "CONSENT=YES+1" },
  });
  const html = await res.text();
  const m =
    html.match(/"externalId":"(UC[\w-]{22})"/) ||
    html.match(/"channelId":"(UC[\w-]{22})"/) ||
    html.match(/channel_id=(UC[\w-]{22})/);
  return m ? m[1] : null;
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  try {
    const id = await channelId();
    if (!id) throw new Error("channel not found");
    const feed = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${id}`, { headers: { "User-Agent": UA } });
    if (!feed.ok) throw new Error(`feed ${feed.status}`);
    const xml = await feed.text();
    const videos = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)]
      .map((m) => {
        const e = m[1];
        const vid = e.match(/<yt:videoId>([\w-]{11})<\/yt:videoId>/)?.[1];
        const title = e.match(/<title>([\s\S]*?)<\/title>/)?.[1];
        const published = e.match(/<published>([^<]+)<\/published>/)?.[1];
        if (!vid || !title) return null;
        return { id: vid, title: decode(title), published: published || null, thumbnail: `https://i.ytimg.com/vi/${vid}/hqdefault.jpg` };
      })
      .filter(Boolean)
      .slice(0, 15);
    res.setHeader("Cache-Control", "public, s-maxage=1800, stale-while-revalidate=86400");
    res.status(200).send(JSON.stringify({ videos }));
  } catch (err) {
    res.setHeader("Cache-Control", "public, s-maxage=120");
    res.status(200).send(JSON.stringify({ videos: [], error: String(err?.message || err) }));
  }
}
