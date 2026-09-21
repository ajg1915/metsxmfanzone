import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const SNY_CHANNEL_ID = 'UCL_OEjsHTwsHK6WKWs7s7Uw';

type Probe = {
  key: string;
  label: string;
  source: 'primary' | 'backup';
  url: string;
  // Returns the number of usable items found in the body.
  count: (body: string) => number;
};

const PROBES: Probe[] = [
  {
    key: 'sny-videos',
    label: 'SNY Videos',
    source: 'primary',
    url: 'https://www.youtube.com/@SNYtv/videos',
    count: (b) => new Set(b.match(/"videoId":"[\w-]{11}"/g) ?? []).size,
  },
  {
    key: 'mets-highlights',
    label: 'Mets Highlights',
    source: 'primary',
    url: 'https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=121&hydrate=game(content(highlights(highlights)))',
    count: (b) => (b.match(/"playbacks"/g) ?? []).length,
  },
  {
    key: 'mets-highlights',
    label: 'Mets Highlights',
    source: 'backup',
    url: 'https://www.mlb.com/mets/video',
    count: (b) => (b.length > 5000 ? 1 : 0),
  },
  {
    key: 'mets-news',
    label: 'Mets News',
    source: 'primary',
    url: 'https://sny.tv/mets/feed',
    count: (b) => (b.match(/<item[\s>]/g) ?? []).length,
  },
  {
    key: 'mets-news',
    label: 'Mets News',
    source: 'backup',
    url: 'https://www.mlb.com/feeds/news/rss.xml',
    count: (b) => (b.match(/<item[\s>]/g) ?? []).length,
  },
  {
    key: 'mets-schedule',
    label: 'Mets Schedule',
    source: 'primary',
    url: 'https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=121&season=2026&gameType=R',
    count: (b) => (b.match(/"gamePk"/g) ?? []).length,
  },
];

async function runProbe(p: Probe) {
  const started = Date.now();
  try {
    const res = await fetch(p.url, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' },
      signal: AbortSignal.timeout(12000),
    });
    const body = res.ok ? await res.text() : '';
    const itemCount = res.ok ? p.count(body) : 0;
    const ok = res.ok && itemCount > 0;
    return {
      feedKey: p.key,
      label: p.label,
      source: p.source,
      url: p.url,
      status: ok ? 'ok' : res.ok ? 'empty' : 'error',
      httpStatus: res.status,
      itemCount,
      durationMs: Date.now() - started,
      error: res.ok ? (itemCount > 0 ? null : 'Source responded but returned no items') : `HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      feedKey: p.key,
      label: p.label,
      source: p.source,
      url: p.url,
      status: 'error',
      httpStatus: null,
      itemCount: 0,
      durationMs: Date.now() - started,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const results = await Promise.all(PROBES.map(runProbe));

  const feedKeys = [...new Set(results.map((r) => r.feedKey))];
  const feeds = feedKeys.map((key) => {
    const checks = results.filter((r) => r.feedKey === key);
    const primary = checks.find((c) => c.source === 'primary') ?? null;
    const backup = checks.find((c) => c.source === 'backup') ?? null;
    const healthy = checks.some((c) => c.status === 'ok');
    const allDown = checks.every((c) => c.status !== 'ok');
    return {
      feedKey: key,
      label: checks[0]?.label ?? key,
      overall: allDown ? 'down' : primary && primary.status !== 'ok' ? 'degraded' : 'healthy',
      healthy,
      primary,
      backup,
    };
  });

  const problems = feeds.filter((f) => f.overall !== 'healthy');

  return new Response(
    JSON.stringify({
      checkedAt: new Date().toISOString(),
      overall: feeds.some((f) => f.overall === 'down')
        ? 'down'
        : problems.length
        ? 'degraded'
        : 'healthy',
      problemCount: problems.length,
      feeds,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
