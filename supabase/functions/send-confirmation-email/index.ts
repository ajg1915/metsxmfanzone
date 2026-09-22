import { createClient } from "npm:@supabase/supabase-js@2";
import { queueTransactionalEmail } from "../_shared/queue-email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

const escapeHtml = (str: string) => {
  return str.replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m] || m));
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
    const logoUrl = 'https://rdmrxeplasttewtlfetc.supabase.co/storage/v1/object/public/email-assets/logo-192.png';

    let emailContent = "";
    let subject = "";
    let templateLabel = "";

    if (type === "welcome") {
      subject = "Welcome to MetsXMFanZone.com";
      templateLabel = "welcome";
      emailContent = `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="color-scheme" content="light dark"></head>
<body style="margin: 0; padding: 0;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0a0a0a" style="background-color: #0a0a0a;">
    <tr><td align="center" style="padding: 16px;">
      <table width="320" cellpadding="0" cellspacing="0" border="0" bgcolor="#1a1a2e" style="max-width: 320px; width: 100%; background-color: #1a1a2e; border-radius: 8px; border: 1px solid #2a2a3e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <tr><td style="padding: 20px;">
          <div style="text-align: center; margin-bottom: 16px;">
            <img src="${logoUrl}" alt="MetsXMFanZone" style="width: 85px; height: auto; margin-bottom: 8px; border-radius: 12px;" />
            <div><span style="color: #002D72; font-size: 18px; font-weight: bold;">Mets</span><span style="color: #FF5910; font-size: 18px; font-weight: bold;">XM</span><span style="color: #ffffff; font-size: 18px; font-weight: bold;">FanZone</span></div>
          </div>
          <p style="color: #ffffff; text-align: center; font-size: 14px; font-weight: bold; margin: 0 0 12px;">Welcome, ${safeName}!</p>
          <p style="color: #a0a0a0; text-align: center; font-size: 12px; margin: 0 0 16px;">Your account has been created successfully.</p>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#002D72" style="background-color: #002D72; border-radius: 6px;">
            <tr><td style="padding: 12px;">
              <p style="color: #ffffff; font-size: 11px; margin: 0 0 8px; font-weight: bold;">What's Next:</p>
              <ul style="color: #d0d0d0; font-size: 10px; margin: 0; padding-left: 16px;">
                <li style="margin-bottom: 4px;">Choose a subscription plan</li>
                <li style="margin-bottom: 4px;">Watch live streams</li>
                <li style="margin-bottom: 4px;">Connect with fans</li>
              </ul>
            </td></tr>
          </table>
          <p style="color: #FF5910; text-align: center; font-size: 12px; font-weight: bold; margin: 12px 0;">Let's Go Mets!</p>
          <div style="border-top: 1px solid #2a2a3e; padding-top: 12px;">
            <p style="color: #555; font-size: 10px; text-align: center; margin: 0 0 10px;">The MetsXMFanZone Team</p>
            <p style="color: #444; font-size: 9px; text-align: center; margin: 0;"><a href="https://www.metsxmfanzone.com" style="color: #FF5910; text-decoration: none;">metsxmfanzone.com</a></p>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
    } else if (type === "subscription") {
      const planName = planType === "annual" ? "Annual" : "Premium Monthly";
      const billingCycle = planType === "annual" ? "Yearly" : "Monthly";
      subject = `MetsXMFanZone Receipt - ${planName} Plan`;
      templateLabel = "subscription_receipt";
      emailContent = `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="color-scheme" content="light dark"></head>
<body style="margin: 0; padding: 0;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0a0a0a" style="background-color: #0a0a0a;">
    <tr><td align="center" style="padding: 16px;">
      <table width="380" cellpadding="0" cellspacing="0" border="0" bgcolor="#1a1a2e" style="max-width: 380px; width: 100%; background-color: #1a1a2e; border-radius: 8px; border: 1px solid #2a2a3e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <tr><td style="padding: 20px;">
          <div style="text-align: center; margin-bottom: 16px;">
            <img src="${logoUrl}" alt="MetsXMFanZone" style="width: 85px; height: auto; margin-bottom: 8px; border-radius: 12px;" />
            <div><span style="color: #002D72; font-size: 18px; font-weight: bold;">Mets</span><span style="color: #FF5910; font-size: 18px; font-weight: bold;">XM</span><span style="color: #ffffff; font-size: 18px; font-weight: bold;">FanZone</span></div>
          </div>
          <p style="color: #4ade80; text-align: center; font-size: 16px; font-weight: bold; margin: 0 0 4px;">✓ Payment Receipt</p>
          <p style="color: #a0a0a0; text-align: center; font-size: 12px; margin: 0 0 16px;">Hi ${safeName}, here's your payment confirmation.</p>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#002D72" style="background-color: #002D72; border-radius: 6px;">
            <tr><td style="padding: 14px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="color: #a0a0a0; font-size: 11px; padding: 4px 0;">Plan</td><td style="color: #ffffff; font-size: 11px; font-weight: bold; text-align: right; padding: 4px 0;">${planName}</td></tr>
                <tr><td style="color: #a0a0a0; font-size: 11px; padding: 4px 0;">Amount Paid</td><td style="color: #ffffff; font-size: 11px; font-weight: bold; text-align: right; padding: 4px 0;">$${safeAmount} USD</td></tr>
                <tr><td style="color: #a0a0a0; font-size: 11px; padding: 4px 0;">Billing Cycle</td><td style="color: #ffffff; font-size: 11px; font-weight: bold; text-align: right; padding: 4px 0;">${billingCycle}</td></tr>
                <tr><td style="color: #a0a0a0; font-size: 11px; padding: 4px 0;">Date</td><td style="color: #ffffff; font-size: 11px; font-weight: bold; text-align: right; padding: 4px 0;">${safeDate}</td></tr>
                <tr><td style="color: #a0a0a0; font-size: 11px; padding: 4px 0;">Order Ref</td><td style="color: #ffffff; font-size: 11px; font-weight: bold; text-align: right; padding: 4px 0;">${safeOrderId}</td></tr>
                <tr><td style="color: #a0a0a0; font-size: 11px; padding: 4px 0;">Payment Method</td><td style="color: #ffffff; font-size: 11px; font-weight: bold; text-align: right; padding: 4px 0;">PayPal</td></tr>
                <tr><td style="color: #a0a0a0; font-size: 11px; padding: 4px 0;">Status</td><td style="color: #4ade80; font-size: 11px; font-weight: bold; text-align: right; padding: 4px 0;">Paid ✓</td></tr>
              </table>
            </td></tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#1f1f3a" style="background-color: #1f1f3a; border-radius: 6px; margin-top: 12px;">
            <tr><td style="padding: 10px;">
              <p style="color: #FF5910; font-size: 10px; margin: 0 0 6px; font-weight: bold;">Your Benefits:</p>
              <p style="color: #d0d0d0; font-size: 10px; margin: 0; line-height: 1.4;">Live streams • Full game replays • Premium content • Ad-free experience • HD streaming</p>
            </td></tr>
          </table>
          <p style="color: #888; font-size: 9px; text-align: center; margin: 12px 0;">You will also receive a receipt from PayPal. Keep this email for your records.</p>
          <div style="border-top: 1px solid #2a2a3e; padding-top: 12px;">
            <p style="color: #555; font-size: 10px; text-align: center; margin: 0 0 10px;">The MetsXMFanZone Team</p>
            <p style="color: #444; font-size: 9px; text-align: center; margin: 0;"><a href="https://www.metsxmfanzone.com" style="color: #FF5910; text-decoration: none;">metsxmfanzone.com</a></p>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
    } else {
      return new Response(
        JSON.stringify({ error: "Invalid email type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Queue the email instead of sending directly via Resend
    const messageId = crypto.randomUUID();
    const unsubscribeToken = await getOrCreateUnsubscribeToken(supabase, email);

    const payload = {
      to: email,
      from: VERIFIED_FROM_ADDRESS,
      sender_domain: VERIFIED_EMAIL_DOMAIN,
      subject,
      html: emailContent,
      text: subject,
      purpose: "transactional",
      label: templateLabel,
      idempotency_key: `${templateLabel}:${email.toLowerCase()}:${messageId}`,
      message_id: messageId,
      unsubscribe_token: unsubscribeToken,
      queued_at: new Date().toISOString(),
    };

    const { error: queueError } = await supabase.rpc("enqueue_email", {
      queue_name: EMAIL_QUEUE_NAME,
      payload,
    });

    if (queueError) throw queueError;

    await supabase.from("email_send_log").insert({
      message_id: messageId,
      template_name: templateLabel,
      recipient_email: email,
      status: "pending",
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
