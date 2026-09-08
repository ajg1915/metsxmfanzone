import { createServiceClient, queueTransactionalEmail } from '../_shared/queue-email.ts'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const escapeHtml = (str: string): string => {
  if (!str) return '';
  return str.replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m] || m));
};

const generateReminderHtml = (userName: string) => {
  const safeName = escapeHtml(userName);
  return `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f4f4f5" style="background-color: #f4f4f5;">
    <tr><td align="center" style="padding: 20px;">
      <table width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
        <tr><td bgcolor="#002D72" style="background: linear-gradient(135deg, #002D72 0%, #FF5910 100%); padding: 30px; text-align: center;">
          <img src="https://rdmrxeplasttewtlfetc.supabase.co/storage/v1/object/public/email-assets/logo-192.png" alt="MetsXMFanZone" style="width: 85px; height: auto; margin-bottom: 8px; border-radius: 12px;" />
          <h1 style="color: #ffffff; margin: 0; font-size: 24px;">MetsXMFanZone</h1>
        </td></tr>
        <tr><td style="padding: 30px;">
          <h2 style="color: #002D72; margin-top: 0;">⚠️ Action Required, ${safeName}!</h2>
          <p style="color: #374151; font-size: 16px; line-height: 1.6;">Your <strong>Free (Spring Training)</strong> plan is ending soon. All free accounts will be deactivated on <strong>March 26, 2026</strong>.</p>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#FEF2F2" style="background-color: #FEF2F2; border-left: 4px solid #DC2626; border-radius: 0 8px 8px 0; margin: 20px 0;">
            <tr><td style="padding: 15px;">
              <p style="margin: 0; color: #991B1B; font-weight: 600; font-size: 15px;">You have until March 25th to upgrade your account.</p>
              <p style="margin: 8px 0 0; color: #991B1B; font-size: 14px;">After March 26th, free accounts will lose access to all live streaming features.</p>
            </td></tr>
          </table>
          <p style="color: #374151; font-size: 16px; line-height: 1.6;">Upgrade now to keep access to:</p>
          <ul style="color: #374151; font-size: 15px; line-height: 1.8;">
            <li>All live streams &amp; podcasts</li>
            <li>Full game replays &amp; highlights</li>
            <li>Exclusive Mets content</li>
            <li>Ad-free experience</li>
            <li>HD streaming on all devices</li>
          </ul>
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://www.metsxmfanzone.com/plans" style="display: inline-block; background-color: #FF5910; color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 700; font-size: 18px;">Upgrade Now — Starting at $9.99/mo</a>
          </div>
          <p style="color: #6B7280; font-size: 13px; text-align: center;">Don't miss out — upgrade today and never lose access!</p>
        </td></tr>
        <tr><td bgcolor="#f9fafb" style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="color: #9CA3AF; font-size: 12px; margin: 0;">&copy; 2026 MetsXMFanZone. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createServiceClient();

    // Get all free plan active subscriptions
    const { data: freeSubs, error: subError } = await supabase
      .from("subscriptions")
      .select("id, user_id, plan_type, status")
      .eq("plan_type", "free")
      .eq("status", "active");

    if (subError) throw subError;

    let sent = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const sub of freeSubs || []) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("id", sub.user_id)
        .single();

      if (!profile?.email) {
        skipped++;
        continue;
      }

      try {
        await queueTransactionalEmail(supabase, {
          to: profile.email,
          subject: "⚠️ Your Free Plan Expires March 26 — Upgrade Now!",
          html: generateReminderHtml(profile.full_name || "Fan"),
          label: "free_expiry_reminder",
          idempotencyKey: `free-expiry-reminder:${sub.id}:2026-03-22`,
        });
        sent++;
      } catch (e: any) {
        errors.push(`Failed for [REDACTED]: ${e.message}`);
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent, skipped, total: (freeSubs || []).length, errors }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Free expiry reminder error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
