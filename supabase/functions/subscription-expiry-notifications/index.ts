import { createServiceClient, queueTransactionalEmail } from '../_shared/queue-email.ts'

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

const generateExpiringEmailHtml = (userName: string, planName: string, daysLeft: number, endDate: string) => {
  const formattedDate = new Date(endDate).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
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
          <h2 style="color: #002D72; margin-top: 0;">Hi ${userName || "Fan"}!</h2>
          <p style="color: #374151; font-size: 16px; line-height: 1.6;">Your <strong>${planName}</strong> subscription is expiring ${daysLeft === 1 ? "tomorrow" : `in ${daysLeft} days`}.</p>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#FFF7ED" style="background-color: #FFF7ED; border-left: 4px solid #FF5910; border-radius: 0 8px 8px 0; margin: 20px 0;">
            <tr><td style="padding: 15px;"><p style="margin: 0; color: #9A3412; font-weight: 500;">Expiration Date: ${formattedDate}</p></td></tr>
          </table>
          <p style="color: #374151; font-size: 16px; line-height: 1.6;">Renew now to keep your access to:</p>
          <ul style="color: #374151; font-size: 15px; line-height: 1.8;">
            <li>Ad-free live streams &amp; podcasts</li>
            <li>Exclusive Mets content &amp; highlights</li>
            <li>Premium community features</li>
            <li>Early access to new features</li>
          </ul>
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://www.metsxmfanzone.com/plans" style="display: inline-block; background-color: #FF5910; color: #ffffff; text-decoration: none; padding: 14px 30px; border-radius: 8px; font-weight: 600; font-size: 16px;">Renew My Subscription</a>
          </div>
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

const generateExpiredEmailHtml = (userName: string, planName: string) => {
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
          <h2 style="color: #002D72; margin-top: 0;">Hi ${userName || "Fan"}!</h2>
          <p style="color: #374151; font-size: 16px; line-height: 1.6;">Your <strong>${planName}</strong> subscription has expired.</p>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#FEF2F2" style="background-color: #FEF2F2; border-left: 4px solid #DC2626; border-radius: 0 8px 8px 0; margin: 20px 0;">
            <tr><td style="padding: 15px;"><p style="margin: 0; color: #991B1B; font-weight: 500;">Your premium access has ended. You've been moved to the free plan.</p></td></tr>
          </table>
          <p style="color: #374151; font-size: 16px; line-height: 1.6;">We'll miss having you as a premium member!</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://www.metsxmfanzone.com/plans" style="display: inline-block; background-color: #FF5910; color: #ffffff; text-decoration: none; padding: 14px 30px; border-radius: 8px; font-weight: 600; font-size: 16px;">Reactivate My Subscription</a>
          </div>
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
          emailHtml = generateExpiredEmailHtml(profile.full_name || "", planName);
          await supabase.from("subscriptions").update({ status: "expired" }).eq("id", sub.id);
        } else if (endDate <= oneDayFromNow) {
          notificationType = "expiring_1_day";
          emailSubject = "⚠️ Your subscription expires tomorrow!";
          emailHtml = generateExpiringEmailHtml(profile.full_name || "", planName, 1, sub.end_date);
        } else if (endDate <= threeDaysFromNow) {
          notificationType = "expiring_3_days";
          emailSubject = "Your subscription expires in 3 days";
          emailHtml = generateExpiringEmailHtml(profile.full_name || "", planName, 3, sub.end_date);
        } else if (endDate <= sevenDaysFromNow) {
          notificationType = "expiring_7_days";
          emailSubject = "Your subscription expires in 7 days";
          emailHtml = generateExpiringEmailHtml(profile.full_name || "", planName, 7, sub.end_date);
        }
      } else if (sub.status === "expired" && endDate <= now) {
        notificationType = "expired";
        emailSubject = "Your MetsXMFanZone subscription has expired";
        emailHtml = generateExpiredEmailHtml(profile.full_name || "", planName);
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
