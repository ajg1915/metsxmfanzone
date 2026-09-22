import { createServiceClient, queueTransactionalEmail } from '../_shared/queue-email.ts'
import { renderBrandedEmailFor } from '../_shared/email-brand.ts'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const escapeHtml = (str: string) => {
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
    const { userId, planType, amount, source } = await req.json();

    if (!userId || !planType) {
      return new Response(
        JSON.stringify({ error: "userId and planType are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: memberProfile } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", userId)
      .single();

    const memberName = escapeHtml(memberProfile?.full_name || "Unknown");
    const memberEmail = escapeHtml(memberProfile?.email || "No email");
    const safePlanType = escapeHtml(planType);
    const safeAmount = escapeHtml(amount || (planType === "annual" ? "$99.99" : "$9.99"));
    const safeSource = escapeHtml(source || "Online Payment");

    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    if (!adminRoles || adminRoles.length === 0) {
      return new Response(
        JSON.stringify({ message: "No admins to notify" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminIds = adminRoles.map((r) => r.user_id);
    const { data: adminProfiles } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .in("id", adminIds);

    const adminEmails = (adminProfiles || []).filter((p) => p.email).map((p) => p.email!);

    if (adminEmails.length === 0) {
      return new Response(
        JSON.stringify({ message: "No admin emails" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const dashboardUrl = "https://metsxmfanzone.com/admin/subscriptions";
    const now = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });

    const emailContent = `
      <div style="background: linear-gradient(135deg, #002D72, #FF4500); border-radius: 8px; padding: 16px; margin-bottom: 16px; text-align: center;">
        <p style="color: white; font-size: 24px; margin: 0;">🏟️</p>
        <p style="color: white; font-size: 16px; font-weight: bold; margin: 8px 0 0 0;">New Fan Joined!</p>
      </div>
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 8px 0; color: #9CA3AF; font-size: 13px; border-bottom: 1px solid rgba(255,255,255,0.1);">Member</td><td style="padding: 8px 0; color: #F9FAFB; font-size: 13px; font-weight: 600; text-align: right; border-bottom: 1px solid rgba(255,255,255,0.1);">${memberName}</td></tr>
        <tr><td style="padding: 8px 0; color: #9CA3AF; font-size: 13px; border-bottom: 1px solid rgba(255,255,255,0.1);">Email</td><td style="padding: 8px 0; color: #F9FAFB; font-size: 13px; text-align: right; border-bottom: 1px solid rgba(255,255,255,0.1);">${memberEmail}</td></tr>
        <tr><td style="padding: 8px 0; color: #9CA3AF; font-size: 13px; border-bottom: 1px solid rgba(255,255,255,0.1);">Plan</td><td style="padding: 8px 0; color: #FF4500; font-size: 13px; font-weight: bold; text-align: right; border-bottom: 1px solid rgba(255,255,255,0.1);">${safePlanType.toUpperCase()}</td></tr>
        <tr><td style="padding: 8px 0; color: #9CA3AF; font-size: 13px; border-bottom: 1px solid rgba(255,255,255,0.1);">Amount</td><td style="padding: 8px 0; color: #10B981; font-size: 13px; font-weight: bold; text-align: right; border-bottom: 1px solid rgba(255,255,255,0.1);">${safeAmount}</td></tr>
        <tr><td style="padding: 8px 0; color: #9CA3AF; font-size: 13px; border-bottom: 1px solid rgba(255,255,255,0.1);">Source</td><td style="padding: 8px 0; color: #F9FAFB; font-size: 13px; text-align: right; border-bottom: 1px solid rgba(255,255,255,0.1);">${safeSource}</td></tr>
        <tr><td style="padding: 8px 0; color: #9CA3AF; font-size: 13px;">Date</td><td style="padding: 8px 0; color: #F9FAFB; font-size: 13px; text-align: right;">${now} ET</td></tr>
      </table>`;

    const emailHtml = await renderBrandedEmailFor(supabase, {
      preheader: "A new fan just joined MetsXMFanZone!",
      heading: "🎉 New Member Alert!",
      content: emailContent,
      cta: { label: "View in Admin Dashboard", url: dashboardUrl },
    });

    const subject = `🎉 New ${safePlanType} Member: ${memberName} — MetsXMFanZone`;

    let sent = 0;
    for (const email of adminEmails) {
      try {
        await queueTransactionalEmail(supabase, {
          to: email,
          subject,
          html: emailHtml,
          label: "admin_new_member",
          idempotencyKey: `admin-new-member:${userId}:${email.toLowerCase()}`,
        });
        sent++;
      } catch (err: any) {
        console.error(`Failed to queue admin notification for ${email}:`, err.message);
      }
    }

    // Also send push notification to admins
    try {
      const { data: adminSubs } = await supabase
        .from("notification_subscriptions")
        .select("*")
        .in("user_id", adminIds);

      if (adminSubs && adminSubs.length > 0) {
        await supabase.functions.invoke("send-push-notification", {
          body: {
            title: `🎉 New ${safePlanType} Member!`,
            body: `${memberName} just signed up for ${safePlanType}. ${safeAmount}`,
            url: "/admin/subscriptions",
            icon: "/logo-192.png",
            tag: "new-member-notification",
            targetUsers: adminIds,
          },
        });
      }
    } catch (pushErr) {
      console.error("Push notification to admins failed:", pushErr);
    }

    return new Response(
      JSON.stringify({ success: true, notified: sent }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in notify-admin-new-member:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
