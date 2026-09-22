import { createClient } from 'npm:@supabase/supabase-js@2'
import { EmailAPIError, sendLovableEmail } from 'npm:@lovable.dev/email-js@0.1.0'

export const VERIFIED_EMAIL_DOMAIN = 'notify.metsxmfanzone.com'
export const VERIFIED_FROM_ADDRESS = `MetsXMFanZone <noreply@${VERIFIED_EMAIL_DOMAIN}>`

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
 * Sends an email through Lovable's managed email API. Delivery, retries,
 * rate limits, suppression and unsubscribe handling are managed by Lovable.
 * A suppressed recipient resolves with { sent: false }; any other failure throws.
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
    purpose = 'transactional',
    idempotencyKey,
  }: SendEmailOptions
): Promise<{ messageId: string; sent: boolean; reason?: 'recipient_suppressed' }> => {
  const apiKey = Deno.env.get('LOVABLE_API_KEY')
  if (!apiKey) {
    throw new Error('LOVABLE_API_KEY is not configured')
  }

  const normalizedTo = to.trim().toLowerCase()
  const messageId = crypto.randomUUID()

  try {
    await sendLovableEmail(
      {
        to,
        from: VERIFIED_FROM_ADDRESS,
        sender_domain: VERIFIED_EMAIL_DOMAIN,
        subject,
        html,
        text: text ?? subject,
        purpose,
        label,
        idempotency_key: idempotencyKey ?? `${label}:${normalizedTo}:${messageId}`,
      },
      { apiKey, sendUrl: Deno.env.get('LOVABLE_SEND_URL') }
    )
  } catch (error) {
    if (error instanceof EmailAPIError && error.code === 'recipient_suppressed') {
      await logSend(supabase, {
        message_id: messageId,
        template_name: label,
        recipient_email: to,
        status: 'suppressed',
        metadata: metadata ?? null,
      })
      return { messageId, sent: false, reason: 'recipient_suppressed' }
    }

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

  await logSend(supabase, {
    message_id: messageId,
    template_name: label,
    recipient_email: to,
    status: 'sent',
    metadata: metadata ?? null,
  })

  return { messageId, sent: true }
}
