import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
};

Deno.serve(async (req) => {
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

    const { orderId, subscriptionId } = await req.json();
    const paypalSubId = subscriptionId || orderId;

    if (!paypalSubId) {
      return new Response(
        JSON.stringify({ error: 'Subscription ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const PAYPAL_CLIENT_ID = Deno.env.get('PAYPAL_CLIENT_ID')!;
    const PAYPAL_SECRET = Deno.env.get('PAYPAL_SECRET')!;
    const PAYPAL_API = Deno.env.get('PAYPAL_BASE_URL') || 'https://api-m.paypal.com';

    // Get PayPal access token
    const authResponse = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`)}`,
      },
      body: 'grant_type=client_credentials',
    });
    const authData = await authResponse.json();

    // Get subscription details from PayPal
    const subResponse = await fetch(`${PAYPAL_API}/v1/billing/subscriptions/${paypalSubId}`, {
      headers: {
        'Authorization': `Bearer ${authData.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    const subData = await subResponse.json();
    console.log('PayPal subscription status:', { status: subData.status || '[UNKNOWN]', id: '[REDACTED]' });

    // Check if subscription is active or approved
    const isActive = subData.status === 'ACTIVE' || subData.status === 'APPROVED';
    
    if (!isActive) {
      return new Response(
        JSON.stringify({ error: 'Subscription is not active', status: subData.status }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find our subscription record
    const { data: subscription, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select('id, user_id, plan_type, status, amount, currency')
      .eq('paypal_subscription_id', paypalSubId)
      .maybeSingle();

    if (subscriptionError) throw new Error('Unable to verify subscription record');

    if (!subscription) {
      // Also try matching by paypal_order_id for backward compatibility
      const { data: legacySub, error: legacyError } = await supabase
        .from('subscriptions')
        .select('id, user_id, plan_type, status, amount, currency')
        .eq('paypal_order_id', paypalSubId)
        .maybeSingle();

      if (legacyError) throw new Error('Unable to verify legacy subscription record');
      
      if (!legacySub) {
        throw new Error('Subscription not found');
      }
      
      // Handle legacy order - continue with capture flow
      return await handleLegacyOrder(supabase, legacySub, paypalSubId, user, authData.access_token, PAYPAL_API);
    }

    // Verify the authenticated user owns this subscription
    if (subscription.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate end date based on plan type
    const startDate = new Date();
    const endDate = new Date(startDate);
    if (subscription.plan_type === 'annual') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else if (subscription.plan_type === 'weekly') {
      endDate.setDate(endDate.getDate() + 7);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }

    // Activate the subscription
    const { error: updateError } = await supabase
      .from('subscriptions')
      .update({
        status: 'active',
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
      })
      .eq('id', subscription.id);

    if (updateError) {
      console.error('Error updating subscription:', updateError);
      throw updateError;
    }

    // Send confirmation email
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('id', user.id)
        .single();

      await supabase.functions.invoke('send-confirmation-email', {
        body: {
          type: 'subscription',
          email: profile?.email || user.email,
          name: profile?.full_name,
          planType: subscription.plan_type,
          amount: subscription.amount?.toString() || (subscription.plan_type === 'annual' ? '129.99' : subscription.plan_type === 'weekly' ? '3.99' : '9.99'),
          transactionDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
          subscriptionId: paypalSubId,
        },
      });
    } catch (emailError) {
      console.error('Error sending confirmation email:', emailError);
    }

    // Notify admins
    try {
      await supabase.functions.invoke('notify-admin-new-member', {
        body: {
          userId: user.id,
          planType: subscription.plan_type,
          amount: subscription.plan_type === 'annual' ? '$129.99' : subscription.plan_type === 'weekly' ? '$3.99' : '$9.99',
          source: 'PayPal Subscription',
        },
      });
    } catch (notifyError) {
      console.error('Error notifying admins:', notifyError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        subscription: {
          id: subscription.id,
          plan_type: subscription.plan_type,
          status: 'active',
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error verifying PayPal payment:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Handle legacy one-time orders for backward compatibility
async function handleLegacyOrder(supabase: any, subscription: any, orderId: string, user: any, accessToken: string, apiUrl: string) {
  if (subscription.user_id !== user.id) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Capture the payment
  const captureResponse = await fetch(`${apiUrl}/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  const captureData = await captureResponse.json();
  if (!captureResponse.ok || captureData.status !== 'COMPLETED') {
    throw new Error('Payment capture failed');
  }

  const startDate = new Date();
  const endDate = new Date(startDate);
  if (subscription.plan_type === 'annual') {
    endDate.setFullYear(endDate.getFullYear() + 1);
  } else if (subscription.plan_type === 'weekly') {
    endDate.setDate(endDate.getDate() + 7);
  } else {
    endDate.setMonth(endDate.getMonth() + 1);
  }

  await supabase
    .from('subscriptions')
    .update({
      status: 'active',
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
    })
    .eq('id', subscription.id);

  return new Response(
    JSON.stringify({ 
      success: true, 
      subscription: {
        id: subscription.id,
        plan_type: subscription.plan_type,
        status: 'active',
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
      }
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
