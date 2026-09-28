// Nightly "Things to Fix" job. Triggered at midnight ET by the Cloudflare
// Worker (cloudflare-worker/nightly-watchdog.js) with the x-cron-secret header.
//
// 1. Checks: database, site routes, edge function, PayPal, Resend, MLB API,
//    PayPal webhook backlog, failed cron jobs, broken article images,
//    memberships stuck "active" past their paid-through date.
// 2. Light fixes: expired token cleanup, cron log pruning, retry of failed
//    PayPal webhook events.
// 3. Writes a site_health_runs row and sends the "Site Health & Fixes Log"
//    with subscriber metrics to the admin (Discord + email).
import { createServiceClient } from '../_shared/queue-email.ts'
import { getPayPalToken } from '../_shared/paypal-status.ts'
import { runStoredEvent } from '../_shared/paypal-events.ts'
import { notifyAdmin, requireCronSecret } from '../_shared/admin-notify.ts'
import { todayET } from '../_shared/mlb-stats.ts'

const SITE = Deno.env.get('SITE_URL') ?? 'https://www.metsxmfanzone.com'
const ROUTES = ['/', '/blog', '/plans', '/live', '/sitemap.xml']
const SLOW_MS = 2500

type Check = { name: string; ok: boolean; ms?: number; detail?: string }
type Fix = { name: string; ok: boolean; detail: string }

async function timed(name: string, fn: () => Promise<string | void>): Promise<Check> {
  const t = performance.now()
  try {
    const detail = await fn()
    const ms = Math.round(performance.now() - t)
    return { name, ok: ms < SLOW_MS * 4, ms, detail: detail || (ms > SLOW_MS ? `slow (${ms} ms)` : undefined) }
  } catch (e) {
    return { name, ok: false, ms: Math.round(performance.now() - t), detail: (e as Error).message.slice(0, 200) }
  }
}

async function httpOk(url: string, init: RequestInit = {}) {
  const res = await fetch(url, { redirect: 'follow', ...init, signal: AbortSignal.timeout(10_000) })
  await res.body?.cancel()
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
}

