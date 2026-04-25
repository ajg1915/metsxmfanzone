import { createClient } from 'npm:@supabase/supabase-js@2'

export const VERIFIED_EMAIL_DOMAIN = 'notify.www.metsxmfanzone.com'
export const VERIFIED_FROM_ADDRESS = `MetsXMFanZone <noreply@${VERIFIED_EMAIL_DOMAIN}>`
const EMAIL_QUEUE_NAME = 'transactional_emails'

// deno-lint-ignore no-explicit-any
type ServiceClient = any

type QueueEmailOptions = {
  html: string
  subject: string
  to: string
  text?: string
  label: string
  metadata?: Record<string, unknown>
  purpose?: 'transactional' | 'marketing'
  idempotencyKey?: string
}

export const createServiceClient = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing backend environment variables')
  }

  return createClient(supabaseUrl, supabaseServiceKey)
}

export const getOrCreateUnsubscribeToken = async (
  supabase: ServiceClient,
  email: string
): Promise<string> => {
  const normalizedEmail = email.trim().toLowerCase()

  // Check for existing token
  const { data: existing } = await supabase
    .from('email_unsubscribe_tokens')
    .select('token')
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (existing?.token) return existing.token

  const token = crypto.randomUUID()
  await supabase.from('email_unsubscribe_tokens').insert({
    email: normalizedEmail,
    token,
  })

  return token
}

export const queueTransactionalEmail = async (
  supabase: ServiceClient,
  { to, subject, html, text, label, metadata, purpose = 'transactional', idempotencyKey }: QueueEmailOptions
) => {
  const normalizedTo = to.trim().toLowerCase()
  const messageId = crypto.randomUUID()
  const unsubscribeToken = await getOrCreateUnsubscribeToken(supabase, to)

  const payload = {
    to,
    from: VERIFIED_FROM_ADDRESS,
    sender_domain: VERIFIED_EMAIL_DOMAIN,
    subject,
    html,
    text: text ?? subject,
    purpose,
    label,
    idempotency_key: idempotencyKey ?? `${label}:${normalizedTo}:${messageId}`,
    message_id: messageId,
    unsubscribe_token: unsubscribeToken,
    queued_at: new Date().toISOString(),
  }

  const { error: queueError } = await supabase.rpc('enqueue_email', {
    queue_name: EMAIL_QUEUE_NAME,
    payload,
  })

  if (queueError) {
    throw queueError
  }

  const { error: logError } = await supabase.from('email_send_log').insert({
    message_id: messageId,
    template_name: label,
    recipient_email: to,
    status: 'pending',
    metadata: metadata ?? null,
  })

  if (logError) {
    console.error('Failed to log queued email', { label, message: logError.message })
  }

  return { messageId }
}
