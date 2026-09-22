import { createServiceClient, queueTransactionalEmail } from "../_shared/queue-email.ts";
import { renderBrandedEmailFor, escapeHtml } from "../_shared/email-brand.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "X-Content-Type-Options": "nosniff",
};

// deno-lint-ignore no-explicit-any
const buildHtml = async (supabase: any, link: string) => {
  const safeLink = escapeHtml(link);
  return await renderBrandedEmailFor(supabase, {
    preheader: "Reset your MetsXMFanZone password.",
    heading: "Reset your password",
    content: `
      <p style="margin:0 0 16px;text-align:center;">Tap the button below to choose a new password. This link expires in 1 hour.</p>
      <p style="margin:0;text-align:center;font-size:12px;color:#8b93a1;">Or copy this link:<br/>
        <a href="${safeLink}" style="color:#FF5910;word-break:break-all;font-size:11px;">${safeLink}</a>
      </p>`,
    cta: { label: "Reset Password", url: link },
    note: "If you did not request this, you can ignore this email.",
  });
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Always answer the same way so the endpoint cannot be used to discover accounts.
  const genericOk = () =>
    new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  try {
    const body = await req.json().catch(() => ({}));
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const redirectTo = typeof body?.redirectTo === "string" ? body.redirectTo : "https://metsxmfanzone.com/auth?mode=reset";

    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return new Response(JSON.stringify({ error: "A valid email is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const allowedOrigins = [
      "https://metsxmfanzone.com",
      "https://www.metsxmfanzone.com",
      "https://metsxmfanzone.lovable.app",
    ];
    const safeRedirect = allowedOrigins.some((origin) => redirectTo.startsWith(origin))
      ? redirectTo
      : "https://metsxmfanzone.com/auth?mode=reset";

    const supabase = createServiceClient();

    const { data, error } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: safeRedirect },
    });

    if (error || !data?.properties?.action_link) {
      console.warn("send-password-reset: link generation skipped");
      return genericOk();
    }

    await queueTransactionalEmail(supabase, {
      to: email,
      subject: "Reset your MetsXMFanZone password",
      html: await buildHtml(supabase, data.properties.action_link),
      text: `Reset your MetsXMFanZone password: ${data.properties.action_link}\n\nThis link expires in 1 hour. If you did not request this, ignore this email.`,
      label: "password_reset",
      metadata: { email_type: "password_reset" },
    });

    return genericOk();
  } catch (error) {
    console.error("send-password-reset: ERROR", error instanceof Error ? error.message : "unknown");
    return new Response(JSON.stringify({ error: "Reset email could not be sent" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
