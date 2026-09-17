import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SNY_CHANNEL_ID = 'UCL_OEjsHTwsHK6WKWs7s7Uw'; // SNY official YouTube channel
const FEED_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${SNY_CHANNEL_ID}`;
const CHANNEL_URL = 'https://www.youtube.com/@SNYtv/videos';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const METS_RE = /mets|soto|mendoza|alonso|lindor|nimmo|citi field|amazin/i;

type Video = {
  videoId: string;
  title: string;
  published: string;
  description: string;
  thumbnail: string;
};

function extract(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return m ? m[1].trim() : '';
}
function extractAttr(xml: string, tag: string, attr: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*\\b${attr}="([^"]+)"`));
  return m ? m[1] : '';
}

// Primary source: the channel RSS feed (fast, but YouTube sometimes 404/500s it).
async function fromFeed(): Promise<Video[]> {
  const res = await fetch(FEED_URL, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Feed fetch failed: ${res.status}`);
  const xml = await res.text();
  const entries = xml
    .split('<entry>')
    .slice(1)
    .map((c) => '<entry>' + c.split('</entry>')[0] + '</entry>');

  return entries.map((entry) => {
    const videoId = extract(entry, 'yt:videoId');
    const title = extract(entry, 'title').replace(/<!\[CDATA\[|\]\]>/g, '');
    const published = extract(entry, 'published');
    const description = extract(entry, 'media:description').replace(/<!\[CDATA\[|\]\]>/g, '');
    const thumbnail =
      extractAttr(entry, 'media:thumbnail', 'url') || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    return { videoId, title, published, description, thumbnail };
  });
}

// Fallback source: parse the public channel page.
async function fromChannelPage(): Promise<Video[]> {
  const res = await fetch(CHANNEL_URL, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' },
  });
  if (!res.ok) throw new Error(`Channel page fetch failed: ${res.status}`);
  const html = await res.text();

  const out: Video[] = [];
  const seen = new Set<string>();

  for (const chunk of html.split('"richItemRenderer":{').slice(1)) {
    const block = chunk.slice(0, 6000);
    const videoId = block.match(/"videoId":"([\w-]{11})"/)?.[1] ??
      block.match(/\/vi\/([\w-]{11})\//)?.[1] ?? '';
    const title =
      block.match(/"lockupMetadataViewModel":\{"title":\{"content":"((?:[^"\\]|\\.)*)"/)?.[1] ??
      block.match(/"title":\{"runs":\[\{"text":"((?:[^"\\]|\\.)*)"/)?.[1] ??
      '';
    if (!videoId || !title || seen.has(videoId)) continue;
    seen.add(videoId);

    const ago = block.match(/"text":\{"content":"(\d+\s+\w+\s+ago)"/)?.[1] ?? '';
    out.push({
      videoId,
      title: JSON.parse(`"${title}"`),
      published: ago,
      description: '',
      thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    });
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  let all: Video[] = [];
  try {
    all = await fromFeed();
  } catch (feedErr) {
    console.warn('fetch-sny-videos: feed unavailable, falling back to channel page', feedErr);
    try {
      all = await fromChannelPage();
    } catch (pageErr) {
      console.error('fetch-sny-videos: all sources failed', pageErr);
      // Never 500 the client — the section just renders empty.
      return new Response(JSON.stringify({ videos: [], source: 'none' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  const metsOnly = all.filter((v) => METS_RE.test(`${v.title} ${v.description}`));
  const videos = (metsOnly.length ? metsOnly : all).slice(0, 15);

  return new Response(JSON.stringify({ videos }), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
});
