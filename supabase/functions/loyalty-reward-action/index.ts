// Public endpoint (token-authenticated) for claiming or opting out of a
// loyalty reward. Validates claim_token, updates the reward row, and
// notifies admins on claim.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { z } from 'npm:zod@3.23.8'
import { sendTemplateEmail } from '../_shared/transactional-email-templates/send-email.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SITE_URL = 'https://www.metsxmfanzone.com'

const ClaimSchema = z.object({
  token: z.string().uuid(),
  action: z.enum(['claim', 'optout', 'lookup']),
  shippingName: z.string().trim().min(1).max(120).optional(),
  address1: z.string().trim().min(1).max(200).optional(),
  address2: z.string().trim().max(200).optional().nullable(),
  city: z.string().trim().min(1).max(100).optional(),
  state: z.string().trim().min(1).max(60).optional(),
  zip: z.string().trim().min(3).max(20).optional(),
  country: z.string().trim().min(1).max(80).optional(),
  shirtSize: z.enum(['S', 'M', 'L', 'XL', 'XXL', '3XL']).optional(),
  phone: z.string().trim().max(40).optional().nullable(),
})

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    const body = await req.json()
    const parsed = ClaimSchema.safeParse(body)
    if (!parsed.success) {
      return json({ error: 'Invalid input', details: parsed.error.flatten() }, 400)
    }
    const d = parsed.data

    const { data: reward, error: rerr } = await supabase
      .from('loyalty_rewards')
      .select('*')
      .eq('claim_token', d.token)
      .maybeSingle()

    if (rerr || !reward) return json({ error: 'Reward not found' }, 404)

    if (d.action === 'lookup') {
      return json({
        ok: true,
        reward: {
          status: reward.status,
          shippingName: reward.shipping_name,
          address1: reward.shipping_address1,
          address2: reward.shipping_address2,
          city: reward.shipping_city,
          state: reward.shipping_state,
          zip: reward.shipping_zip,
          country: reward.shipping_country,
          shirtSize: reward.shirt_size,
          phone: reward.phone,
          tracking: reward.tracking_number,
          carrier: reward.carrier,
        },
      })
    }

    if (reward.status !== 'pending') {
      return json({ error: 'This reward has already been processed.' }, 409)
    }

    if (d.action === 'optout') {
      await supabase
        .from('loyalty_rewards')
        .update({ status: 'opted_out', opted_out_at: new Date().toISOString() })
        .eq('id', reward.id)
      return json({ ok: true, status: 'opted_out' })
    }

    // action === 'claim'
    const required = ['shippingName', 'address1', 'city', 'state', 'zip', 'shirtSize'] as const
    for (const f of required) {
      if (!d[f]) return json({ error: `Missing field: ${f}` }, 400)
    }

    await supabase
      .from('loyalty_rewards')
      .update({
        status: 'claimed',
        claimed_at: new Date().toISOString(),
        shipping_name: d.shippingName,
        shipping_address1: d.address1,
        shipping_address2: d.address2 || null,
        shipping_city: d.city,
        shipping_state: d.state,
        shipping_zip: d.zip,
        shipping_country: d.country || 'United States',
        shirt_size: d.shirtSize,
        phone: d.phone || null,
      })
      .eq('id', reward.id)

    // Notify admins
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', reward.user_id)
      .maybeSingle()

    const { data: admins } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin')

    const adminIds = (admins || []).map((a) => a.user_id)
    let adminEmails: string[] = []
    if (adminIds.length) {
      const { data: adminProfiles } = await supabase
        .from('profiles')
        .select('email')
        .in('id', adminIds)
      adminEmails = (adminProfiles || []).map((p) => p.email).filter(Boolean)
    }

    for (const email of adminEmails) {
      await sendTemplateEmail('loyalty-reward-admin-notify', email, {
        idempotencyKey: `loyalty-admin-${reward.id}`,
        templateData: {
          memberName: profile?.full_name || '',
          memberEmail: profile?.email || 'unknown',
          shippingName: d.shippingName,
          address1: d.address1,
          address2: d.address2 || '',
          city: d.city,
          state: d.state,
          zip: d.zip,
          country: d.country || 'United States',
          shirtSize: d.shirtSize,
          phone: d.phone || '',
          adminUrl: `${SITE_URL}/admin/loyalty-rewards`,
        },
      })
    }

    return json({ ok: true, status: 'claimed' })
  } catch (e) {
    console.error('loyalty-reward-action error', e)
    return json({ error: String(e) }, 500)
  }
})

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
