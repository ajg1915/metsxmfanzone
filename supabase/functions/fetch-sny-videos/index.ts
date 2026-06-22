import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SNY_CHANNEL_ID = 'UCL_OEjsHTwsHK6WKWs7s7Uw'; // SNY official YouTube channel
const FEED_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${SNY_CHANNEL_ID}`;

function extract(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return m ? m[1].trim() : '';
}
function extractAttr(xml: string, tag: string, attr: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*\\b${attr}="([^"]+)"`));
  return m ? m[1] : '';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const res = await fetch(FEED_URL, {
      headers: { 'User-Agent': 'MetsXMFanZone/1.0' },
    });
    if (!res.ok) throw new Error(`Feed fetch failed: ${res.status}`);
    const xml = await res.text();

    const entries = xml.split('<entry>').slice(1).map((c) => '<entry>' + c.split('</entry>')[0] + '</entry>');

    const videos = entries
      .map((entry) => {
        const videoId = extract(entry, 'yt:videoId');
        const title = extract(entry, 'title').replace(/<!\[CDATA\[|\]\]>/g, '');
        const published = extract(entry, 'published');
        const description = extract(entry, 'media:description').replace(/<!\[CDATA\[|\]\]>/g, '');
        const thumbnail = extractAttr(entry, 'media:thumbnail', 'url') || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
        return { videoId, title, published, description, thumbnail };
      })
      .filter((v) => v.videoId && /mets|soto|mendoza|alonso|lindor|nimmo|citi field|amazin/i.test(v.title + ' ' + v.description))
      .slice(0, 15);

    return new Response(JSON.stringify({ videos }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    });
  } catch (err) {
    console.error('fetch-sny-videos error', err);
    return new Response(JSON.stringify({ error: (err as Error).message, videos: [] }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
