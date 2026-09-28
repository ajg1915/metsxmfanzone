// Cloudflare Worker: midnight ET scheduler and outside watchdog.
//
// Cron Triggers run in UTC, so wrangler.toml fires at 04:00 and 05:00 UTC and
// this code only acts when it is actually midnight in New York. That keeps it
// right through daylight saving changes.
//
// Each night it:
//   1. warms Cloudflare's cache for the key pages (and notes any that fail),
//   2. triggers the Supabase daily-health-check function,
//   3. if Supabase can't be reached at all, posts to the admin Discord itself,
//      because the health report would otherwise never arrive.
//
// Secrets (wrangler secret put ...): CRON_SECRET, ADMIN_DISCORD_WEBHOOK_URL
// Vars (wrangler.toml): SUPABASE_URL, SITE_URL

const WARM_PATHS = ['/', '/blog', '/plans', '/live', '/sitemap.xml', '/news-sitemap.xml']

function nyHour(date) {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hourCycle: 'h23' }).format(date))
}

async function warmCache(site) {
  const results = await Promise.all(WARM_PATHS.map(async (path) => {
    const t = Date.now()
    try {
      // Bounded, so one stalled page can't hold up the health check below.
      const res = await fetch(`${site}${path}`, {
        cf: { cacheEverything: true },
        headers: { 'User-Agent': 'MetsXM-Watchdog' },
        signal: AbortSignal.timeout(15_000),
      })
      await res.body?.cancel()
      return { path, status: res.status, ms: Date.now() - t }
    } catch (e) {
      return { path, status: 0, ms: Date.now() - t, error: String(e) }
    }
  }))
  return results
}

async function discord(env, content) {
  if (!env.ADMIN_DISCORD_WEBHOOK_URL) return
  await fetch(env.ADMIN_DISCORD_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: content.slice(0, 1990), allowed_mentions: { parse: [] } }),
  })
}

async function runNightly(env) {
  const warmed = await warmCache(env.SITE_URL)
  const brokenPages = warmed.filter((r) => r.status === 0 || r.status >= 400)

  let healthOk = false
  let healthError = ''
  try {
    const res = await fetch(`${env.SUPABASE_URL}/functions/v1/daily-health-check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-cron-secret': env.CRON_SECRET },
      body: JSON.stringify({ source: 'cloudflare', warmed }),
      signal: AbortSignal.timeout(120_000),
    })
    healthOk = res.ok
    if (!res.ok) healthError = `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`
  } catch (e) {
    healthError = String(e)
  }

  if (!healthOk) {
    await discord(env, [
      '🔴 **Nightly health check could not run**',
      `Supabase health function failed: ${healthError}`,
      brokenPages.length ? `Pages failing: ${brokenPages.map((p) => `${p.path} (${p.status || 'no response'})`).join(', ')}` : 'Site pages responded normally.',
      'Check the Supabase dashboard: https://supabase.com/dashboard/project/rdmrxeplasttewtlfetc',
    ].join('\n'))
  } else if (brokenPages.length) {
    // The Supabase report covers most checks; add what only the edge sees.
    await discord(env, `🟠 Cache warm found failing pages: ${brokenPages.map((p) => `${p.path} (${p.status || 'no response'})`).join(', ')}`)
  }
  return { healthOk, healthError, warmed }
}

export default {
  async scheduled(controller, env, ctx) {
    if (nyHour(new Date(controller.scheduledTime)) !== 0) return // the other UTC slot this season
    ctx.waitUntil(runNightly(env))
  },

  // Manual run for testing: POST with the same x-cron-secret header.
  async fetch(request, env) {
    if (request.method !== 'POST' || request.headers.get('x-cron-secret') !== env.CRON_SECRET) {
      return new Response('Not found', { status: 404 })
    }
    return Response.json(await runNightly(env))
  },
}
