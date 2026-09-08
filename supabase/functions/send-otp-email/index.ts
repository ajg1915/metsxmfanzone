import { createServiceClient, queueTransactionalEmail } from '../_shared/queue-email.ts'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

interface OtpEmailRequest {
  to: string;
  otp: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, otp }: OtpEmailRequest = await req.json();

    if (!to || !otp) {
      return new Response(
        JSON.stringify({ error: "Email address and OTP code are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabase = createServiceClient();

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 16px; background-color: #0a0a0a;">
  <div style="max-width: 320px; margin: 0 auto; background-color: #1a1a2e; border-radius: 8px; padding: 20px; border: 1px solid #2a2a3e;">
    <div style="text-align: center; margin-bottom: 16px;">
      <img src="https://rdmrxeplasttewtlfetc.supabase.co/storage/v1/object/public/email-assets/logo-192.png" alt="MetsXMFanZone" style="width: 85px; height: auto; margin-bottom: 8px; border-radius: 12px;" />
      <div>
        <span style="color: #002D72; font-size: 18px; font-weight: bold;">Mets</span><span style="color: #FF5910; font-size: 18px; font-weight: bold;">XM</span><span style="color: #ffffff; font-size: 18px; font-weight: bold;">FanZone</span>
      </div>
    </div>
    <p style="color: #a0a0a0; text-align: center; font-size: 12px; margin: 0 0 12px;">
      Your verification code:
    </p>
    <div style="background: #002D72; padding: 12px 16px; text-align: center; border-radius: 6px; margin-bottom: 12px;">
      <span style="font-size: 24px; font-weight: bold; letter-spacing: 6px; color: #ffffff; font-family: 'Courier New', monospace;">
        ${otp}
      </span>
    </div>
    <p style="color: #666; text-align: center; font-size: 11px; margin: 0 0 12px;">
      Expires in <strong style="color: #FF5910;">5 min</strong>
    </p>
    <div style="background: #2a1a1a; border: 1px solid #FF5910; padding: 12px; border-radius: 6px; margin-bottom: 12px;">
      <p style="color: #FF5910; font-size: 11px; font-weight: bold; margin: 0 0 6px; text-align: center;">
        ⚠️ SECURITY WARNING
      </p>
      <p style="color: #ffffff; font-size: 10px; margin: 0; text-align: center; line-height: 1.4;">
        If another company asks for this PIN, do not share it. We will never ask for your PIN.
      </p>
    </div>
    <div style="border-top: 1px solid #2a2a3e; padding-top: 12px;">
      <p style="color: #555; font-size: 10px; text-align: center; margin: 0 0 10px;">
        Didn't request this? Ignore this email.
      </p>
      <p style="color: #444; font-size: 9px; text-align: center; margin: 0;">
        <a href="https://metsxmfanzone.com" style="color: #FF5910; text-decoration: none;">metsxmfanzone.com</a>
      </p>
    </div>
  </div>
</body>
</html>`;

    const { messageId } = await queueTransactionalEmail(supabase, {
      to,
      subject: "Your MetsXMFanZone Verification Code",
      html,
      text: `Your MetsXMFanZone verification code is ${otp}. It expires in 5 minutes.`,
      label: "otp_verification",
      idempotencyKey: `otp:${to.toLowerCase()}:${Date.now()}`,
    });

    return new Response(
      JSON.stringify({ success: true, messageId }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("send-otp-email: ERROR", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
