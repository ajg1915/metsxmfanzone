import { createClient } from "npm:@supabase/supabase-js@2";
import { cancelPaypalAndRetainAccount } from "../_shared/account-cleanup.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
};

// Infers our internal plan name from the PayPal subscription resource.
function derivePlanType(resource: any): 'weekly' | 'premium' | 'annual' {
  const interval: string | undefined =
    resource?.billing_info?.cycle_executions?.[0]?.tenure_type &&
    resource?.plan?.billing_cycles?.[0]?.frequency?.interval_unit;
  const raw = `${resource?.plan_id ?? ''} ${interval ?? ''} ${resource?.plan?.name ?? ''}`.toLowerCase();
  const amount = Number(resource?.billing_info?.last_payment?.amount?.value ?? 0);

  if (raw.includes('year') || raw.includes('annual') || amount >= 100) return 'annual';
  if (raw.includes('week') || (amount > 0 && amount < 6)) return 'weekly';
  return 'premium';
}



Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get webhook data
    const webhookBody = await req.text();
    const webhookEvent = JSON.parse(webhookBody);
    
    console.log('PayPal webhook received:', webhookEvent.event_type);

    // Verify PayPal webhook signature for security
    const webhookId = Deno.env.get('PAYPAL_WEBHOOK_ID')!;
    const transmissionId = req.headers.get('paypal-transmission-id');
    const transmissionTime = req.headers.get('paypal-transmission-time');
    const transmissionSig = req.headers.get('paypal-transmission-sig');
    const certUrl = req.headers.get('paypal-cert-url');
    const authAlgo = req.headers.get('paypal-auth-algo');

    if (!transmissionId || !transmissionTime || !transmissionSig || !certUrl || !authAlgo) {
      console.error('Missing PayPal webhook verification headers');
      return new Response(
        JSON.stringify({ error: 'Missing verification headers' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Verify the webhook signature with PayPal
    const paypalClientId = Deno.env.get('PAYPAL_CLIENT_ID')!;
    const paypalSecret = Deno.env.get('PAYPAL_SECRET')!;
    const paypalBaseUrl = Deno.env.get('PAYPAL_BASE_URL') || 'https://api-m.paypal.com';

    // Get PayPal access token
    const authResponse = await fetch(`${paypalBaseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${paypalClientId}:${paypalSecret}`)}`,
      },
      body: 'grant_type=client_credentials',
    });

    if (!authResponse.ok) {
      console.error('Failed to get PayPal access token');
      return new Response(
        JSON.stringify({ error: 'Authentication failed' }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const authData = await authResponse.json();
    const accessToken = authData.access_token;

    // Verify webhook signature
    const verifyResponse = await fetch(`${paypalBaseUrl}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        transmission_id: transmissionId,
        transmission_time: transmissionTime,
        cert_url: certUrl,
        auth_algo: authAlgo,
        transmission_sig: transmissionSig,
        webhook_id: webhookId,
        webhook_event: webhookEvent,
      }),
    });

    if (!verifyResponse.ok) {
      console.error('Webhook verification request failed:', verifyResponse.status);
      return new Response(
        JSON.stringify({ error: 'Verification failed' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const verifyData = await verifyResponse.json();
    
    if (verifyData.verification_status !== 'SUCCESS') {
      console.error('Invalid webhook signature:', verifyData.verification_status);
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { 
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Webhook signature verified successfully');
    console.log('Webhook data: event_type=' + webhookEvent.event_type + ', resource_id=[REDACTED]');

    const eventType = webhookEvent.event_type;
    const resource = webhookEvent.resource;

    // Handle different webhook events
    switch (eventType) {
      case 'PAYMENT.SALE.COMPLETED': {
        // Payment completed - activate subscription
        const orderId = resource.billing_agreement_id || resource.id;
        
        console.log('Processing payment completion for order: [REDACTED]');

        // Find subscription by PayPal order ID or subscription ID
        const { data: matches, error: fetchError } = await supabase
          .from('subscriptions')
          .select('*')
          .or(`paypal_order_id.eq.${orderId},paypal_subscription_id.eq.${orderId}`)
          .order('created_at', { ascending: false })
          .limit(1);

        if (fetchError) {
          console.error('Error fetching subscription:', fetchError.message);
          break;
        }

        const subscription = matches?.[0];
        if (!subscription) {
          console.warn('No membership record matched this payment; awaiting subscription event');
          break;
        }



        if (subscription) {
          // Calculate end date based on plan type
          const startDate = new Date();
          let endDate = new Date();
          
          if (subscription.plan_type === 'annual') {
            endDate.setFullYear(endDate.getFullYear() + 1);
          } else if (subscription.plan_type === 'weekly') {
            endDate.setDate(endDate.getDate() + 7);
          } else {
            endDate.setMonth(endDate.getMonth() + 1);
          }

          const { error: updateError } = await supabase
            .from('subscriptions')
            .update({
              status: 'active',
              start_date: startDate.toISOString(),
              end_date: endDate.toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', subscription.id);

          if (updateError) {
            console.error('Error updating subscription:', updateError);
          } else {
            console.log('Subscription activated:', subscription.id);
            // Send receipt email
            try {
              const { data: profile } = await supabase
                .from('profiles')
                .select('email, full_name')
                .eq('id', subscription.user_id)
                .single();

              if (profile?.email) {
                await supabase.functions.invoke('send-confirmation-email', {
                  body: {
                    type: 'subscription',
                    email: profile.email,
                    name: profile.full_name,
                    planType: subscription.plan_type,
                    amount: subscription.amount?.toString() || (subscription.plan_type === 'annual' ? '129.99' : subscription.plan_type === 'weekly' ? '3.99' : '9.99'),
                    transactionDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
                    subscriptionId: orderId,
                  },
                });
                console.log('Receipt email sent for subscription:', subscription.id);
              }
            } catch (emailErr) {
              console.error('Receipt email failed:', emailErr);
            }
            // Admin notification handled by verify-paypal-payment — skipped here to prevent duplicates
          }
        }
        break;
      }

      case 'BILLING.SUBSCRIPTION.CREATED':
      case 'BILLING.SUBSCRIPTION.ACTIVATED': {
        // Subscription created or activated
        const subscriptionId = resource.id;

        console.log('Processing subscription activation: [REDACTED]');

        const { data: existing } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('paypal_subscription_id', subscriptionId)
          .maybeSingle();

        let subscription = existing;

        // Back-fill: the subscriber signed up directly on PayPal (no row created by our app).
        if (!subscription) {
          const email: string | undefined =
            resource?.subscriber?.email_address || resource?.payer?.email_address;
          const planType = derivePlanType(resource);

          if (!email) {
            console.warn('Cannot back-fill subscription: no subscriber email on webhook resource');
            break;
          }

          const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .ilike('email', email)
            .maybeSingle();

          if (!profile?.id) {
            console.warn('Cannot back-fill subscription: no matching member account for subscriber');
            break;
          }

          const { data: inserted, error: insertError } = await supabase
            .from('subscriptions')
            .insert({
              user_id: profile.id,
              plan_type: planType,
              status: 'pending',
              paypal_subscription_id: subscriptionId,
              paypal_plan_id: resource?.plan_id ?? null,
              amount: Number(
                resource?.billing_info?.last_payment?.amount?.value ??
                  (planType === 'annual' ? 129.99 : planType === 'weekly' ? 3.99 : 9.99),
              ),
              currency: resource?.billing_info?.last_payment?.amount?.currency_code || 'USD',
              notes: 'Back-filled from PayPal webhook',
            })
            .select('*')
            .maybeSingle();

          if (insertError) {
            console.error('Error back-filling subscription:', insertError.message);
            break;
          }
          subscription = inserted;
          console.log('Back-filled missing subscription record');
        }

        if (subscription) {
          const startDate = new Date();
          const endDate = new Date();

          if (subscription.plan_type === 'annual') {
            endDate.setFullYear(endDate.getFullYear() + 1);
          } else if (subscription.plan_type === 'weekly') {
            endDate.setDate(endDate.getDate() + 7);
          } else {
            endDate.setMonth(endDate.getMonth() + 1);
          }

          const { error: updateError } = await supabase
            .from('subscriptions')
            .update({
              status: 'active',
              start_date: startDate.toISOString(),
              end_date: endDate.toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', subscription.id);

          if (updateError) {
            console.error('Error activating subscription:', updateError.message);
          } else {
            console.log('Subscription activated');
          }
        }
        break;
      }


      case 'BILLING.SUBSCRIPTION.EXPIRED': {
        // Natural end of term — mark the membership expired. Never delete the account.
        const subscriptionId = resource.id;
        const nowIso = new Date().toISOString();

        const { error: expireError } = await supabase
          .from('subscriptions')
          .update({
            status: 'expired',
            end_date: nowIso,
            updated_at: nowIso,
          })
          .eq('paypal_subscription_id', subscriptionId);

        if (expireError) {
          console.error('Error expiring subscription:', expireError.message);
        }
        break;
      }

      case 'BILLING.SUBSCRIPTION.CANCELLED': {
        // Subscription cancelled (from PayPal or from our site)
        const subscriptionId = resource.id;

        console.log('Processing subscription cancellation: [REDACTED]');

        const nowIso = new Date().toISOString();

        const { data: cancelledRows, error } = await supabase
          .from('subscriptions')
          .update({
            status: 'cancelled',
            cancellation_status: 'cancelled',
            end_date: nowIso,
            updated_at: nowIso,
          })
          .eq('paypal_subscription_id', subscriptionId)
          .select('id, user_id');

        if (error) {
          console.error('Error cancelling subscription:', error);
          break;
        }

        // Retain the member account and history after PayPal cancellation.
        for (const row of cancelledRows || []) {
          if (!row.user_id) continue;
          try {
            const cleanup = await cancelPaypalAndRetainAccount(
              supabase,
              row.user_id,
              'PayPal cancellation webhook received',
            );
            console.log('PayPal webhook account cleanup completed', {
              paypalConfirmed: cleanup.paypalConfirmed,
              accountRetained: cleanup.accountRetained,
              limitedAccess: cleanup.limitedAccess,
              userId: '[REDACTED]',
            });
          } catch (cleanupErr) {
            console.error('Account cleanup after PayPal cancellation failed', {
              userId: '[REDACTED]',
              message: cleanupErr instanceof Error ? cleanupErr.message : 'Unknown cleanup error',
            });
          }
        }
        break;
      }


      case 'BILLING.SUBSCRIPTION.SUSPENDED': {
        // Subscription suspended (payment failure)
        const subscriptionId = resource.id;
        
        console.log('Processing subscription suspension:', subscriptionId);

        const { error } = await supabase
          .from('subscriptions')
          .update({
            status: 'suspended',
            updated_at: new Date().toISOString(),
          })
          .eq('paypal_subscription_id', subscriptionId);

        if (error) {
          console.error('Error suspending subscription:', error);
        } else {
          console.log('Subscription suspended:', subscriptionId);
        }
        break;
      }

      case 'BILLING.SUBSCRIPTION.UPDATED': {
        // Subscription updated
        const subscriptionId = resource.id;
        
        console.log('Processing subscription update:', subscriptionId);

        // Update subscription details if needed
        const updateData: any = {
          updated_at: new Date().toISOString(),
        };

        // If status is in the resource, update it
        if (resource.status) {
          const statusMap: Record<string, string> = {
            'ACTIVE': 'active',
            'CANCELLED': 'cancelled',
            'SUSPENDED': 'suspended',
            'EXPIRED': 'expired',
          };
          updateData.status = statusMap[resource.status] || 'pending';
        }

        const { error } = await supabase
          .from('subscriptions')
          .update(updateData)
          .eq('paypal_subscription_id', subscriptionId);

        if (error) {
          console.error('Error updating subscription:', error);
        } else {
          console.log('Subscription updated:', subscriptionId);
        }
        break;
      }

      case 'PAYMENT.SALE.REFUNDED': {
        // Payment refunded
        const orderId = resource.billing_agreement_id || resource.sale_id;
        
        console.log('Processing refund for order: [REDACTED]');

        const { error } = await supabase
          .from('subscriptions')
          .update({
            status: 'refunded',
            updated_at: new Date().toISOString(),
          })
          .or(`paypal_order_id.eq.${orderId},paypal_subscription_id.eq.${orderId}`);

        if (error) {
          console.error('Error processing refund:', error);
        } else {
          console.log('Refund processed for order: [REDACTED]');
        }
        break;
      }

      default:
        console.log('Unhandled webhook event type:', eventType);
    }

    // Always return 200 to acknowledge receipt
    return new Response(
      JSON.stringify({ received: true }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Webhook processing error:', error);
    
    // Still return 200 to prevent PayPal from retrying
    return new Response(
      JSON.stringify({ received: true, error: 'Processing failed' }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
