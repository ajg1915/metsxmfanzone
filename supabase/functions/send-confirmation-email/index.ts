import { createClient } from "npm:@supabase/supabase-js@2";
import { queueTransactionalEmail } from "../_shared/queue-email.ts";
import { renderBrandedEmailFor, escapeHtml } from "../_shared/email-brand.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

interface EmailRequest {
  type: "welcome" | "subscription";
  email: string;
  name?: string;
  planType?: string;
  amount?: string;
  transactionDate?: string;
  subscriptionId?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { type, email, name, planType, amount, transactionDate, subscriptionId }: EmailRequest = await req.json();

    const safeName = escapeHtml(name || "Mets Fan");
    const safeAmount = escapeHtml(amount || "0.00");
    const safeDate = escapeHtml(transactionDate || new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }));
    const safeOrderId = subscriptionId ? '****' + escapeHtml(subscriptionId.slice(-4)) : 'N/A';

    let emailContent = "";
    let subject = "";
    let templateLabel = "";

    if (type === "welcome") {
      subject = "Welcome to MetsXMFanZone.com";
      templateLabel = "welcome";
      emailContent = await renderBrandedEmailFor(supabase, {
        preheader: "Your MetsXMFanZone account has been created successfully.",
        heading: `Welcome, ${safeName}!`,
        content: `
          <p style="margin:0 0 16px;text-align:center;">Your account has been created successfully.</p>
          <div style="background:#002D72;padding:12px;border-radius:6px;">
            <p style="color:#ffffff;font-size:11px;margin:0 0 8px;font-weight:bold;">What's Next:</p>
            <ul style="color:#d0d0d0;font-size:10px;margin:0;padding-left:16px;">
              <li style="margin-bottom:4px;">Choose a subscription plan</li>
              <li style="margin-bottom:4px;">Watch live streams</li>
              <li style="margin-bottom:4px;">Connect with fans</li>
            </ul>
          </div>
          <p style="color:#FF5910;text-align:center;font-size:12px;font-weight:bold;margin:12px 0 0;">Let's Go Mets!</p>`,
      });
    } else if (type === "subscription") {
      const planName = planType === "annual" ? "Annual" : "Premium Monthly";
      const billingCycle = planType === "annual" ? "Yearly" : "Monthly";
      subject = `MetsXMFanZone Receipt - ${planName} Plan`;
      templateLabel = "subscription_receipt";
      emailContent = await renderBrandedEmailFor(supabase, {
        preheader: "Your MetsXMFanZone payment confirmation.",
        heading: "✓ Payment Receipt",
        content: `
          <p style="margin:0 0 16px;text-align:center;">Hi ${safeName}, here's your payment confirmation.</p>
          <table style="width:100%;border-collapse:collapse;background:#002D72;border-radius:6px;padding:14px;">
            <tr><td style="color:#a0a0a0;font-size:12px;padding:6px 10px;">Plan</td><td style="color:#ffffff;font-size:12px;font-weight:bold;text-align:right;padding:6px 10px;">${planName}</td></tr>
            <tr><td style="color:#a0a0a0;font-size:12px;padding:6px 10px;">Amount Paid</td><td style="color:#ffffff;font-size:12px;font-weight:bold;text-align:right;padding:6px 10px;">$${safeAmount} USD</td></tr>
            <tr><td style="color:#a0a0a0;font-size:12px;padding:6px 10px;">Billing Cycle</td><td style="color:#ffffff;font-size:12px;font-weight:bold;text-align:right;padding:6px 10px;">${billingCycle}</td></tr>
            <tr><td style="color:#a0a0a0;font-size:12px;padding:6px 10px;">Date</td><td style="color:#ffffff;font-size:12px;font-weight:bold;text-align:right;padding:6px 10px;">${safeDate}</td></tr>
            <tr><td style="color:#a0a0a0;font-size:12px;padding:6px 10px;">Order Ref</td><td style="color:#ffffff;font-size:12px;font-weight:bold;text-align:right;padding:6px 10px;">${safeOrderId}</td></tr>
            <tr><td style="color:#a0a0a0;font-size:12px;padding:6px 10px;">Payment Method</td><td style="color:#ffffff;font-size:12px;font-weight:bold;text-align:right;padding:6px 10px;">PayPal</td></tr>
            <tr><td style="color:#a0a0a0;font-size:12px;padding:6px 10px;">Status</td><td style="color:#4ade80;font-size:12px;font-weight:bold;text-align:right;padding:6px 10px;">Paid ✓</td></tr>
          </table>
          <div style="background:#1f1f3a;border-radius:6px;margin-top:12px;padding:10px;">
            <p style="color:#FF5910;font-size:11px;margin:0 0 6px;font-weight:bold;">Your Benefits:</p>
            <p style="color:#d0d0d0;font-size:11px;margin:0;line-height:1.4;">Live streams • Full game replays • Premium content • Ad-free experience • HD streaming</p>
          </div>
          <p style="color:#888;font-size:11px;text-align:center;margin:12px 0 0;">You will also receive a receipt from PayPal. Keep this email for your records.</p>`,
      });
    } else {
      return new Response(
        JSON.stringify({ error: "Invalid email type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { messageId } = await queueTransactionalEmail(supabase, {
      to: email,
      subject,
      html: emailContent,
      label: templateLabel,
    });

    return new Response(JSON.stringify({ success: true, messageId }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-confirmation-email:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
