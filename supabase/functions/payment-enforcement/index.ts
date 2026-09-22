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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createServiceClient();
    const now = new Date();

    const { data: expiredSubs, error } = await supabase
      .from("subscriptions")
      .select("id, user_id, plan_type, status, end_date, payment_method, notes")
      .eq("status", "active")
      .not("plan_type", "eq", "free")
      .lt("end_date", now.toISOString());

    if (error) throw error;

    const results = { warnings_sent: 0, terminated: 0, errors: [] as string[] };

    for (const sub of expiredSubs || []) {
      const endDate = new Date(sub.end_date!);
      const daysPastExpiry = Math.floor((now.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24));

      const { data: profile } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("id", sub.user_id)
        .single();

      if (!profile?.email) continue;

      const existingNotes = sub.notes || "";
      const safeName = escapeHtml(profile.full_name || "Fan");
      const safePlan = escapeHtml(sub.plan_type);

      if (daysPastExpiry >= 7 && !existingNotes.includes("[TERMINATED]")) {
        await supabase
          .from("subscriptions")
          .update({
            status: "cancelled",
            notes: `${existingNotes} [TERMINATED] Auto-deactivated on ${now.toISOString()} after ${daysPastExpiry} days past expiry.`,
          })
          .eq("id", sub.id);

        await supabase.from("subscription_activity").insert({
          subscription_id: sub.id,
          user_id: sub.user_id,
          action: "auto_terminated",
          details: { days_past_expiry: daysPastExpiry, reason: "missed_payment" },
          performed_by: null,
        });

        try {
          const deactivatedHtml = await renderBrandedEmailFor(supabase, {
            preheader: "Your MetsXMFanZone membership has been deactivated.",
            heading: "Membership Deactivated",
            content: `
              <p>Hi ${safeName},</p>
              <p>Your <strong>${safePlan}</strong> membership has been deactivated due to missed payment. Your subscription expired on <strong>${endDate.toLocaleDateString()}</strong>.</p>
              <p>To reactivate your account, please visit our plans page and subscribe again.</p>`,
            cta: { label: "Reactivate Now", url: "https://www.metsxmfanzone.com/plans" },
            note: "If you believe this is an error, please contact us.",
          });
          await queueTransactionalEmail(supabase, {
            to: profile.email,
            subject: "Your MetsXMFanZone Membership Has Been Deactivated",
            html: deactivatedHtml,
            label: "payment_terminated",
            idempotencyKey: `payment-terminated:${sub.id}`,
          });
        } catch (e: any) {
          results.errors.push(`Email failed for [REDACTED]: ${e.message}`);
        }
        results.terminated++;
      } else if (daysPastExpiry >= 3 && daysPastExpiry < 7 && !existingNotes.includes("[WARNING_SENT]")) {
        await supabase
          .from("subscriptions")
          .update({ notes: `${existingNotes} [WARNING_SENT] Warning sent on ${now.toISOString()}.` })
          .eq("id", sub.id);

        await supabase.from("subscription_activity").insert({
          subscription_id: sub.id,
          user_id: sub.user_id,
          action: "payment_warning_sent",
          details: { days_past_expiry: daysPastExpiry },
          performed_by: null,
        });

        try {
          const warningHtml = await renderBrandedEmailFor(supabase, {
            preheader: "Your MetsXMFanZone payment is overdue.",
            heading: "Payment Overdue",
            content: `
              <p>Hi ${safeName},</p>
              <p>Your <strong>${safePlan}</strong> membership payment is overdue. Your subscription expired on <strong>${endDate.toLocaleDateString()}</strong>.</p>
              <p style="color:#ff8080;font-weight:bold">If payment is not received within 4 days, your account will be automatically deactivated.</p>`,
            cta: { label: "Update Payment", url: "https://www.metsxmfanzone.com/plans" },
            note: "If you've already made a payment, please disregard this email.",
          });
          await queueTransactionalEmail(supabase, {
            to: profile.email,
            subject: "⚠️ Action Required: Your MetsXMFanZone Payment is Overdue",
            html: warningHtml,
            label: "payment_warning",
            idempotencyKey: `payment-warning:${sub.id}`,
          });
        } catch (e: any) {
          results.errors.push(`Warning email failed for [REDACTED]: ${e.message}`);
        }
        results.warnings_sent++;
      }
    }

    return new Response(JSON.stringify({ success: true, ...results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Payment enforcement error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
