import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
};

// Server-side plan config - never trust client
const PLAN_CONFIG: Record<string, { price: number; interval: string; intervalCount: number; name: string }> = {
  'premium': { price: 9.99, interval: 'MONTH', intervalCount: 1, name: 'Premium Monthly v2' },
  'annual': { price: 129.99, interval: 'YEAR', intervalCount: 1, name: 'Annual' },
};

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
  // Try to find existing product
  const listRes = await fetch(`${api}/v1/catalogs/products?page_size=20`, {
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  const listData = await listRes.json();
  
  const existing = listData.products?.find((p: any) => p.name === 'MetsXMFanZone Subscription');
  if (existing) return existing.id;

  // Create product
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
  console.log('Created PayPal product:', product.id);
  return product.id;
}

async function findOrCreatePlan(api: string, token: string, productId: string, planType: string) {
  const config = PLAN_CONFIG[planType];
  const planName = `MetsXMFanZone ${config.name}`;

  // List existing plans for the product
  const listRes = await fetch(`${api}/v1/billing/plans?product_id=${productId}&page_size=20`, {
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  const listData = await listRes.json();
  
  const existing = listData.plans?.find((p: any) => p.name === planName && p.status === 'ACTIVE');
  if (existing) return existing.id;

  // Create billing plan
  const createRes = await fetch(`${api}/v1/billing/plans`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': `metsxm-plan-${planType}-${Date.now()}`,
    },
    body: JSON.stringify({
      product_id: productId,
      name: planName,
      description: `MetsXMFanZone ${config.name} recurring subscription`,
      status: 'ACTIVE',
      billing_cycles: [
        {
          frequency: {
            interval_unit: config.interval,
            interval_count: config.intervalCount,
          },
          tenure_type: 'REGULAR',
          sequence: 1,
          total_cycles: 0, // infinite
          pricing_scheme: {
            fixed_price: {
              value: config.price.toString(),
              currency_code: 'USD',
            },
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
  console.log('Created PayPal billing plan:', plan.id);
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

    const { planType, returnOrigin } = await req.json();

    if (!planType || !PLAN_CONFIG[planType]) {
      return new Response(
        JSON.stringify({ error: 'Invalid plan type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use the client's origin for return URLs so it works on web, PWA, and preview
    const baseUrl = returnOrigin || 'https://www.metsxmfanzone.com';

    const config = PLAN_CONFIG[planType];
    const PAYPAL_CLIENT_ID = Deno.env.get('PAYPAL_CLIENT_ID')!;
    const PAYPAL_SECRET = Deno.env.get('PAYPAL_SECRET')!;
    const PAYPAL_API = Deno.env.get('PAYPAL_BASE_URL') || 'https://api-m.paypal.com';

    // Get access token
    const accessToken = await getPayPalAccessToken(PAYPAL_API, PAYPAL_CLIENT_ID, PAYPAL_SECRET);
    console.log('PayPal auth: [REDACTED]');

    // Get or create product and billing plan
    const productId = await findOrCreateProduct(PAYPAL_API, accessToken);
    const billingPlanId = await findOrCreatePlan(PAYPAL_API, accessToken, productId, planType);

    // Create a PayPal subscription
    const subscriptionRes = await fetch(`${PAYPAL_API}/v1/billing/subscriptions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': `metsxm-sub-${user.id}-${planType}-${Date.now()}`,
      },
      body: JSON.stringify({
        plan_id: billingPlanId,
        subscriber: {
          email_address: user.email,
        },
        application_context: {
          brand_name: 'MetsXMFanZone',
          locale: 'en-US',
          shipping_preference: 'NO_SHIPPING',
          user_action: 'SUBSCRIBE_NOW',
          return_url: `${baseUrl}/payment-success`,
          cancel_url: `${baseUrl}/plans`,
        },
      }),
    });

    const subscriptionData = await subscriptionRes.json();
    console.log('PayPal subscription response:', { status: subscriptionData.status || '[UNKNOWN]', id: '[REDACTED]' });

    if (!subscriptionRes.ok) {
      console.error('PayPal subscription error:', JSON.stringify(subscriptionData));
      throw new Error('Failed to create PayPal subscription');
    }

    // Create pending subscription record in our DB
    const { error: insertError } = await supabase
      .from('subscriptions')
      .insert({
        user_id: user.id,
        plan_type: planType,
        status: 'pending',
        paypal_subscription_id: subscriptionData.id,
        amount: config.price,
        currency: 'USD',
        payment_method: 'paypal',
      });

    if (insertError) {
      console.error('Error creating subscription record:', insertError);
      throw insertError;
    }

    const approvalUrl = subscriptionData.links?.find((l: any) => l.rel === 'approve')?.href;
    console.log('Recurring subscription created successfully');

    return new Response(
      JSON.stringify({ approvalUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error creating PayPal subscription:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
