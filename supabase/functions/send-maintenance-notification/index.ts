import { createServiceClient, queueTransactionalEmail } from '../_shared/queue-email.ts'
import { renderBrandedEmailFor } from '../_shared/email-brand.ts'

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

    const content = `
      <div style="text-align: center; margin-bottom: 20px;"><span style="font-size: 48px;">${emojis.maintenance}</span></div>
      <p style="text-align: center; font-size: 14px; margin: 0; line-height: 1.6;">${safeMessage}</p>`;

    const html = await renderBrandedEmailFor(supabase, {
      preheader: safeMessage,
      heading: "Scheduled Maintenance",
      content,
      cta: { label: "Visit MetsXMFanZone", url: "https://www.metsxmfanzone.com" },
      note: "Follow us for live updates",
    });

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