Deno.serve(async (req) => {
  const denied = requireCronSecret(req)
  if (denied) return denied
  const supabase = createServiceClient()
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!

  // ------------------------------------------------------------- checks
  const checks: Check[] = await Promise.all([
    timed('Database', async () => {
      const { error } = await supabase.from('site_settings').select('setting_key').limit(1)
      if (error) throw new Error(error.message)
    }),
    ...ROUTES.map((path) => timed(`Page ${path}`, () => httpOk(`${SITE}${path}`))),
    timed('Stats API (game-stats)', () => httpOk(`${supabaseUrl}/functions/v1/game-stats?date=${todayET()}`, {
      headers: { apikey: Deno.env.get('SUPABASE_ANON_KEY') ?? '' },
    })),
    timed('PayPal API', async () => {
      if (!(await getPayPalToken())) throw new Error('Could not get an access token')
    }),
    timed('Resend email API', () => httpOk('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY_1') ?? Deno.env.get('RESEND_API_KEY')}` },
    })),
    timed('MLB Stats API', () => httpOk(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${todayET()}`)),
  ])

  // Webhook backlog, before retrying so the report shows what was found.
  const { data: backlog } = await supabase
    .from('paypal_webhook_events')
    .select('id, payload, attempts, status, received_at')
    .or(`status.eq.failed,and(status.eq.received,received_at.lt.${new Date(Date.now() - 3_600_000).toISOString()})`)
    .lt('attempts', 10)
    .order('received_at')
    .limit(50)
  checks.push({ name: 'PayPal webhook backlog', ok: !backlog?.length, detail: backlog?.length ? `${backlog.length} unprocessed event(s)` : undefined })

  const { data: cronFails } = await supabase.rpc('cron_failures_24h')
  checks.push({
    name: 'Scheduled jobs',
    ok: !cronFails?.length,
    detail: cronFails?.length ? cronFails.map((c: any) => `${c.jobname} failed ${c.failed}x`).join('; ') : undefined,
  })

  const { count: emailFailCount } = await supabase
    .from('email_send_log')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'failed')
    .gte('created_at', new Date(Date.now() - 86_400_000).toISOString())
  checks.push({ name: 'Email delivery (24h)', ok: !emailFailCount, detail: emailFailCount ? `${emailFailCount} failed sends` : undefined })

  // Broken article images: HEAD the 40 newest published featured images.
  const { data: posts } = await supabase
    .from('blog_posts')
    .select('slug, featured_image_url')
    .eq('published', true)
    .not('featured_image_url', 'is', null)
    .order('published_at', { ascending: false })
    .limit(40)
  const broken: string[] = []
  await Promise.all((posts ?? []).map(async (p: any) => {
    try {
      await httpOk(p.featured_image_url, { method: 'HEAD' })
    } catch {
      broken.push(`/blog/${p.slug}`)
    }
  }))
  checks.push({ name: 'Article images', ok: broken.length === 0, detail: broken.length ? `Broken on ${broken.slice(0, 8).join(', ')}` : undefined })

  const { count: stuck } = await supabase
    .from('subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active')
    .in('plan_type', ['weekly', 'premium', 'annual', 'ny_sports'])
    .lt('end_date', new Date().toISOString())
  checks.push({
    name: 'Memberships past paid-through date',
    ok: !stuck,
    detail: stuck ? `${stuck} still marked active; payment-enforcement will check them with PayPal at 9 AM` : undefined,
  })

  // ------------------------------------------------------------- fixes
  const fixes: Fix[] = []

  const { data: cleaned, error: cleanError } = await supabase.rpc('run_daily_cleanup')
  fixes.push({
    name: 'Cleared expired tokens and old logs',
    ok: !cleanError,
    detail: cleanError ? cleanError.message : Object.entries(cleaned ?? {}).filter(([, n]) => Number(n) > 0).map(([k, n]) => `${k}: ${n}`).join(', ') || 'nothing to clear',
  })

  if (backlog?.length) {
    let ok = 0
    for (const row of backlog) if ((await runStoredEvent(supabase, row)).ok) ok++
    fixes.push({ name: 'Retried PayPal webhook events', ok: ok === backlog.length, detail: `${ok} of ${backlog.length} now processed` })
  }

  // ------------------------------------------------------------- metrics
  const now = new Date()
  const dayAgo = new Date(now.getTime() - 86_400_000)
  const { data: daily } = await supabase.rpc('subscriber_metrics', { p_from: dayAgo.toISOString(), p_to: now.toISOString() })
  const isMonday = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' })).getDay() === 1
  const { data: weekly } = isMonday
    ? await supabase.rpc('subscriber_metrics', { p_from: new Date(now.getTime() - 7 * 86_400_000).toISOString(), p_to: now.toISOString() })
    : { data: null }

  // ------------------------------------------------------------- report
  const failed = checks.filter((c) => !c.ok)
  const ok = failed.length === 0 && fixes.every((f) => f.ok)
  const m = daily ?? {}
  const lines = [
    ok ? '✅ All systems healthy' : `⚠️ ${failed.length} issue(s) need a look`,
    ...failed.map((c) => `• ${c.name}: ${c.detail ?? 'failed'}`),
    '',
    '🔧 Fixes applied',
    ...fixes.map((f) => `• ${f.ok ? '✓' : '✗'} ${f.name}: ${f.detail}`),
    '',
    '📈 Subscribers (last 24h)',
    `• Active: ${m.active_subs ?? '?'} (${m.past_due ?? 0} past due) · MRR $${m.mrr ?? '?'}`,
    `• New: ${m.new_signups ?? 0} paid, ${m.new_members ?? 0} accounts · Churned: ${m.churned ?? 0} · Revenue $${m.revenue ?? 0}`,
    ...(weekly
      ? ['', '📅 Last 7 days', `• New ${weekly.new_signups} · Churned ${weekly.churned} (${((weekly.churn_rate ?? 0) * 100).toFixed(1)}%) · Revenue $${weekly.revenue}`]
      : []),
    '',
    `⏱ Slowest: ${checks.filter((c) => c.ms).sort((a, b) => b.ms! - a.ms!).slice(0, 3).map((c) => `${c.name} ${c.ms} ms`).join(', ')}`,
  ]
  const summary = lines.join('\n')

  await supabase.from('site_health_runs').insert({ ok, checks, fixes, metrics: { daily, weekly }, summary })
  await notifyAdmin(supabase, {
    dedupeKey: `health:${todayET()}`,
    kind: 'health',
    title: `${ok ? '🟢' : '🟠'} Site Health & Fixes Log · ${todayET()}`,
    body: summary,
    url: `${SITE}/admin`,
  })

  return new Response(JSON.stringify({ ok, failed: failed.length, fixes: fixes.length }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
