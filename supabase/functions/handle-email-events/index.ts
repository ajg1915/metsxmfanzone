// Records bounced emails and spam complaints reported by Resend webhooks,
// so the site stops emailing addresses that bounce or report spam.
//
// Resend webhook -> this function. Every event is double-checked by looking the
// email up in Resend with our own API key before anything is recorded, so a
// forged request can't block a real member.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { getResendKey } from '../_shared/resend-fetch.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

type SuppressionReason = 'bounce' | 'complaint'
type LogStatus = 'bounced' | 'complained'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

// Confirms with Resend that this email exists, went to this recipient, and
// really ended in the reported state.
const confirmWithResend = async (
  emailId: string,
  recipient: string,
  expectedEvent: 'bounced' | 'complained'
) => {
  const key = getResendKey()
  if (!key) throw new Error('RESEND_API_KEY is not configured')
  const res = await fetch(`https://api.resend.com/emails/${encodeURIComponent(emailId)}`, {
    headers: { Authorization: `Bearer ${key}` },
  })
  if (!res.ok) return false
  const email = (await res.json()) as { to?: string[] | string; last_event?: string }
  const toList = (Array.isArray(email.to) ? email.to : [email.to ?? '']).map((t) =>
    String(t).trim().toLowerCase()
  )
  return toList.includes(recipient) && email.last_event === expectedEvent
}

const record = async (
  emailId: string,
  recipient: string,
  reason: SuppressionReason,
  status: LogStatus,
  description: string
) => {
  const { error: suppressionError } = await supabase
    .from('suppressed_emails')
    .upsert({ email: recipient, reason, metadata: { resend_email_id: emailId } }, { onConflict: 'email' })
  if (suppressionError) {
    console.error('Failed to record suppression', { code: suppressionError.code })
    throw new Error('Failed to record suppression')
  }

  const { error: logError } = await supabase.from('email_send_log').insert({
    message_id: emailId,
    template_name: 'system',
    recipient_email: recipient,
    status,
    error_message: description,
  })
  if (logError) {
    console.error('Failed to record email event log', { code: logError.code })
    throw new Error('Failed to record email event log')
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  let event: {
    type?: string
    data?: { email_id?: string; to?: string[] | string; bounce?: { type?: string; message?: string } }
  }
  try {
    event = await req.json()
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  const type = event.type
  // Anything we don't track is acknowledged so Resend doesn't keep retrying.
  if (type !== 'email.bounced' && type !== 'email.complained') {
    return json({ ignored: type ?? 'unknown' })
  }

  const emailId = event.data?.email_id
  const recipients = (Array.isArray(event.data?.to) ? event.data!.to : [event.data?.to ?? ''])
    .map((t) => String(t).trim().toLowerCase())
    .filter(Boolean)
  if (!emailId || recipients.length === 0) return json({ error: 'Missing email details' }, 400)

  // Only hard bounces block an address; temporary bounces (full inbox, etc.) don't.
  if (type === 'email.bounced') {
    const bounceType = event.data?.bounce?.type ?? ''
    if (bounceType && bounceType.toLowerCase() !== 'permanent') {
      return json({ ignored: `bounce type ${bounceType}` })
    }
  }

  const expected = type === 'email.bounced' ? 'bounced' : 'complained'
  const results: Record<string, string> = {}

  try {
    for (const recipient of recipients) {
      const confirmed = await confirmWithResend(emailId, recipient, expected)
      if (!confirmed) {
        results[recipient] = 'not confirmed'
        continue
      }
      if (type === 'email.bounced') {
        await record(emailId, recipient, 'bounce', 'bounced', event.data?.bounce?.message || 'Email bounced')
      } else {
        await record(emailId, recipient, 'complaint', 'complained', 'Spam complaint received')
      }
      results[recipient] = 'recorded'
    }
  } catch (error) {
    console.error('handle-email-events failed', error instanceof Error ? error.message : error)
    // A 500 makes Resend retry later.
    return json({ error: 'Temporary failure' }, 500)
  }

  return json({ ok: true, results })
})
