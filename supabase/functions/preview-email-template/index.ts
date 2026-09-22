// Renders the REAL branded HTML of each MetsXMFanZone email with sample data,
// so admins can see exactly how every email looks before it goes out.
// Admin-only. Never sends anything.

import { createServiceClient } from "../_shared/queue-email.ts";
import {
  DEFAULT_BRAND,
  escapeHtml,
  getEmailBrand,
  renderBrandedEmail,
  type EmailBrand,
} from "../_shared/email-brand.ts";
import { sanitizeHtml } from "../_shared/sanitize-html.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "X-Content-Type-Options": "nosniff",
};

const SAMPLE_LINK = "https://metsxmfanzone.com/confirm-account?token=sample-token";

type Fragment = {
  label: string;
  subject: string;
  preheader: string;
  heading: string;
  content: string;
  cta?: { label: string; url: string };
  note?: string;
};

const TEMPLATES: Record<string, Fragment> = {
  signup_confirmation: {
    label: "Signup confirmation",
    subject: "Confirm Your MetsXMFanZone Account",
    preheader: "Confirm your email to activate your MetsXMFanZone account.",
    heading: "Welcome, Mets Fan!",
    content: `
      <p style="margin:0 0 16px;text-align:center;">Please confirm your email address to activate your account.</p>
      <div style="background:#002D72;padding:14px 16px;border-radius:10px;margin:0 0 16px;">
        <p style="color:#ffffff;font-size:13px;margin:0 0 8px;font-weight:700;">After confirming you can:</p>
        <ul style="color:#d0d8e6;font-size:13px;margin:0;padding-left:18px;">
          <li style="margin-bottom:4px;">Choose a membership plan</li>
          <li style="margin-bottom:4px;">Watch live streams</li>
          <li>Connect with fellow Mets fans</li>
        </ul>
      </div>
      <p style="margin:0;text-align:center;font-size:12px;color:#8b93a1;">Or copy and paste this link:<br/>
        <a href="${SAMPLE_LINK}" style="color:#FF5910;word-break:break-all;font-size:11px;">${SAMPLE_LINK}</a>
      </p>`,
    cta: { label: "Confirm Email", url: SAMPLE_LINK },
    note: "This link expires in 24 hours.",
  },
  password_reset: {
    label: "Password reset",
    subject: "Reset your MetsXMFanZone password",
    preheader: "Reset your MetsXMFanZone password.",
    heading: "Reset your password",
    content: `
      <p style="margin:0 0 16px;text-align:center;">Tap the button below to choose a new password. This link expires in 1 hour.</p>
      <p style="margin:0;text-align:center;font-size:12px;color:#8b93a1;">Or copy this link:<br/>
        <a href="https://metsxmfanzone.com/auth?mode=reset" style="color:#FF5910;word-break:break-all;font-size:11px;">https://metsxmfanzone.com/auth?mode=reset</a>
      </p>`,
    cta: { label: "Reset Password", url: "https://metsxmfanzone.com/auth?mode=reset" },
    note: "If you did not request this, you can ignore this email.",
  },
  otp_code: {
    label: "Verification code",
    subject: "Your MetsXMFanZone Verification Code",
    preheader: "Your MetsXMFanZone verification code.",
    heading: "Your verification code",
    content: `
      <p style="margin:0 0 16px;text-align:center;">Use this code to continue signing in:</p>
      <p style="margin:0 0 16px;text-align:center;font-size:34px;letter-spacing:10px;font-weight:800;color:#ffffff;">123456</p>`,
    note: "This code expires in 10 minutes. Never share it with anyone.",
  },
  email_change: {
    label: "Email address change",
    subject: "Confirm your new MetsXMFanZone email",
    preheader: "Confirm your new MetsXMFanZone email address.",
    heading: "Confirm your new email",
    content: `
      <p style="margin:0 0 16px;text-align:center;">Confirm <strong style="color:#ffffff;">fan@example.com</strong> as the email address for your MetsXMFanZone account.</p>`,
    cta: { label: "Confirm Email", url: "https://metsxmfanzone.com/dashboard" },
    note: "If you did not request this change, you can ignore this email and your address stays the same.",
  },
  payment_confirmed: {
    label: "Payment confirmed",
    subject: "Payment Confirmed - Monthly Plan",
    preheader: "Your MetsXMFanZone membership is active.",
    heading: "Payment confirmed",
    content: `
      <p style="margin:0 0 16px;text-align:center;">Thanks, Mets Fan! Your <strong style="color:#ffffff;">Monthly</strong> membership is now active.</p>
      <div style="background:#002D72;padding:14px 16px;border-radius:10px;margin:0 0 16px;text-align:center;">
        <p style="color:#ffffff;font-size:13px;margin:0;">Amount paid: <strong>$9.99</strong></p>
      </div>`,
    cta: { label: "Go to Member Center", url: "https://metsxmfanzone.com/dashboard" },
  },
  subscription_expiry: {
    label: "Membership expiring",
    subject: "Your Monthly Plan Expires in 3 Days",
    preheader: "Your MetsXMFanZone membership is about to expire.",
    heading: "Your membership expires soon",
    content: `
      <p style="margin:0 0 16px;text-align:center;">Your <strong style="color:#ffffff;">Monthly</strong> plan expires in <strong style="color:#ffffff;">3 days</strong>. Renew now to keep your live streams and member access.</p>`,
    cta: { label: "Renew Membership", url: "https://metsxmfanzone.com/pricing" },
  },
  writer_approval: {
    label: "Writer approved",
    subject: "Your Writer Application is Approved!",
    preheader: "You are approved to write for MetsXMFanZone.",
    heading: "You're approved!",
    content: `
      <p style="margin:0 0 16px;text-align:center;">Congratulations, Mets Fan! You now have access to the MetsXMFanZone Writers Portal.</p>`,
    cta: { label: "Open Writers Portal", url: "https://metsxmfanzone.com/writer" },
  },
  maintenance: {
    label: "Maintenance / stream alert",
    subject: "Stream Health Report - MetsXMFanZone",
    preheader: "A MetsXMFanZone service notice.",
    heading: "Service notice",
    content: `
      <p style="margin:0 0 16px;text-align:center;">We are performing scheduled maintenance. Streams may be briefly unavailable.</p>`,
    cta: { label: "Check Status", url: "https://metsxmfanzone.com" },
  },
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return json({ error: "Unauthorized" }, 401);

    const supabase = createServiceClient();
    const { data: userData } = await supabase.auth.getUser(token);
    const user = userData?.user;
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!role) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const templateKey = typeof body?.template === "string" ? body.template : "signup_confirmation";

    // "custom" renders an admin-composed email inside the same branded shell,
    // so the preview is byte-for-byte what recipients receive.
    const customSubject = typeof body?.subject === "string" ? body.subject.trim() : "";
    const customHeading = typeof body?.heading === "string" ? body.heading.trim() : "";
    const fragment: Fragment = templateKey === "custom"
      ? {
        label: "Custom email",
        subject: customSubject || "(No subject)",
        preheader: customSubject || "MetsXMFanZone",
        heading: customHeading,
        content: sanitizeHtml(typeof body?.content === "string" ? body.content : ""),
      }
      : TEMPLATES[templateKey] ?? TEMPLATES.signup_confirmation;

    // Unsaved designer values can be previewed by passing them in.
    const overrides = (body?.brand ?? {}) as Partial<EmailBrand>;
    const saved = await getEmailBrand(supabase);
    const brand: EmailBrand = { ...DEFAULT_BRAND, ...saved };
    for (const key of Object.keys(DEFAULT_BRAND) as (keyof EmailBrand)[]) {
      const value = overrides[key];
      if (value !== undefined && value !== null && value !== "") {
        // deno-lint-ignore no-explicit-any
        (brand as any)[key] = key === "logo_width" ? Number(value) || DEFAULT_BRAND.logo_width : value;
      }
    }

    const html = renderBrandedEmail({
      preheader: fragment.preheader,
      heading: fragment.heading,
      content: fragment.content,
      cta: fragment.cta,
      note: fragment.note,
      brand,
    });

    return json({
      success: true,
      template: templateKey,
      label: fragment.label,
      subject: fragment.subject,
      from: "MetsXMFanZone <noreply@metsxmfanzone.com>",
      html,
      templates: Object.entries(TEMPLATES).map(([key, value]) => ({ key, label: value.label })),
    });
  } catch (error) {
    console.error(
      "preview-email-template: ERROR",
      error instanceof Error ? escapeHtml(error.message) : "unknown",
    );
    return json({ error: "Preview could not be rendered" }, 500);
  }
});
