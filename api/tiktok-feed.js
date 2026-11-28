// Latest posts from the @metsxmfanzone TikTok account, for the members' TikTok row.
// TikTok has no public feed, so this tries RSSHub mirrors, then the public profile page.
// Cached for 30 minutes. If nothing comes back the site shows TikTok's own profile embed.

const USERNAME = "metsxmfanzone";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const RSS_ENDPOINTS = [
  `https://rsshub.app/tiktok/user/@${USERNAME}`,
  `https://rsshub.rssforever.com/tiktok/user/@${USERNAME}`,
  `https://rss.shab.fun/tiktok/user/@${USERNAME}`,
  `https://rsshub.pseudoyu.com/tiktok/user/@${USERNAME}`,
];

const pick = (re, s) => (s.match(re) || [])[1] || "";
const decode = (s) =>
  s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");

function parseRss(xml) {
  return xml
    .split(/<item[\s>]/i)
    .slice(1)
    .map((raw) => {
      const b = raw.split(/<\/item>/i)[0];
      const url = pick(/<link>(?:<!\[CDATA\[)?([^<\]]+)/i, b).trim();
      const id = pick(/\/video\/(\d+)/, url);
      if (!id) return null;
      const desc = pick(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i, b);
      const title = decode(pick(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i, b).trim());
      const date = pick(/<pubDate>([^<]+)<\/pubDate>/i, b);
      return {
        id,
        url: `https://www.tiktok.com/@${USERNAME}/video/${id}`,
        title: title || "TikTok video",
        thumbnail: decode(pick(/<img[^>]+src="([^"]+)"/i, desc) || pick(/<media:thumbnail[^>]+url="([^"]+)"/i, b)),
        publishedAt: date ? new Date(date).toISOString() : null,
      };
    })
    .filter(Boolean);
}

async function fromRss() {
  for (const url of RSS_ENDPOINTS) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(6000) });
      if (!r.ok) continue;
      const items = parseRss(await r.text());
      if (items.length) return items;
    } catch (_) { /* next mirror */ }
  }
  return [];
}

async function fromProfile() {
  try {
    const r = await fetch(`https://www.tiktok.com/@${USERNAME}`, {
      headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
      signal: AbortSignal.timeout(6000),
    });
    const html = await r.text();
    const json = pick(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/, html);
    if (!json) return [];
    const scope = JSON.parse(json)?.__DEFAULT_SCOPE__ || {};
    const list = scope["webapp.user-detail"]?.itemList || scope["webapp.video-list"]?.itemList || [];
    return list
      .map((v) => v?.id && {
        id: String(v.id),
        url: `https://www.tiktok.com/@${USERNAME}/video/${v.id}`,
        title: v.desc || "TikTok video",
        thumbnail: v.video?.cover || v.video?.originCover || "",
        publishedAt: v.createTime ? new Date(v.createTime * 1000).toISOString() : null,
      })
      .filter(Boolean);
  } catch (_) {
    return [];
  }
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  let items = await fromRss();
  if (!items.length) items = await fromProfile();
  res.setHeader(
    "Cache-Control",
    items.length ? "public, s-maxage=1800, stale-while-revalidate=86400" : "public, s-maxage=300",
  );
  res.status(200).send(JSON.stringify({ username: USERNAME, items: items.slice(0, 9) }));
}
