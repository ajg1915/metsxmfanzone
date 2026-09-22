import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
};

const FREE_PLAN_NAME = 'MetsXMFanZone Free Membership Link';

async function getPayPalAccessToken(api: string, clientId: string, secret: string) {
  const res = await fetch(`${api}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${btoa(`${clientId}:${secret}`)}`,
    },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json();
  return data.access_token;
}

async function findOrCreateProduct(api: string, token: string) {
  const listRes = await fetch(`${api}/v1/catalogs/products?page_size=20`, {
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  const listData = await listRes.json();
  const existing = listData.products?.find((p: any) => p.name === 'MetsXMFanZone Subscription');
  if (existing) return existing.id;

  const createRes = await fetch(`${api}/v1/catalogs/products`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': `metsxm-product-${Date.now()}`,
    },
    body: JSON.stringify({
      name: 'MetsXMFanZone Subscription',
      description: 'MetsXMFanZone streaming and content subscription',
      type: 'SERVICE',
      category: 'ENTERTAINMENT_AND_MEDIA',
    }),
  });
  const product = await createRes.json();
  return product.id;
}

async function findOrCreateFreePlan(api: string, token: string, productId: string) {
  const listRes = await fetch(`${api}/v1/billing/plans?product_id=${productId}&page_size=20`, {
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  const listData = await listRes.json();
  const existing = listData.plans?.find((p: any) => p.name === FREE_PLAN_NAME && p.status === 'ACTIVE');
  if (existing) return existing.id;

  const createRes = await fetch(`${api}/v1/billing/plans`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': `metsxm-plan-free-${Date.now()}`,
    },
    body: JSON.stringify({
      product_id: productId,
      name: FREE_PLAN_NAME,
      description: 'Free MetsXMFanZone membership - PayPal account link only, $0.00 charged',
      status: 'ACTIVE',
      billing_cycles: [
        {
          frequency: { interval_unit: 'MONTH', interval_count: 1 },
          tenure_type: 'REGULAR',
          sequence: 1,
          total_cycles: 0,
          pricing_scheme: {
            fixed_price: { value: '0', currency_code: 'USD' },
          },
        },
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        payment_failure_threshold: 3,
      },
    }),
  });
  const plan = await createRes.json();
  if (!createRes.ok) {
    console.error('PayPal free plan creation error:', JSON.stringify(plan));
    throw new Error('Failed to create free membership link plan');
  }
  return plan.id;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { body = {}; }
    const returnOrigin = typeof body.returnOrigin === 'string' ? body.returnOrigin : undefined;
    const baseUrl = returnOrigin || 'https://www.metsxmfanzone.com';

    // Already on a paid plan? Nothing to link for free.
    const { data: activeRows, error: activeError } = await supabase
      .from('subscriptions')
      .select('id, plan_type, status')
      .eq('user_id', user.id)
      .eq('status', 'active');
    if (activeError) throw activeError;

    const paid = activeRows?.find((r: any) => ['weekly', 'premium', 'annual'].includes(r.plan_type));
    if (paid) {
      return new Response(
        JSON.stringify({ alreadyPaid: true, planType: paid.plan_type }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const PAYPAL_CLIENT_ID = Deno.env.get('PAYPAL_CLIENT_ID')!;
    const PAYPAL_SECRET = Deno.env.get('PAYPAL_SECRET')!;
    const PAYPAL_API = Deno.env.get('PAYPAL_BASE_URL') || 'https://api-m.paypal.com';

    const accessToken = await getPayPalAccessToken(PAYPAL_API, PAYPAL_CLIENT_ID, PAYPAL_SECRET);
    console.log('PayPal auth: [REDACTED]');

    const productId = await findOrCreateProduct(PAYPAL_API, accessToken);
    const billingPlanId = await findOrCreateFreePlan(PAYPAL_API, accessToken, productId);

    const subscriptionRes = await fetch(`${PAYPAL_API}/v1/billing/subscriptions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': `metsxm-free-${user.id}-${Date.now()}`,
      },
      body: JSON.stringify({
        plan_id: billingPlanId,
        subscriber: { email_address: user.email },
        application_context: {
          brand_name: 'MetsXMFanZone',
          locale: 'en-US',
          shipping_preference: 'NO_SHIPPING',
          user_action: 'SUBSCRIBE_NOW',
          return_url: `${baseUrl}/payment-success`,
          cancel_url: `${baseUrl}/plans?required=true`,
        },
      }),
    });

    const subscriptionData = await subscriptionRes.json();
    console.log('PayPal free link response:', { status: subscriptionData.status || '[UNKNOWN]', id: '[REDACTED]' });

    if (!subscriptionRes.ok) {
      console.error('PayPal free link error:', JSON.stringify(subscriptionData));
      throw new Error('Failed to start PayPal link');
    }

    const { error: insertError } = await supabase
      .from('subscriptions')
      .insert({
        user_id: user.id,
        plan_type: 'free',
        status: 'pending',
        paypal_subscription_id: subscriptionData.id,
        amount: 0,
        currency: 'USD',
        payment_method: 'paypal',
      });
    if (insertError) {
      console.error('Error creating free subscription record:', insertError);
      throw insertError;
    }

    const approvalUrl = subscriptionData.links?.find((l: any) => l.rel === 'approve')?.href;

    return new Response(
      JSON.stringify({ approvalUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error creating PayPal free link:', error);
    return new Response(
      JSON.stringify({ error: 'Unable to start PayPal link' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
