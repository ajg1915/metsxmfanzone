import { createClient } from 'npm:@supabase/supabase-js@2'
import { escapeHtml, renderBrandedEmailFor } from '../_shared/email-brand.ts'

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

const sendDirectlyThroughResend = async (to: string, subject: string, html: string, text: string) => {
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')
  const resendApiKey = Deno.env.get('RESEND_API_KEY_1') ?? Deno.env.get('RESEND_API_KEY')
  if (!lovableApiKey || !resendApiKey) {
    throw new Error('Email service is not configured')
  }

  const normalizedTo = to.trim().toLowerCase()
  const response = await fetch('https://connector-gateway.lovable.dev/resend/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${lovableApiKey}`,
      'X-Connection-Api-Key': resendApiKey,
      'Idempotency-Key': `otp:${normalizedTo}:${crypto.randomUUID()}`,
    },
    body: JSON.stringify({
      from: 'MetsXMFanZone <noreply@metsxmfanzone.com>',
      to: [normalizedTo],
      subject,
      html,
      text,
      reply_to: 'support@metsxmfanzone.com',
    }),
  })

  const responseBody = await response.text()
  if (!response.ok) {
    console.error('OTP email provider rejected the request', { status: response.status })
    throw new Error(`Email provider rejected the request (${response.status})`)
  }

  try {
    return (JSON.parse(responseBody) as { id?: string }).id ?? crypto.randomUUID()
  } catch {
    return crypto.randomUUID()
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, otp }: OtpEmailRequest = await req.json();

    if (!to || !/^\S+@\S+\.\S+$/.test(to) || !/^\d{4,8}$/.test(otp)) {
      return new Response(
        JSON.stringify({ error: "A valid email address and 4–8 digit verification code are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Backend email service is not configured')
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const safeOtp = escapeHtml(otp)

    const html = await renderBrandedEmailFor(supabase, {
      preheader: "Your MetsXMFanZone verification code.",
      heading: "Your verification code",
      content: `
        <div style="background: #002D72; padding: 12px 16px; text-align: center; border-radius: 6px; margin-bottom: 12px;">
          <span style="font-size: 24px; font-weight: bold; letter-spacing: 6px; color: #ffffff; font-family: 'Courier New', monospace;">
            ${safeOtp}
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

    const subject = 'Your MetsXMFanZone Verification Code'
    const text = `Your MetsXMFanZone verification code is ${otp}. It expires in 5 minutes.`
    const messageId = await sendDirectlyThroughResend(to, subject, html, text)

    return new Response(
      JSON.stringify({ success: true, messageId }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : 'The verification email could not be sent'
    console.error("send-otp-email: ERROR", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
