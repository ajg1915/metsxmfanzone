// Daily cron: finds paid members who've been active 60+ consecutive days
// and haven't received a loyalty reward in the past 365 days. Creates a
// pending reward row and emails them a claim link.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { sendTemplateEmail } from '../_shared/transactional-email-templates/send-email.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SITE_URL = 'https://www.metsxmfanzone.com'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, serviceKey)

  try {
    // Active paid subscriptions older than 60 days
    const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
    const { data: subs, error: subErr } = await supabase
      .from('subscriptions')
      .select('user_id, start_date, plan_type, status, end_date')
      .eq('status', 'active')
      .in('plan_type', ['weekly', 'premium', 'annual'])
      .lte('start_date', cutoff)

    if (subErr) throw subErr

    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()
    const created: string[] = []
    const skipped: string[] = []

    for (const sub of subs || []) {
      // Skip if subscription has effectively ended
      if (sub.end_date && new Date(sub.end_date) < new Date()) continue

      // Check past reward within 365 days
      const { data: existing } = await supabase
        .from('loyalty_rewards')
        .select('id')
        .eq('user_id', sub.user_id)
        .gte('created_at', oneYearAgo)
        .maybeSingle()

      if (existing) {
        skipped.push(sub.user_id)
        continue
      }

      // Create reward row
      const { data: reward, error: insErr } = await supabase
        .from('loyalty_rewards')
        .insert({
          user_id: sub.user_id,
          eligibility_start_date: sub.start_date,
          status: 'pending',
        })
        .select('id, claim_token')
        .single()

      if (insErr || !reward) {
        console.error('Insert error', insErr)
        continue
      }

      // Get email + name
      const { data: profile } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('id', sub.user_id)
        .maybeSingle()

      if (!profile?.email) continue

      const claimUrl = `${SITE_URL}/rewards/claim?token=${reward.claim_token}`
      const optOutUrl = `${SITE_URL}/rewards/claim?token=${reward.claim_token}&action=optout`

      await supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'loyalty-reward-available',
          recipientEmail: profile.email,
          idempotencyKey: `loyalty-reward-${reward.id}`,
          templateData: {
            name: profile.full_name || '',
            claimUrl,
            optOutUrl,
          },
        },
      })

      await supabase
        .from('loyalty_rewards')
        .update({ email_sent_at: new Date().toISOString() })
        .eq('id', reward.id)

      created.push(sub.user_id)
    }

    return new Response(
      JSON.stringify({ ok: true, created: created.length, skipped: skipped.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    console.error('check-loyalty-rewards error', e)
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
