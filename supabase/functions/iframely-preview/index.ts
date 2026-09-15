import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const IFRAMELY_ENDPOINT = 'https://iframe.ly/api/iframely';

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const apiKey = Deno.env.get('IFRAMELY_API_KEY');
    if (!apiKey) {
      return json({ error: 'Link previews are not configured' }, 503);
    }

    let payload: unknown;
    try {
      payload = await req.json();
    } catch {
      return json({ error: 'Invalid request body' }, 400);
    }

    const url = (payload as { url?: unknown })?.url;
    if (!isHttpUrl(url)) {
      return json({ error: 'A valid http(s) url is required' }, 400);
    }

    const requestUrl = `${IFRAMELY_ENDPOINT}?url=${encodeURIComponent(url)}&api_key=${encodeURIComponent(apiKey)}&omit_script=1`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    let response: Response;
    try {
      response = await fetch(requestUrl, { signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      console.error('Iframely request failed', { status: response.status });
      return json({ error: 'Preview unavailable' }, 502);
    }

    const data = await response.json();

    const links = (data?.links ?? {}) as Record<string, Array<{ href?: string }>>;
    const image =
      links.thumbnail?.[0]?.href ||
      links.image?.[0]?.href ||
      links.icon?.[0]?.href ||
      null;

    return new Response(
      JSON.stringify({
        url: data?.url || url,
        title: data?.meta?.title || null,
        description: data?.meta?.description || null,
        site: data?.meta?.site || null,
        author: data?.meta?.author || null,
        image,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=3600, s-maxage=86400',
        },
      },
    );
  } catch (error) {
    console.error('iframely-preview error', error instanceof Error ? error.message : 'unknown');
    return json({ error: 'Preview unavailable' }, 500);
  }
});
