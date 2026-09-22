import { createServiceClient, queueTransactionalEmail } from '../_shared/queue-email.ts'
import { renderBrandedEmailFor } from '../_shared/email-brand.ts'

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

const generateReminderHtml = async (supabase: any, userName: string) => {
  const safeName = escapeHtml(userName);
  return await renderBrandedEmailFor(supabase, {
    preheader: "Your Free (Spring Training) plan ends March 26 — upgrade now to keep access.",
    heading: `⚠️ Action Required, ${safeName}!`,
    content: `
      <p style="margin:0 0 16px;">Your <strong>Free (Spring Training)</strong> plan is ending soon. All free accounts will be deactivated on <strong>March 26, 2026</strong>.</p>
      <div style="background:#3a1414;border-left:4px solid #DC2626;border-radius:0 8px 8px 0;padding:15px;margin:0 0 16px;">
        <p style="margin:0 0 8px;color:#FCA5A5;font-weight:600;">You have until March 25th to upgrade your account.</p>
        <p style="margin:0;color:#FCA5A5;font-size:14px;">After March 26th, free accounts will lose access to all live streaming features.</p>
      </div>
      <p style="margin:0 0 8px;">Upgrade now to keep access to:</p>
      <ul style="margin:0 0 16px;padding-left:18px;">
        <li>All live streams &amp; podcasts</li>
        <li>Full game replays &amp; highlights</li>
        <li>Exclusive Mets content</li>
        <li>Ad-free experience</li>
        <li>HD streaming on all devices</li>
      </ul>
      <p style="margin:0;text-align:center;font-size:13px;color:#8b93a1;">Don't miss out — upgrade today and never lose access!</p>`,
    cta: { label: "Upgrade Now — Starting at $9.99/mo", url: "https://www.metsxmfanzone.com/plans" },
  });
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
          html: await generateReminderHtml(supabase, profile.full_name || "Fan"),
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
