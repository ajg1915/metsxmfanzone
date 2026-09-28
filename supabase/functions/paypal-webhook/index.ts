// PayPal webhook endpoint. Verify, store, process, acknowledge.
//
// - Every verified event is stored in paypal_webhook_events first, keyed by
//   PayPal's event id, so redeliveries are recognised and skipped.
// - Processing errors return 500, so PayPal retries (up to 25 times over
//   3 days) and daily-health-check retries anything still failed.
// - Bad signatures get 400 and are never processed.
import { createServiceClient } from '../_shared/queue-email.ts'
import { verifyPayPalSignature, runStoredEvent, type PayPalEvent } from '../_shared/paypal-events.ts'

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'X-Content-Type-Options': 'nosniff' },
  })

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  let event: PayPalEvent
  try {
    event = JSON.parse(await req.text())
  } catch {
    return json(400, { error: 'Invalid JSON' })
  }
  if (!event?.id || !event?.event_type) return json(400, { error: 'Not a PayPal event' })

  try {
    if (!(await verifyPayPalSignature(req, event))) {
      console.warn('Rejected PayPal webhook with invalid signature', { type: event.event_type })
      return json(400, { error: 'Invalid signature' })
    }
  } catch (e) {
    console.error('Could not verify PayPal webhook', (e as Error).message)
    return json(500, { error: 'Verification unavailable' }) // PayPal will retry
  }

  const supabase = createServiceClient()

  const { data: inserted, error: insertError } = await supabase
    .from('paypal_webhook_events')
    .upsert(
      { id: event.id, event_type: event.event_type, resource_id: event.resource?.id ?? null, payload: event },
      { onConflict: 'id', ignoreDuplicates: true },
    )
    .select('id, attempts')
  if (insertError) {
    console.error('Could not store PayPal event', insertError.message)
    return json(500, { error: 'Storage failed' })
  }

  let row: { id: string; attempts: number } | null | undefined = inserted?.[0]
  if (!row) {
    // Seen before. Skip if it already went through; otherwise try again now.
    const { data: existing, error: lookupError } = await supabase
      .from('paypal_webhook_events')
      .select('id, attempts, status')
      .eq('id', event.id)
      .single()
    if (lookupError || !existing) {
      console.error('Could not load stored PayPal event', lookupError?.message)
      return json(500, { error: 'Storage lookup failed' }) // PayPal will retry
    }
    if (existing.status === 'processed' || existing.status === 'ignored') {
      return json(200, { received: true, duplicate: true })
    }
    row = existing
  }

  const result = await runStoredEvent(supabase, { id: event.id, payload: event, attempts: row?.attempts ?? 0 })
  console.log('PayPal event handled', { type: event.event_type, ok: result.ok })
  return result.ok ? json(200, { received: true, outcome: result.outcome }) : json(500, { error: 'Processing failed' })
})
