// PayPal subscription lifecycle. processPayPalEvent() is shared by the
// paypal-webhook endpoint (live deliveries) and daily-health-check (retries of
// events that failed), so both paths behave identically.
//
// State machine (subscriptions.status):
//   ACTIVATED ................ pending   -> active
//   PAYMENT.SALE.COMPLETED ... any       -> active, end_date = PayPal next billing + 1 day
//   PAYMENT.FAILED ........... active    -> past_due (keeps access 3 days past end_date)
//   SUSPENDED ................ any       -> suspended (access stops)
//   CANCELLED ................ any       -> cancelled (account retained)
//   EXPIRED .................. any       -> expired
//   SALE.REFUNDED/REVERSED ... any       -> refunded
import { cancelPaypalAndRetainAccount } from './account-cleanup.ts'
import { getPayPalToken, getPayPalSubscriptionState } from './paypal-status.ts'
import { queueTransactionalEmail } from './queue-email.ts'
import { renderBrandedEmailFor, escapeHtml } from './email-brand.ts'
import { notifyAdmin } from './admin-notify.ts'

type ServiceClient = any
type Sub = {
  id: string
  user_id: string
  plan_type: string
  status: string
  end_date: string | null
  amount: number | null
  paypal_subscription_id: string | null
  total_payments_received: number | null
}
export type PayPalEvent = { id: string; event_type: string; resource: any }
export type ProcessOutcome = 'processed' | 'ignored'

const PAYPAL_API = () => Deno.env.get('PAYPAL_BASE_URL') || 'https://api-m.paypal.com'
const PLAN_PRICE: Record<string, number> = { weekly: 3.99, premium: 9.99, annual: 129.99, ny_sports: 19.99 }
const SUB_COLUMNS = 'id, user_id, plan_type, status, end_date, amount, paypal_subscription_id, total_payments_received'

