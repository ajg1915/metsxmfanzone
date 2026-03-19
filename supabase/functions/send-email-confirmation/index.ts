import { createServiceClient, queueTransactionalEmail } from "../_shared/queue-email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

interface EmailConfirmationRequest {
  email: string;
  name?: string;
  userId: string;
  token?: string;
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (match) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[match] || match));

const buildConfirmationLink = (token: string, email: string) => {
  const baseUrl = "https://metsxmfanzone.com";
  return `${baseUrl}/confirm-account?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
};

const buildEmailHtml = ({
  confirmationLink,
  recipientName,
}: {
  confirmationLink: string;
  recipientName: string;
}) => {
  const safeLink = escapeHtml(confirmationLink);

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 16px; background-color: #0a0a0a;">
        <div style="max-width: 320px; margin: 0 auto; background-color: #1a1a2e; border-radius: 8px; padding: 20px; border: 1px solid #2a2a3e;">
          <div style="text-align: center; margin-bottom: 16px;">
            <img src="https://clwghkbtkofacsjeyrtk.supabase.co/storage/v1/object/public/email-assets/logo-192.png" alt="MetsXMFanZone" style="width: 85px; height: auto; margin-bottom: 8px; border-radius: 12px;" />
            <div>
              <span style="color: #002D72; font-size: 18px; font-weight: bold;">Mets</span><span style="color: #FF5910; font-size: 18px; font-weight: bold;">XM</span><span style="color: #ffffff; font-size: 18px; font-weight: bold;">FanZone</span>
            </div>
          </div>

          <p style="color: #ffffff; text-align: center; font-size: 14px; font-weight: bold; margin: 0 0 12px;">
            Welcome, ${recipientName}!
          </p>

          <p style="color: #a0a0a0; text-align: center; font-size: 12px; margin: 0 0 16px;">
            Please confirm your email address to activate your account.
          </p>

          <div style="text-align: center; margin-bottom: 16px;">
            <a href="${safeLink}" style="display: inline-block; background: linear-gradient(135deg, #FF5910, #FF7A3D); color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; font-size: 14px;">
              Confirm Email
            </a>
          </div>

          <p style="color: #666; text-align: center; font-size: 10px; margin: 0 0 16px;">
            Or copy and paste this link:<br/>
            <a href="${safeLink}" style="color: #FF5910; word-break: break-all; font-size: 9px;">${safeLink}</a>
          </p>

          <div style="background: #002D72; padding: 12px; border-radius: 6px; margin-bottom: 16px;">
            <p style="color: #ffffff; font-size: 11px; margin: 0 0 8px; font-weight: bold;">After confirming:</p>
            <ul style="color: #d0d0d0; font-size: 10px; margin: 0; padding-left: 16px;">
              <li style="margin-bottom: 4px;">Choose a subscription plan</li>
              <li style="margin-bottom: 4px;">Watch live streams</li>
              <li style="margin-bottom: 4px;">Connect with fans</li>
            </ul>
          </div>

          <p style="color: #888; text-align: center; font-size: 10px; margin: 0 0 12px;">
            This link expires in 24 hours.
          </p>

          <p style="color: #FF5910; text-align: center; font-size: 12px; font-weight: bold; margin: 0 0 12px;">
            Let&apos;s Go Mets!
          </p>

          <div style="border-top: 1px solid #2a2a3e; padding-top: 12px;">
            <p style="color: #555; font-size: 10px; text-align: center; margin: 0 0 10px;">
              The MetsXMFanZone Team
            </p>
            <p style="color: #444; font-size: 9px; text-align: center; margin: 0;">
              <a href="https://metsxmfanzone.com" style="color: #FF5910; text-decoration: none;">metsxmfanzone.com</a>
            </p>
          </div>
        </div>
      </body>
    </html>
  `;
};

const buildEmailText = ({
  confirmationLink,
  recipientName,
}: {
  confirmationLink: string;
  recipientName: string;
}) => `Welcome to MetsXMFanZone, ${recipientName}!

Please confirm your email address to activate your account.

Click here to confirm: ${confirmationLink}

After confirming:
- Choose a subscription plan
- Watch live streams
- Connect with fans

This link expires in 24 hours.

Let's Go Mets!

The MetsXMFanZone Team
https://metsxmfanzone.com`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, name, userId, token }: EmailConfirmationRequest = await req.json();

    if (!email || !userId) {
      return new Response(
        JSON.stringify({ error: "Email and userId are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const supabase = createServiceClient();
    const normalizedEmail = email.toLowerCase().trim();
    const confirmationToken = token || `${crypto.randomUUID()}-${Date.now().toString(36)}`;
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const recipientName = escapeHtml((name || "Mets Fan").trim());

    const { error: deleteError } = await supabase
      .from("email_confirmation_tokens")
      .delete()
      .eq("user_id", userId)
      .is("confirmed_at", null);

    if (deleteError) {
      console.warn("send-email-confirmation: failed to clean existing tokens", deleteError);
    }

    const { error: tokenError } = await supabase
      .from("email_confirmation_tokens")
      .insert({
        user_id: userId,
        token: confirmationToken,
        email: normalizedEmail,
        expires_at: tokenExpiry,
      });

    if (tokenError) {
      throw tokenError;
    }

    const confirmationLink = buildConfirmationLink(confirmationToken, normalizedEmail);
    const result = await queueTransactionalEmail(supabase, {
      to: normalizedEmail,
      subject: "Confirm Your MetsXMFanZone Account",
      html: buildEmailHtml({ confirmationLink, recipientName }),
      text: buildEmailText({ confirmationLink, recipientName }),
      label: "signup_confirmation",
      metadata: {
        email_type: "confirmation",
        user_id: userId,
      },
      idempotencyKey: `signup_confirmation:${normalizedEmail}:${confirmationToken}`,
    });

    return new Response(JSON.stringify({ success: true, queued: true, messageId: result.messageId }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("send-email-confirmation: ERROR", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});