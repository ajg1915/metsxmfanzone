import { createServiceClient, queueTransactionalEmail } from "../_shared/queue-email.ts";
import { renderBrandedEmailFor } from "../_shared/email-brand.ts";

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

const buildEmailHtml = async ({
  supabase,
  confirmationLink,
  recipientName,
}: {
  // deno-lint-ignore no-explicit-any
  supabase: any;
  confirmationLink: string;
  recipientName: string;
}) => {
  const safeLink = escapeHtml(confirmationLink);

  return await renderBrandedEmailFor(supabase, {
    preheader: "Confirm your email to activate your MetsXMFanZone account.",
    heading: `Welcome, ${recipientName}!`,
    content: `
      <p style="margin:0 0 16px;text-align:center;">Please confirm your email address to activate your account.</p>
      <div style="background:#002D72;padding:14px 16px;border-radius:10px;margin:0 0 16px;">
        <p style="color:#ffffff;font-size:13px;margin:0 0 8px;font-weight:700;">After confirming you can:</p>
        <ul style="color:#d0d8e6;font-size:13px;margin:0;padding-left:18px;">
          <li style="margin-bottom:4px;">Choose a membership plan</li>
          <li style="margin-bottom:4px;">Watch live streams</li>
          <li>Connect with fellow Mets fans</li>
        </ul>
      </div>
      <p style="margin:0;text-align:center;font-size:12px;color:#8b93a1;">Or copy and paste this link:<br/>
        <a href="${safeLink}" style="color:#FF5910;word-break:break-all;font-size:11px;">${safeLink}</a>
      </p>`,
    cta: { label: "Confirm Email", url: confirmationLink },
    note: "This link expires in 24 hours.",
  });
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
      html: await buildEmailHtml({ supabase, confirmationLink, recipientName }),
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