import { createServiceClient, queueTransactionalEmail } from '../_shared/queue-email.ts'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const escapeHtml = (str: string): string => {
  if (!str) return "";
  return str.replace(/[&<>"']/g, (m) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[m] || m));
};

const loadEmailStyle = async (supabase: any) => {
  const { data } = await supabase.from("site_settings").select("setting_value").eq("setting_key", "email_style").maybeSingle();
  const defaults = {
    bgColor: "#0a0a1a", cardBgColor: "#1a1a3e", textColor: "#ffffff", mutedTextColor: "#a0a0c0",
    accentColor: "#ff6b35", primaryColor: "#002D72", borderColor: "#2a2a5a", borderRadius: 12,
    logoUrl: "https://rdmrxeplasttewtlfetc.supabase.co/storage/v1/object/public/email-assets/logo-192.png", logoWidth: 60,
  };
  return { ...defaults, ...(data?.setting_value || {}) };
};

const loadSavedEmojis = async (supabase: any) => {
  const { data } = await supabase.from("site_settings").select("setting_value").eq("setting_key", "email_emojis").maybeSingle();
  return { maintenance: "🔧", ...(data?.setting_value || {}) };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createServiceClient();

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").single();
    if (!roleData) throw new Error("Admin access required");

    const { message } = await req.json();
    const maintenanceMessage = message || "We're currently performing scheduled maintenance. Please check back soon!";

    const [style, emojis] = await Promise.all([loadEmailStyle(supabase), loadSavedEmojis(supabase)]);

    const safeMessage = escapeHtml(maintenanceMessage);
    const subject = `${emojis.maintenance} MetsXMFanZone is Under Maintenance`;

    const html = `<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0a0e1a" style="background-color: #0a0e1a;">
    <tr><td align="center" style="padding: 16px;">
      <table width="480" cellpadding="0" cellspacing="0" border="0" bgcolor="${style.cardBgColor}" style="max-width: 480px; width: 100%; background-color: ${style.cardBgColor}; border-radius: ${style.borderRadius}px; border: 1px solid ${style.borderColor}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <tr><td style="padding: 32px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <img src="${style.logoUrl}" alt="MetsXMFanZone" style="width: ${style.logoWidth}px; height: auto; margin-bottom: 8px; border-radius: 12px;" />
          </div>
          <div style="text-align: center; margin-bottom: 20px;"><span style="font-size: 48px;">${emojis.maintenance}</span></div>
          <h1 style="color: ${style.textColor}; text-align: center; font-size: 22px; font-weight: bold; margin: 0 0 12px;">Scheduled Maintenance</h1>
          <p style="color: ${style.mutedTextColor}; text-align: center; font-size: 14px; margin: 0 0 20px; line-height: 1.6;">${safeMessage}</p>
          <div style="text-align: center; margin: 20px 0;">
            <a href="https://www.metsxmfanzone.com" style="display: inline-block; background-color: ${style.accentColor}; color: white; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 700; font-size: 14px;">Visit MetsXMFanZone</a>
          </div>
          <div style="text-align: center; border-top: 1px solid ${style.borderColor}; padding-top: 16px;">
            <p style="color: ${style.mutedTextColor}; font-size: 11px; margin: 0;">Follow us for live updates</p>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

    const { data: profiles } = await supabase.from("profiles").select("email").not("email", "is", null);
    const { data: subscribers } = await supabase.from("newsletter_subscribers").select("email").eq("is_active", true);

    const emailSet = new Set<string>();
    for (const p of profiles || []) { if (p.email) emailSet.add(p.email.toLowerCase()); }
    for (const s of subscribers || []) { if (s.email) emailSet.add(s.email.toLowerCase()); }

    const allEmails = Array.from(emailSet);
    if (allEmails.length === 0) {
      return new Response(JSON.stringify({ message: "No recipients found", sent: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let successCount = 0;
    let failureCount = 0;

    for (const email of allEmails) {
      try {
        await queueTransactionalEmail(supabase, {
          to: email,
          subject,
          html,
          label: "maintenance_notification",
          idempotencyKey: `maintenance:${email}:${Date.now()}`,
        });
        successCount++;
      } catch {
        failureCount++;
      }
    }

    return new Response(
      JSON.stringify({ message: `Maintenance notification queued for ${successCount} members`, sent: successCount, failed: failureCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in send-maintenance-notification:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
