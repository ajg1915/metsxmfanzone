import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { z } from 'npm:zod@3.23.8'
import { sendTemplateEmail } from '../_shared/transactional-email-templates/send-email.ts'

const BodySchema = z.object({
  rewardId: z.string().uuid(),
  trackingNumber: z.string().max(120).optional(),
  carrier: z.string().max(60).optional(),
})

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData } = await authClient.auth.getUser()
    const user = userData?.user
    if (!user) return json({ error: 'Unauthorized' }, 401)

    const supabase = createClient(supabaseUrl, serviceKey)

    const { data: isAdmin } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin',
    })
    if (!isAdmin) return json({ error: 'Forbidden' }, 403)

    const parsed = BodySchema.safeParse(await req.json())
    if (!parsed.success) {
      return json({ error: parsed.error.flatten().fieldErrors }, 400)
    }
    const { rewardId, trackingNumber, carrier } = parsed.data

    const { data: reward } = await supabase
      .from('loyalty_rewards')
      .select('id, user_id, tracking_number, carrier')
      .eq('id', rewardId)
      .maybeSingle()

    if (!reward) return json({ error: 'Reward not found' }, 404)

    const { data: profile } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', reward.user_id)
      .maybeSingle()

    if (!profile?.email) return json({ error: 'Member has no email on file' }, 400)

    const result = await sendTemplateEmail('loyalty-reward-shipped', profile.email, {
      idempotencyKey: `loyalty-shipped-${reward.id}`,
      templateData: {
        name: profile.full_name || '',
        trackingNumber: trackingNumber ?? reward.tracking_number ?? '',
        carrier: carrier ?? reward.carrier ?? '',
      },
    })

    return json({ ok: true, sent: result.sent, reason: result.reason ?? null })
  } catch (e) {
    console.error('send-loyalty-shipped-email error', e instanceof Error ? e.message : String(e))
    return json({ error: 'Failed to send shipping notification' }, 500)
  }
})
