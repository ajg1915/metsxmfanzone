// Sends one alert to the site admin on every configured channel, once.
// Channels: Discord webhook (ADMIN_DISCORD_WEBHOOK_URL), Telegram bot
// (TELEGRAM_BOT_TOKEN + TELEGRAM_ADMIN_CHAT_ID), and email to every user with
// the admin role. The dedupe key makes repeat calls no-ops, so callers can run
// on a tight schedule without spamming.
import { queueTransactionalEmail } from './queue-email.ts'
import { renderBrandedEmailFor, escapeHtml } from './email-brand.ts'

type ServiceClient = any

export type AdminAlert = {
  dedupeKey: string
  kind: 'rumor' | 'postgame' | 'morning' | 'health' | 'billing'
  title: string
  /** Plain text / Discord markdown. Keep under ~1,800 chars for Discord. */
  body: string
  url?: string
  payload?: Record<string, unknown>
  /** Defaults to every configured channel. Email is skipped for 'rumor' unless listed. */
  channels?: Array<'discord' | 'telegram' | 'email'>
}

export type NotifyResult = { sent: boolean; duplicate: boolean; channels: string[]; errors: string[] }

export function requireCronSecret(req: Request): Response | null {
  const expected = Deno.env.get('CRON_SECRET')
  if (!expected || req.headers.get('x-cron-secret') !== expected) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return null
}

export async function notifyAdmin(supabase: ServiceClient, alert: AdminAlert): Promise<NotifyResult> {
  const result: NotifyResult = { sent: false, duplicate: false, channels: [], errors: [] }

  // Claim the dedupe key first; a unique violation means it already went out.
  const { error: claimError } = await supabase.from('admin_alerts').insert({
    dedupe_key: alert.dedupeKey,
    kind: alert.kind,
    title: alert.title,
    body: alert.body,
    payload: alert.payload ?? null,
  })
  if (claimError) {
    if (claimError.code === '23505') return { ...result, duplicate: true }
    throw new Error(`admin_alerts insert failed: ${claimError.message}`)
  }

  const wanted = alert.channels ?? (alert.kind === 'rumor' ? ['discord', 'telegram'] : ['discord', 'telegram', 'email'])
  const text = `**${alert.title}**\n${alert.body}${alert.url ? `\n${alert.url}` : ''}`

  if (wanted.includes('discord')) {
    const hook = Deno.env.get('ADMIN_DISCORD_WEBHOOK_URL')
    if (hook) {
      try {
        const res = await fetch(hook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: text.slice(0, 1990), allowed_mentions: { parse: [] } }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        result.channels.push('discord')
      } catch (e) {
        result.errors.push(`discord: ${(e as Error).message}`)
      }
    }
  }

  if (wanted.includes('telegram')) {
    const token = Deno.env.get('TELEGRAM_BOT_TOKEN')
    const chatId = Deno.env.get('TELEGRAM_ADMIN_CHAT_ID')
    if (token && chatId) {
      try {
        const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: text.replace(/\*\*/g, ''), disable_web_page_preview: false }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        result.channels.push('telegram')
      } catch (e) {
        result.errors.push(`telegram: ${(e as Error).message}`)
      }
    }
  }

  if (wanted.includes('email')) {
    try {
      const { data: roles } = await supabase.from('user_roles').select('user_id').eq('role', 'admin')
      const ids = (roles ?? []).map((r: { user_id: string }) => r.user_id)
      const { data: admins } = ids.length
        ? await supabase.from('profiles').select('email').in('id', ids)
        : { data: [] }
      const html = await renderBrandedEmailFor(supabase, {
        preheader: alert.title,
        heading: alert.title,
        content: `<pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(alert.body)}</pre>`,
        ...(alert.url ? { cta: { label: 'Open', url: alert.url } } : {}),
      })
      for (const admin of admins ?? []) {
        if (!admin.email) continue
        await queueTransactionalEmail(supabase, {
          to: admin.email,
          subject: alert.title,
          html,
          label: `admin_${alert.kind}`,
          idempotencyKey: `admin-alert:${alert.dedupeKey}:${admin.email}`,
        })
      }
      result.channels.push('email')
    } catch (e) {
      result.errors.push(`email: ${(e as Error).message}`)
    }
  }

  result.sent = result.channels.length > 0
  if (result.sent) {
    await supabase.from('admin_alerts').update({ channels: result.channels }).eq('dedupe_key', alert.dedupeKey)
  } else {
    // Nothing got through: release the key so the next scheduled run retries.
    await supabase.from('admin_alerts').delete().eq('dedupe_key', alert.dedupeKey)
  }
  return result
}