/** Verifies PayPal's signature headers. Returns false on any failure. */
export async function verifyPayPalSignature(req: Request, event: unknown): Promise<boolean> {
  const h = (k: string) => req.headers.get(k)
  const headers = {
    transmission_id: h('paypal-transmission-id'),
    transmission_time: h('paypal-transmission-time'),
    transmission_sig: h('paypal-transmission-sig'),
    cert_url: h('paypal-cert-url'),
    auth_algo: h('paypal-auth-algo'),
  }
  if (Object.values(headers).some((v) => !v)) return false
  const token = await getPayPalToken()
  if (!token) throw new Error('PayPal auth failed') // our problem, not the sender's: let PayPal retry
  const res = await fetch(`${PAYPAL_API()}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ ...headers, webhook_id: Deno.env.get('PAYPAL_WEBHOOK_ID'), webhook_event: event }),
  })
  if (!res.ok) throw new Error(`PayPal verify HTTP ${res.status}`)
  return (await res.json()).verification_status === 'SUCCESS'
}

function derivePlanType(resource: any): string {
  const raw = `${resource?.plan_id ?? ''} ${resource?.plan?.name ?? ''}`.toLowerCase()
  const amount = Number(resource?.billing_info?.last_payment?.amount?.value ?? 0)
  if (raw.includes('ny sports') || Math.abs(amount - 19.99) < 0.01) return 'ny_sports'
  if (raw.includes('year') || raw.includes('annual') || amount >= 100) return 'annual'
  if (raw.includes('week') || (amount > 0 && amount < 6)) return 'weekly'
  return 'premium'
}

function addPeriod(from: Date, planType: string): Date {
  const d = new Date(from)
  if (planType === 'annual') d.setFullYear(d.getFullYear() + 1)
  else if (planType === 'weekly') d.setDate(d.getDate() + 7)
  else d.setMonth(d.getMonth() + 1)
  return d
}

/** Paid-through date: PayPal's next billing time + 1 day grace, else one period past the later of now/end_date. */
async function paidThrough(sub: Sub): Promise<string> {
  if (sub.paypal_subscription_id) {
    const state = await getPayPalSubscriptionState(sub.paypal_subscription_id)
    if (state.nextBillingTime) {
      return new Date(new Date(state.nextBillingTime).getTime() + 86_400_000).toISOString()
    }
  }
  const base = sub.end_date && new Date(sub.end_date) > new Date() ? new Date(sub.end_date) : new Date()
  return addPeriod(base, sub.plan_type).toISOString()
}

async function findByPayPalId(supabase: ServiceClient, paypalId: string): Promise<Sub[]> {
  // Two .eq() queries instead of an .or() string, so the id is never parsed as filter syntax.
  const [bySub, byOrder] = await Promise.all([
    supabase.from('subscriptions').select(SUB_COLUMNS).eq('paypal_subscription_id', paypalId),
    supabase.from('subscriptions').select(SUB_COLUMNS).eq('paypal_order_id', paypalId),
  ])
  if (bySub.error) throw bySub.error
  if (byOrder.error) throw byOrder.error
  const seen = new Set<string>()
  return [...(bySub.data ?? []), ...(byOrder.data ?? [])].filter((s: Sub) => !seen.has(s.id) && seen.add(s.id))
}

async function setStatus(supabase: ServiceClient, sub: Sub, patch: Record<string, unknown>, action: string, eventId: string) {
  const { error } = await supabase
    .from('subscriptions')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', sub.id)
  if (error) throw error
  await supabase.from('subscription_activity').insert({
    subscription_id: sub.id,
    user_id: sub.user_id,
    action,
    details: { from: sub.status, ...patch, paypal_event_id: eventId },
    performed_by: null,
  })
}

async function emailMember(
  supabase: ServiceClient,
  sub: Sub,
  eventId: string,
  kind: string,
  subject: string,
  heading: string,
  paragraph: string,
  cta?: { label: string; url: string },
) {
  const { data: profile } = await supabase.from('profiles').select('email, full_name').eq('id', sub.user_id).maybeSingle()
  if (!profile?.email) return
  const html = await renderBrandedEmailFor(supabase, {
    preheader: subject,
    heading,
    content: `<p>Hi ${escapeHtml(profile.full_name || 'Fan')},</p><p>${paragraph}</p>`,
    ...(cta ? { cta } : {}),
  })
  await queueTransactionalEmail(supabase, {
    to: profile.email,
    subject,
    html,
    label: `billing_${kind}`,
    idempotencyKey: `paypal:${eventId}:${sub.id}`,
  })
}

export async function processPayPalEvent(supabase: ServiceClient, event: PayPalEvent): Promise<ProcessOutcome> {
  const r = event.resource ?? {}
  const plans = 'https://www.metsxmfanzone.com/plans'

  switch (event.event_type) {
    case 'BILLING.SUBSCRIPTION.ACTIVATED': {
      let subs = await findByPayPalId(supabase, r.id)
      if (subs.length === 0) subs = await backfill(supabase, r)
      for (const sub of subs) {
        await setStatus(supabase, sub, { status: 'active', start_date: new Date().toISOString(), end_date: await paidThrough(sub) }, 'paypal_activated', event.id)
      }
      return subs.length ? 'processed' : 'ignored'
    }

    case 'PAYMENT.SALE.COMPLETED': {
      // Initial payment and every renewal land here.
      const paypalId = r.billing_agreement_id || r.id
      const subs = await findByPayPalId(supabase, paypalId)
      if (subs.length === 0) throw new Error('No subscription row yet for this payment') // retried later
      const sub = subs[0]
      const amount = Number(r.amount?.total ?? r.amount?.value ?? sub.amount ?? PLAN_PRICE[sub.plan_type] ?? 0)
      const { error: payError } = await supabase.from('subscription_payments').insert({
        subscription_id: sub.id,
        user_id: sub.user_id,
        amount,
        currency: r.amount?.currency ?? r.amount?.currency_code ?? 'USD',
        payment_method: 'paypal',
        status: 'completed',
        paypal_sale_id: r.id,
        notes: 'PayPal webhook',
      })
      if (payError?.code === '23505') return 'ignored' // this sale was already applied
      if (payError) throw payError
      const endDate = await paidThrough(sub)
      await setStatus(supabase, sub, {
        status: 'active',
        end_date: endDate,
        last_payment_date: new Date().toISOString(),
        last_payment_amount: amount,
        next_payment_date: endDate,
        total_payments_received: (sub.total_payments_received ?? 0) + 1,
      }, 'paypal_payment_completed', event.id)
      await emailMember(supabase, sub, event.id, 'receipt', 'Your MetsXMFanZone payment receipt', 'Payment received',
        `Thanks! We received your <strong>${escapeHtml(sub.plan_type)}</strong> payment and your membership is active.`)
      if (sub.status === 'past_due') {
        await notifyAdmin(supabase, { dedupeKey: `billing:recovered:${event.id}`, kind: 'billing', channels: ['discord'],
          title: '💳 Past-due member recovered', body: `A ${sub.plan_type} member's retry payment went through.` })
      }
      return 'processed'
    }

    case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED': {
      const subs = await findByPayPalId(supabase, r.id)
      for (const sub of subs) {
        if (sub.status !== 'active') continue
        await setStatus(supabase, sub, { status: 'past_due' }, 'paypal_payment_failed', event.id)
        await emailMember(supabase, sub, event.id, 'payment_failed', '⚠️ Your MetsXMFanZone payment didn’t go through', 'Payment failed',
          'PayPal couldn’t collect your membership payment. You still have access for 3 more days while PayPal retries. Please update your payment method in PayPal to keep watching.',
          { label: 'Manage membership', url: plans })
      }
      await notifyAdmin(supabase, { dedupeKey: `billing:failed:${event.id}`, kind: 'billing', channels: ['discord'],
        title: '💳 Payment failed', body: `${subs.length} membership(s) moved to past due.` })
      return subs.length ? 'processed' : 'ignored'
    }

    case 'BILLING.SUBSCRIPTION.SUSPENDED': {
      const subs = await findByPayPalId(supabase, r.id)
      for (const sub of subs) {
        await setStatus(supabase, sub, { status: 'suspended' }, 'paypal_suspended', event.id)
        await emailMember(supabase, sub, event.id, 'suspended', 'Your MetsXMFanZone membership is paused', 'Membership paused',
          'After several failed payment attempts PayPal paused your membership, so premium access is off for now. Reactivate any time.',
          { label: 'Reactivate', url: plans })
      }
      return subs.length ? 'processed' : 'ignored'
    }

    case 'BILLING.SUBSCRIPTION.CANCELLED': {
      const subs = await findByPayPalId(supabase, r.id)
      for (const sub of subs) {
        if (sub.status === 'cancelled') continue // our own site already cancelled it
        await setStatus(supabase, sub, { status: 'cancelled', cancellation_status: 'cancelled', cancellation_requested_at: new Date().toISOString() }, 'paypal_cancelled', event.id)
        await cancelPaypalAndRetainAccount(supabase, sub.user_id, 'PayPal cancellation webhook received', { subscriptionIds: [sub.id] })
      }
      await notifyAdmin(supabase, { dedupeKey: `billing:cancel:${event.id}`, kind: 'billing', channels: ['discord'],
        title: '👋 Membership cancelled', body: `${subs.length} membership(s) cancelled in PayPal.` })
      return subs.length ? 'processed' : 'ignored'
    }

    case 'BILLING.SUBSCRIPTION.EXPIRED': {
      const subs = await findByPayPalId(supabase, r.id)
      for (const sub of subs) {
        await setStatus(supabase, sub, { status: 'expired' }, 'paypal_expired', event.id)
        await emailMember(supabase, sub, event.id, 'expired', 'Your MetsXMFanZone membership has ended', 'Membership ended',
          'Your membership term is over. Thanks for being part of the FanZone! You can rejoin any time.', { label: 'Rejoin', url: plans })
      }
      return subs.length ? 'processed' : 'ignored'
    }

    case 'PAYMENT.SALE.REFUNDED':
    case 'PAYMENT.SALE.REVERSED': {
      const paypalId = r.billing_agreement_id || r.sale_id
      const subs = paypalId ? await findByPayPalId(supabase, paypalId) : []
      for (const sub of subs) await setStatus(supabase, sub, { status: 'refunded' }, 'paypal_refunded', event.id)
      if (r.sale_id) await supabase.from('subscription_payments').update({ status: 'refunded' }).eq('paypal_sale_id', r.sale_id)
      await notifyAdmin(supabase, { dedupeKey: `billing:refund:${event.id}`, kind: 'billing', channels: ['discord'],
        title: '↩️ Payment refunded or reversed', body: `${event.event_type} for ${subs.length} membership(s).` })
      return subs.length ? 'processed' : 'ignored'
    }

    case 'BILLING.SUBSCRIPTION.UPDATED': {
      // Only sync statuses that grant or remove access; never downgrade to pending.
      const map: Record<string, string> = { ACTIVE: 'active', SUSPENDED: 'suspended', CANCELLED: 'cancelled', EXPIRED: 'expired' }
      const next = map[String(r.status ?? '').toUpperCase()]
      if (!next) return 'ignored'
      const subs = await findByPayPalId(supabase, r.id)
      for (const sub of subs) if (sub.status !== next) await setStatus(supabase, sub, { status: next }, 'paypal_updated', event.id)
      return 'processed'
    }

    // CREATED fires before the buyer approves; granting access there gave
    // premium to people who never paid. ACTIVATED is the real start.
    case 'BILLING.SUBSCRIPTION.CREATED':
    default:
      return 'ignored'
  }
}

