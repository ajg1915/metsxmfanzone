import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const DEFAULT_ORIGIN = 'http://173.56.47.85:8080';
const MAX_PLAYLIST_BYTES = 2 * 1024 * 1024;

const isPublicHttpUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    return host !== 'localhost' && host !== '127.0.0.1' && host !== '0.0.0.0' &&
      !host.startsWith('10.') && !host.startsWith('192.168.') &&
      !/^172\.(1[6-9]|2\d|3[01])\./.test(host) && host !== '::1';
  } catch {
    return false;
  }
};

const proxyUrl = (base: string, target: string) =>
  `${base}?u=${encodeURIComponent(target)}`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const requestUrl = new URL(req.url);
    const path = requestUrl.pathname.split('/hls-proxy')[1] || '/hls/metsxmfanzone.m3u8';
    const requested = requestUrl.searchParams.get('u');
    const upstream = requested || `${DEFAULT_ORIGIN}${path}`;

    if (!isPublicHttpUrl(upstream)) {
      return new Response('Forbidden upstream URL', { status: 403, headers: corsHeaders });
    }

    const upstreamUrl = new URL(upstream);
    const upstreamRes = await fetch(upstreamUrl, {
      method: req.method,
      headers: {
        'User-Agent': 'MetsXMFanZone-HLS-Proxy',
        ...(req.headers.get('Range') ? { Range: req.headers.get('Range')! } : {}),
      },
    });

    const contentType = upstreamRes.headers.get('content-type') || '';
    const isPlaylist = upstreamUrl.pathname.toLowerCase().includes('.m3u8') ||
      contentType.toLowerCase().includes('mpegurl');
    const headers: Record<string, string> = {
      ...corsHeaders,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Content-Type',
      'Content-Type': isPlaylist ? 'application/vnd.apple.mpegurl' : (contentType || 'application/octet-stream'),
    };

    if (!isPlaylist || req.method === 'HEAD') {
      return new Response(upstreamRes.body, { status: upstreamRes.status, headers });
    }

    const text = await upstreamRes.text();
    if (text.length > MAX_PLAYLIST_BYTES) {
      return new Response('Playlist too large', { status: 502, headers: corsHeaders });
    }

    const selfBase = `${requestUrl.origin}${requestUrl.pathname.split('/hls-proxy')[0]}/hls-proxy`;
    const rewritten = text.split('\n').map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        return line.replace(/URI="([^"]+)"/g, (_match, uri) => {
          const absolute = new URL(uri, upstreamUrl).toString();
          return `URI="${proxyUrl(selfBase, absolute)}"`;
        });
      }
      const absolute = new URL(trimmed, upstreamUrl).toString();
      return proxyUrl(selfBase, absolute);
    }).join('\n');

    return new Response(rewritten, { status: upstreamRes.status, headers });
  } catch (error) {
    return new Response(`Proxy error: ${(error as Error).message}`, {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
    });
  }
});
