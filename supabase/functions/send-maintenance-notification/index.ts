import { createClient } from "npm:@supabase/supabase-js@2";

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

const DEFAULT_EMOJIS = {
  maintenance: "🔧",
};

const loadSavedEmojis = async (supabase: any) => {
  const { data } = await supabase
    .from("site_settings")
    .select("setting_value")
    .eq("setting_key", "email_emojis")
    .maybeSingle();
  return { ...DEFAULT_EMOJIS, ...(data?.setting_value || {}) };
};

const loadEmailStyle = async (supabase: any) => {
  const { data } = await supabase
    .from("site_settings")
    .select("setting_value")
    .eq("setting_key", "email_style")
    .maybeSingle();
  
  const defaults = {
    bgColor: "#0a0a1a",
    cardBgColor: "#1a1a3e",
    textColor: "#ffffff",
    mutedTextColor: "#a0a0c0",
    accentColor: "#ff6b35",
    primaryColor: "#002D72",
    borderColor: "#2a2a5a",
    borderRadius: 12,
    logoUrl: "https://metsxmfanzone.lovable.app/logo-192.png",
    logoWidth: 60,
  };
  
  return { ...defaults, ...(data?.setting_value || {}) };
};

const buildMaintenanceEmail = (message: string, style: any, emojis: any) => {
  const safeMessage = escapeHtml(message);
  
  return `<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"></head>
<body style="margin: 0; padding: 0;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0a0e1a" style="background-color: #0a0e1a; margin: 0; padding: 0;">
    <tr>
      <td align="center" style="padding: 16px;">
        <table width="480" cellpadding="0" cellspacing="0" border="0" bgcolor="${style.cardBgColor}" style="max-width: 480px; width: 100%; background-color: ${style.cardBgColor}; border-radius: ${style.borderRadius}px; border: 1px solid ${style.borderColor}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <tr>
            <td style="padding: 32px;">
    <div style="text-align: center; margin-bottom: 20px;">
      <img src="${style.logoUrl}" alt="MetsXMFanZone" style="width: ${style.logoWidth}px; height: auto; margin-bottom: 8px; border-radius: 12px;" />
    </div>
    <div style="text-align: center; margin-bottom: 20px;">
      <span style="font-size: 48px;">${emojis.maintenance}</span>
    </div>
    <h1 style="color: ${style.textColor}; text-align: center; font-size: 22px; font-weight: bold; margin: 0 0 12px;">Scheduled Maintenance</h1>
    <p style="color: ${style.mutedTextColor}; text-align: center; font-size: 14px; margin: 0 0 20px; line-height: 1.6;">${safeMessage}</p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#1a0d00" style="background: rgba(255,107,53,0.1); border-radius: 8px; border: 1px solid rgba(255,107,53,0.2);">
      <tr><td style="padding: 16px;">
        <p style="color: ${style.accentColor}; font-size: 13px; margin: 0; text-align: center; font-weight: 600;">⏱️ We'll notify you as soon as we're back online!</p>
      </td></tr>
    </table>
    <div style="text-align: center; margin: 20px 0;">
      <a href="https://www.metsxmfanzone.com" style="display: inline-block; background-color: ${style.accentColor}; color: white; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 700; font-size: 14px;">Visit MetsXMFanZone</a>
    </div>
    <div style="text-align: center; border-top: 1px solid ${style.borderColor}; padding-top: 16px;">
      <p style="color: ${style.mutedTextColor}; font-size: 11px; margin: 0;">Follow us on social media for live updates</p>
      <div style="margin-top: 8px;">
        <a href="https://x.com/metsxmfanzone" style="color: ${style.accentColor}; text-decoration: none; font-size: 12px; margin: 0 8px;">Twitter/X</a>
        <a href="https://www.instagram.com/metsxmfanzone" style="color: ${style.accentColor}; text-decoration: none; font-size: 12px; margin: 0 8px;">Instagram</a>
        <a href="https://www.facebook.com/metsxmfanzoneofficial" style="color: ${style.accentColor}; text-decoration: none; font-size: 12px; margin: 0 8px;">Facebook</a>
      </div>
    </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body></html>`;
};

const sendEmail = async (apiKey: string, to: string, subject: string, html: string) => {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: "MetsXMFanZone <noreply@notify.www.metsxmfanzone.com>",
      to: [to],
      subject,
      html,
      headers: {
        "List-Unsubscribe": "<mailto:unsubscribe@notify.www.metsxmfanzone.com>",
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Resend API error: ${error}`);
  }
  return await response.json();
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new Error("RESEND_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (!roleData) throw new Error("Admin access required");

    const { message } = await req.json();
    const maintenanceMessage = message || "We're currently performing scheduled maintenance. Please check back soon!";

    // Load email style and emojis
    const [style, emojis] = await Promise.all([
      loadEmailStyle(supabase),
      loadSavedEmojis(supabase),
    ]);

    const html = buildMaintenanceEmail(maintenanceMessage, style, emojis);
    const subject = `${emojis.maintenance} MetsXMFanZone is Under Maintenance`;

    // Gather all member emails
    const { data: profiles } = await supabase
      .from("profiles")
      .select("email")
      .not("email", "is", null);

    const { data: subscribers } = await supabase
      .from("newsletter_subscribers")
      .select("email")
      .eq("is_active", true);

    const emailSet = new Set<string>();
    for (const p of profiles || []) {
      if (p.email) emailSet.add(p.email.toLowerCase());
    }
    for (const s of subscribers || []) {
      if (s.email) emailSet.add(s.email.toLowerCase());
    }

    const allEmails = Array.from(emailSet);
    if (allEmails.length === 0) {
      return new Response(
        JSON.stringify({ message: "No recipients found", sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let successCount = 0;
    let failureCount = 0;
    const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

    console.log(`Sending maintenance notification to ${allEmails.length} members`);

    for (let i = 0; i < allEmails.length; i++) {
      try {
        await sendEmail(resendApiKey, allEmails[i], subject, html);
        successCount++;
      } catch (error) {
        console.error("Failed to send to [REDACTED]:", error);
        failureCount++;
      }
      if (i < allEmails.length - 1) await delay(600);
    }

    console.log(`Maintenance emails: ${successCount} sent, ${failureCount} failed`);

    return new Response(
      JSON.stringify({ message: `Maintenance notification sent to ${successCount} members`, sent: successCount, failed: failureCount }),
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