/** Member subscribed directly on PayPal, so there is no row yet: create one from their email. */
async function backfill(supabase: ServiceClient, r: any): Promise<Sub[]> {
  const email: string | undefined = r?.subscriber?.email_address
  if (!email) return []
  const { data: profile } = await supabase.from('profiles').select('id').ilike('email', email).maybeSingle()
  if (!profile?.id) return []
  const planType = derivePlanType(r)
  const { data, error } = await supabase
    .from('subscriptions')
    .insert({
      user_id: profile.id,
      plan_type: planType,
      status: 'pending',
      paypal_subscription_id: r.id,
      paypal_plan_id: r.plan_id ?? null,
      amount: Number(r?.billing_info?.last_payment?.amount?.value ?? PLAN_PRICE[planType]),
      currency: r?.billing_info?.last_payment?.amount?.currency_code || 'USD',
      notes: 'Back-filled from PayPal webhook',
    })
    .select(SUB_COLUMNS)
  if (error) throw error
  return data ?? []
}

/** Runs one stored event and records the outcome. Used by the webhook and the nightly retry. */
export async function runStoredEvent(supabase: ServiceClient, row: { id: string; payload: PayPalEvent; attempts: number }) {
  try {
    const outcome = await processPayPalEvent(supabase, row.payload)
    await supabase.from('paypal_webhook_events')
      .update({ status: outcome, attempts: row.attempts + 1, last_error: null, processed_at: new Date().toISOString() })
      .eq('id', row.id)
    return { ok: true as const, outcome }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    await supabase.from('paypal_webhook_events')
      .update({ status: 'failed', attempts: row.attempts + 1, last_error: message.slice(0, 500) })
      .eq('id', row.id)
    return { ok: false as const, error: message }
  }
}
