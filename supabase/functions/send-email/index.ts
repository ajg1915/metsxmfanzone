// Send emails via Resend through the Lovable connector gateway.
// Invoke with: supabase.functions.invoke('send-email', { body: { to, subject, html, text?, from? } })

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/resend'
const DEFAULT_FROM = 'MetsXMFanZone <noreply@metsxmfanzone.com>'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured')

    const RESEND_API_KEY =
      Deno.env.get('RESEND_API_KEY_1') ?? Deno.env.get('RESEND_API_KEY')
    if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY is not configured')

    const { to, subject, html, text, from } = await req.json()

    if (!to || !subject || (!html && !text)) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields: to, subject, and html or text',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const response = await fetch(`${GATEWAY_URL}/emails`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': RESEND_API_KEY,
      },
      body: JSON.stringify({
        from: from ?? DEFAULT_FROM,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        text: text ?? undefined,
        reply_to: 'support@metsxmfanzone.com',
        headers: {
          'List-Unsubscribe': '<https://metsxmfanzone.com/unsubscribe>',
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      }),
    })

    const data = await response.json()
    if (!response.ok) {
      console.error('Resend send failed', { status: response.status, data })
      return new Response(
        JSON.stringify({ success: false, error: data }),
        {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    return new Response(JSON.stringify({ success: true, id: data.id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('send-email error:', message)
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
