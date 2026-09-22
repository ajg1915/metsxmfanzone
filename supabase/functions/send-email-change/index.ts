import { createServiceClient, queueTransactionalEmail } from "../_shared/queue-email.ts";
import { renderBrandedEmailFor, escapeHtml } from "../_shared/email-brand.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "X-Content-Type-Options": "nosniff",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

// deno-lint-ignore no-explicit-any
const buildHtml = async (supabase: any, link: string, newEmail: string) => {
  const safeLink = escapeHtml(link);
  const safeEmail = escapeHtml(newEmail);
  return await renderBrandedEmailFor(supabase, {
    preheader: "Confirm your new MetsXMFanZone email address.",
    heading: "Confirm your new email",
    content: `
      <p style="margin:0 0 16px;text-align:center;">Confirm <strong style="color:#ffffff;">${safeEmail}</strong> as the email address for your MetsXMFanZone account.</p>
      <p style="margin:0;text-align:center;font-size:12px;color:#8b93a1;">Or copy this link:<br/>
        <a href="${safeLink}" style="color:#FF5910;word-break:break-all;font-size:11px;">${safeLink}</a>
      </p>`,
    cta: { label: "Confirm Email", url: link },
    note: "If you did not request this change, you can ignore this email and your address stays the same.",
  });
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return json({ error: "Unauthorized" }, 401);

    const supabase = createServiceClient();
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    const user = userData?.user;
    if (userError || !user?.email) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const newEmail = typeof body?.newEmail === "string" ? body.newEmail.trim().toLowerCase() : "";

    if (!newEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(newEmail)) {
      return json({ error: "A valid new email address is required" }, 400);
    }
    if (newEmail === user.email.toLowerCase()) {
      return json({ error: "That is already your email address" }, 400);
    }

    const { data, error } = await supabase.auth.admin.generateLink({
      type: "email_change_new",
      email: user.email,
      newEmail,
      options: { redirectTo: "https://metsxmfanzone.com/dashboard" },
    });

    if (error || !data?.properties?.action_link) {
      console.warn("send-email-change: link generation failed");
      return json({ error: "Could not start the email change" }, 400);
    }

    await queueTransactionalEmail(supabase, {
      to: newEmail,
      subject: "Confirm your new MetsXMFanZone email",
      html: await buildHtml(supabase, data.properties.action_link, newEmail),
      text: `Confirm ${newEmail} as your MetsXMFanZone email address: ${data.properties.action_link}\n\nIf you did not request this change, ignore this email.`,
      label: "email_change",
      metadata: { email_type: "email_change" },
      idempotencyKey: `email-change-${user.id}-${newEmail}`,
    });

    return json({ success: true });
  } catch (error) {
    console.error("send-email-change: ERROR", error instanceof Error ? error.message : "unknown");
    return json({ error: "Email change request could not be sent" }, 500);
  }
});
