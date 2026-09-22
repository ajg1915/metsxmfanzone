import { createEmailWebhookHandler } from 'npm:@lovable.dev/email-js@0.1.0'
import { createClient } from 'npm:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

type SuppressionReason = 'bounce' | 'complaint' | 'unsubscribe'
type LogStatus = 'bounced' | 'complained' | 'suppressed'

const record = async (
  eventId: string,
  recipient: string,
  reason: SuppressionReason,
  status: LogStatus,
  description: string
) => {
  const email = recipient.trim().toLowerCase()

  const { error: suppressionError } = await supabase
    .from('suppressed_emails')
    .upsert({ email, reason, metadata: null }, { onConflict: 'email' })

  if (suppressionError) {
    console.error('Failed to record suppression', {
      event_id: eventId,
      code: suppressionError.code,
      message: suppressionError.message,
    })
    throw new Error('Failed to record suppression')
  }

  const { error: logError } = await supabase.from('email_send_log').insert({
    message_id: eventId,
    template_name: 'system',
    recipient_email: recipient,
    status,
    error_message: description,
  })

  if (logError) {
    console.error('Failed to record email event log', {
      event_id: eventId,
      code: logError.code,
      message: logError.message,
    })
    throw new Error('Failed to record email event log')
  }
}

const handler = createEmailWebhookHandler({
  apiKey: Deno.env.get('LOVABLE_API_KEY')!,
  on: {
    'email.bounced': async (event) => {
      await record(event.event_id, event.data.recipient, 'bounce', 'bounced', 'Email bounced')
    },
    'email.complaint': async (event) => {
      await record(
        event.event_id,
        event.data.recipient,
        'complaint',
        'complained',
        'Spam complaint received'
      )
    },
    'email.unsubscribed': async (event) => {
      await record(
        event.event_id,
        event.data.recipient,
        'unsubscribe',
        'suppressed',
        'Recipient unsubscribed'
      )
    },
  },
})

Deno.serve((req) => handler(req))
