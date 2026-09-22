import { createServiceClient, queueTransactionalEmail } from '../_shared/queue-email.ts'
import { renderBrandedEmailFor, escapeHtml } from '../_shared/email-brand.ts'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const getPlanName = (planType: string) => {
  switch (planType) {
    case "premium": return "Premium Monthly";
    case "annual": return "Annual Premium";
    default: return "Free";
  }
};

const generateExpiringEmailHtml = async (supabase: any, userName: string, planName: string, daysLeft: number, endDate: string) => {
  const formattedDate = new Date(endDate).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const safeName = escapeHtml(userName || "Fan");
  const safePlan = escapeHtml(planName);
  const safeDate = escapeHtml(formattedDate);
  const daysText = daysLeft === 1 ? "tomorrow" : `in ${daysLeft} days`;

  return await renderBrandedEmailFor(supabase, {
    preheader: `Your ${planName} subscription is expiring ${daysText}.`,
    heading: `Hi ${safeName}!`,
    content: `
      <p style="margin:0 0 16px;">Your <strong>${safePlan}</strong> subscription is expiring ${daysText}.</p>
      <div style="background:#3a2200;border-left:4px solid #FF5910;border-radius:0 8px 8px 0;padding:15px;margin:0 0 16px;">
        <p style="margin:0;color:#FFD9B3;font-weight:600;">Expiration Date: ${safeDate}</p>
      </div>
      <p style="margin:0 0 8px;">Renew now to keep your access to:</p>
      <ul style="margin:0;padding-left:18px;">
        <li>Ad-free live streams &amp; podcasts</li>
        <li>Exclusive Mets content &amp; highlights</li>
        <li>Premium community features</li>
        <li>Early access to new features</li>
      </ul>`,
    cta: { label: "Renew My Subscription", url: "https://www.metsxmfanzone.com/plans" },
  });
};

const generateExpiredEmailHtml = async (supabase: any, userName: string, planName: string) => {
  const safeName = escapeHtml(userName || "Fan");
  const safePlan = escapeHtml(planName);

  return await renderBrandedEmailFor(supabase, {
    preheader: `Your ${planName} subscription has expired.`,
    heading: `Hi ${safeName}!`,
    content: `
      <p style="margin:0 0 16px;">Your <strong>${safePlan}</strong> subscription has expired.</p>
      <div style="background:#3a1414;border-left:4px solid #DC2626;border-radius:0 8px 8px 0;padding:15px;margin:0 0 16px;">
        <p style="margin:0;color:#FCA5A5;font-weight:500;">Your premium access has ended. You've been moved to the free plan.</p>
      </div>
      <p style="margin:0;">We'll miss having you as a premium member!</p>`,
    cta: { label: "Reactivate My Subscription", url: "https://www.metsxmfanzone.com/plans" },
  });
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createServiceClient();
    const now = new Date();
    const oneDayFromNow = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const { data: subscriptions, error: subError } = await supabase
      .from("subscriptions")
      .select("id, user_id, plan_type, status, end_date")
      .in("plan_type", ["premium", "annual"])
      .not("end_date", "is", null);

    if (subError) throw subError;

    const results = { expiring7Days: 0, expiring3Days: 0, expiring1Day: 0, expired: 0, errors: 0 };

    for (const sub of subscriptions || []) {
      const endDate = new Date(sub.end_date);

      const { data: profile } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("id", sub.user_id)
        .single();

      if (!profile?.email) continue;

      const planName = getPlanName(sub.plan_type);
      let notificationType: string | null = null;
      let emailSubject = "";
      let emailHtml = "";

      if (sub.status === "active") {
        if (endDate <= now) {
          notificationType = "expired";
          emailSubject = "Your MetsXMFanZone subscription has expired";
          emailHtml = await generateExpiredEmailHtml(supabase, profile.full_name || "", planName);
          await supabase.from("subscriptions").update({ status: "expired" }).eq("id", sub.id);
        } else if (endDate <= oneDayFromNow) {
          notificationType = "expiring_1_day";
          emailSubject = "⚠️ Your subscription expires tomorrow!";
          emailHtml = await generateExpiringEmailHtml(supabase, profile.full_name || "", planName, 1, sub.end_date);
        } else if (endDate <= threeDaysFromNow) {
          notificationType = "expiring_3_days";
          emailSubject = "Your subscription expires in 3 days";
          emailHtml = await generateExpiringEmailHtml(supabase, profile.full_name || "", planName, 3, sub.end_date);
        } else if (endDate <= sevenDaysFromNow) {
          notificationType = "expiring_7_days";
          emailSubject = "Your subscription expires in 7 days";
          emailHtml = await generateExpiringEmailHtml(supabase, profile.full_name || "", planName, 7, sub.end_date);
        }
      } else if (sub.status === "expired" && endDate <= now) {
        notificationType = "expired";
        emailSubject = "Your MetsXMFanZone subscription has expired";
        emailHtml = await generateExpiredEmailHtml(supabase, profile.full_name || "", planName);
      }

      if (!notificationType) continue;

      const { data: existingNotification } = await supabase
        .from("subscription_notifications")
        .select("id")
        .eq("subscription_id", sub.id)
        .eq("notification_type", notificationType)
        .single();

      if (existingNotification) continue;

      try {
        await queueTransactionalEmail(supabase, {
          to: profile.email,
          subject: emailSubject,
          html: emailHtml,
          label: `sub_expiry_${notificationType}`,
          idempotencyKey: `sub-expiry:${sub.id}:${notificationType}`,
        });

        await supabase.from("subscription_notifications").insert({
          subscription_id: sub.id,
          user_id: sub.user_id,
          notification_type: notificationType,
          email_sent_to: profile.email,
        });

        await supabase.from("subscription_activity").insert({
          subscription_id: sub.id,
          user_id: sub.user_id,
          action: `email_sent_${notificationType}`,
          details: { email: profile.email, subject: emailSubject },
        });

        switch (notificationType) {
          case "expiring_7_days": results.expiring7Days++; break;
          case "expiring_3_days": results.expiring3Days++; break;
          case "expiring_1_day": results.expiring1Day++; break;
          case "expired": results.expired++; break;
        }
      } catch (emailError) {
        console.error(`Failed to queue email for ${profile.email}:`, emailError);
        results.errors++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: "Subscription expiry notifications processed", results }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in subscription-expiry-notifications:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
