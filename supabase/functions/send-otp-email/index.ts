import { createServiceClient, queueTransactionalEmail } from '../_shared/queue-email.ts'
import { renderBrandedEmailFor } from '../_shared/email-brand.ts'

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

    const html = await renderBrandedEmailFor(supabase, {
      preheader: "Your MetsXMFanZone verification code.",
      heading: "Your verification code",
      content: `
        <div style="background: #002D72; padding: 12px 16px; text-align: center; border-radius: 6px; margin-bottom: 12px;">
          <span style="font-size: 24px; font-weight: bold; letter-spacing: 6px; color: #ffffff; font-family: 'Courier New', monospace;">
            ${otp}
          </span>
        </div>
        <p style="color: #a0a0a0; text-align: center; font-size: 12px; margin: 0 0 12px;">
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
        <p style="color: #666; text-align: center; font-size: 11px; margin: 0;">
          Didn't request this? Ignore this email.
        </p>`,
    });

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
