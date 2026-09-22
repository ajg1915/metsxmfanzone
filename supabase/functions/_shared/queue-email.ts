import { createClient } from 'npm:@supabase/supabase-js@2'

// Emails are delivered through Resend via the Lovable connector gateway.
export const VERIFIED_EMAIL_DOMAIN = 'metsxmfanzone.com'
export const VERIFIED_FROM_ADDRESS = `MetsXMFanZone <noreply@${VERIFIED_EMAIL_DOMAIN}>`

const RESEND_GATEWAY_URL = 'https://connector-gateway.lovable.dev/resend'

// deno-lint-ignore no-explicit-any
type ServiceClient = any

type SendEmailOptions = {
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

const logSend = async (
  supabase: ServiceClient,
  row: {
    message_id: string | null
    template_name: string
    recipient_email: string
    status: 'sent' | 'suppressed' | 'failed'
    error_message?: string
    metadata?: Record<string, unknown> | null
  }
) => {
  const { error } = await supabase.from('email_send_log').insert(row)
  if (error) {
    console.error('Failed to write email_send_log row', {
      status: row.status,
      code: error.code,
      message: error.message,
    })
  }
}

/**
 * Sends an email through Resend (via the Lovable connector gateway).
 * Suppressed / blocked recipients resolve with { sent: false }; other failures throw.
 */
export const queueTransactionalEmail = async (
  supabase: ServiceClient,
  {
    to,
    subject,
    html,
    text,
    label,
    metadata,
    idempotencyKey,
  }: SendEmailOptions
): Promise<{ messageId: string; sent: boolean; reason?: 'recipient_suppressed' }> => {
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')
  if (!lovableApiKey) {
    throw new Error('LOVABLE_API_KEY is not configured')
  }

  const resendApiKey =
    Deno.env.get('RESEND_API_KEY_1') ?? Deno.env.get('RESEND_API_KEY')
  if (!resendApiKey) {
    throw new Error('RESEND_API_KEY is not configured')
  }

  const normalizedTo = to.trim().toLowerCase()
  let messageId = crypto.randomUUID()

  // Suppression list is kept in our own table so unsubscribes/bounces are honoured.
  try {
    const { data: suppressed } = await supabase
      .from('suppressed_emails')
      .select('email')
      .eq('email', normalizedTo)
      .maybeSingle()

    if (suppressed) {
      await logSend(supabase, {
        message_id: messageId,
        template_name: label,
        recipient_email: to,
        status: 'suppressed',
        metadata: metadata ?? null,
      })
      return { messageId, sent: false, reason: 'recipient_suppressed' }
    }
  } catch (_error) {
    // Suppression table unavailable: continue with the send.
  }

  const unsubscribeUrl = `https://${VERIFIED_EMAIL_DOMAIN}/unsubscribe?email=${encodeURIComponent(normalizedTo)}`

  let response: Response
  try {
    response = await fetch(`${RESEND_GATEWAY_URL}/emails`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${lovableApiKey}`,
        'X-Connection-Api-Key': resendApiKey,
        'Idempotency-Key': idempotencyKey ?? `${label}:${normalizedTo}:${messageId}`,
      },
      body: JSON.stringify({
        from: VERIFIED_FROM_ADDRESS,
        to: [to],
        subject,
        html,
        text: text ?? subject,
        reply_to: `support@${VERIFIED_EMAIL_DOMAIN}`,
        headers: {
          'List-Unsubscribe': `<${unsubscribeUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      }),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await logSend(supabase, {
      message_id: messageId,
      template_name: label,
      recipient_email: to,
      status: 'failed',
      error_message: message.slice(0, 1000),
      metadata: metadata ?? null,
    })
    throw error
  }

  const bodyText = await response.text()

  if (!response.ok) {
    console.error(`Resend send failed [${response.status}]: ${bodyText}`)
    await logSend(supabase, {
      message_id: messageId,
      template_name: label,
      recipient_email: to,
      status: 'failed',
      error_message: `${response.status}: ${bodyText}`.slice(0, 1000),
      metadata: metadata ?? null,
    })
    throw new Error(`Email send failed [${response.status}]: ${bodyText}`)
  }

  try {
    const parsed = JSON.parse(bodyText)
    if (parsed?.id) messageId = parsed.id
  } catch (_error) {
    // Non-JSON success body: keep the generated id.
  }

  await logSend(supabase, {
    message_id: messageId,
    template_name: label,
    recipient_email: to,
    status: 'sent',
    metadata: metadata ?? null,
  })

  return { messageId, sent: true }
}
