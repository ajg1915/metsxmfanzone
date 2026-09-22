import { createServiceClient, queueTransactionalEmail } from "../_shared/queue-email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "X-Content-Type-Options": "nosniff",
};

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (match) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[match] || match));

const buildHtml = (link: string) => {
  const safeLink = escapeHtml(link);
  return `<!DOCTYPE html>
  <html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;padding:16px;background:#0a0a0a;">
    <div style="max-width:360px;margin:0 auto;background:#1a1a2e;border:1px solid #2a2a3e;border-radius:8px;padding:20px;">
      <p style="text-align:center;margin:0 0 12px;">
        <span style="color:#4d8bd6;font-size:18px;font-weight:bold;">Mets</span><span style="color:#FF5910;font-size:18px;font-weight:bold;">XM</span><span style="color:#fff;font-size:18px;font-weight:bold;">FanZone</span>
      </p>
      <p style="color:#fff;text-align:center;font-size:14px;font-weight:bold;margin:0 0 8px;">Reset your password</p>
      <p style="color:#a0a0a0;text-align:center;font-size:12px;margin:0 0 16px;">Tap the button below to choose a new password. This link expires in 1 hour.</p>
      <div style="text-align:center;margin-bottom:16px;">
        <a href="${safeLink}" style="display:inline-block;background:linear-gradient(135deg,#FF5910,#FF7A3D);color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:bold;font-size:14px;">Reset Password</a>
      </div>
      <p style="color:#666;text-align:center;font-size:10px;margin:0 0 12px;">Or copy this link:<br/><a href="${safeLink}" style="color:#FF5910;word-break:break-all;font-size:9px;">${safeLink}</a></p>
      <p style="color:#555;text-align:center;font-size:10px;margin:0;">If you did not request this, you can ignore this email.</p>
    </div>
  </body></html>`;
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
      html: buildHtml(data.properties.action_link),
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
