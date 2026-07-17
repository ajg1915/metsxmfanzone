import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const ORIGIN = 'http://173.56.47.85:8080';
const ALLOWED_HOST = '173.56.47.85:8080';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    // Path after the function name: /functions/v1/hls-proxy/<...>
    const idx = url.pathname.indexOf('/hls-proxy');
    let subPath = idx >= 0 ? url.pathname.slice(idx + '/hls-proxy'.length) : '';
    if (!subPath) subPath = '/hls/metsxmfanzone.m3u8';

    // Support absolute upstream via ?u= (must match allowed host)
    const uParam = url.searchParams.get('u');
    let upstream: string;
    if (uParam) {
      const target = new URL(uParam);
      if (target.host !== ALLOWED_HOST) {
        return new Response('Forbidden host', { status: 403, headers: corsHeaders });
      }
      upstream = target.toString();
    } else {
      upstream = ORIGIN + subPath;
    }

    const upstreamRes = await fetch(upstream, {
      headers: { 'User-Agent': 'Mozilla/5.0 hls-proxy' },
    });

    const ct = upstreamRes.headers.get('content-type') || '';
    const isPlaylist =
      upstream.endsWith('.m3u8') ||
      ct.includes('mpegurl') ||
      ct.includes('application/x-mpegURL');

    const baseHeaders: Record<string, string> = {
      ...corsHeaders,
      'Cache-Control': 'no-store',
    };

    if (isPlaylist) {
      const text = await upstreamRes.text();
      const upstreamUrl = new URL(upstream);
      const sbUrl = Deno.env.get('SUPABASE_URL') || `${url.protocol}//${url.host}`;
      const selfBase = `${sbUrl.replace(/\/$/, '')}/functions/v1/hls-proxy`;

      const rewritten = text
        .split('\n')
        .map((line) => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) {
            // Rewrite URI="..." inside tags (keys, maps)
            return line.replace(/URI="([^"]+)"/g, (_m, uri) => {
              const abs = new URL(uri, upstreamUrl).toString();
              return `URI="${selfBase}?u=${encodeURIComponent(abs)}"`;
            });
          }
          const abs = new URL(trimmed, upstreamUrl).toString();
          return `${selfBase}?u=${encodeURIComponent(abs)}`;
        })
        .join('\n');

      return new Response(rewritten, {
        status: upstreamRes.status,
        headers: {
          ...baseHeaders,
          'Content-Type': 'application/vnd.apple.mpegurl',
        },
      });
    }

    // Binary segment passthrough
    return new Response(upstreamRes.body, {
      status: upstreamRes.status,
      headers: {
        ...baseHeaders,
        'Content-Type': ct || 'video/mp2t',
      },
    });
  } catch (e) {
    return new Response(`Proxy error: ${(e as Error).message}`, {
      status: 502,
      headers: corsHeaders,
    });
  }
});
