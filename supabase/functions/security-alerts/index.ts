import { createServiceClient, queueTransactionalEmail } from '../_shared/queue-email.ts'
import { renderBrandedEmailFor } from '../_shared/email-brand.ts'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SecurityAlertRequest {
  alertType: 
    | "bulk_data_export" 
    | "failed_login_attempts" 
    | "suspicious_admin_activity"
    | "unusual_access_pattern"
    | "rate_limit_exceeded";
  details: {
    userId?: string;
    email?: string;
    ipAddress?: string;
    userAgent?: string;
    dataType?: string;
    recordCount?: number;
    attemptCount?: number;
    timeWindow?: string;
    action?: string;
    additionalInfo?: string;
  };
}

const BULK_EXPORT_THRESHOLD = 50;
const FAILED_LOGIN_THRESHOLD = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

const failedLoginAttempts = new Map<string, { count: number; firstAttempt: number }>();

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createServiceClient();
    const { alertType, details }: SecurityAlertRequest = await req.json();

    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    const adminEmails: string[] = [];
    if (adminRoles && adminRoles.length > 0) {
      for (const role of adminRoles) {
        const { data: profile } = await supabase.from("profiles").select("email").eq("id", role.user_id).single();
        if (profile?.email) adminEmails.push(profile.email);
      }
    }

    let shouldAlert = false;
    let alertSubject = "";
    let alertMessage = "";
    let severity: "low" | "medium" | "high" | "critical" = "medium";

    switch (alertType) {
      case "bulk_data_export":
        if (details.recordCount && details.recordCount >= BULK_EXPORT_THRESHOLD) {
          shouldAlert = true;
          severity = details.recordCount >= 200 ? "critical" : "high";
          alertSubject = `🚨 Bulk Data Export Detected - ${details.recordCount} records`;
          alertMessage = `<h2 style="color:#dc2626;">Bulk Data Export Alert</h2><p><strong>Severity:</strong> ${severity.toUpperCase()}</p><p><strong>Time:</strong> ${new Date().toISOString()}</p><p><strong>Data Type:</strong> ${details.dataType || "Unknown"}</p><p><strong>Records:</strong> ${details.recordCount}</p>`;
        }
        break;
      case "failed_login_attempts": {
        const key = details.email || details.ipAddress || "unknown";
        const now = Date.now();
        const attempts = failedLoginAttempts.get(key);
        if (attempts) {
          if (now - attempts.firstAttempt < RATE_LIMIT_WINDOW_MS) attempts.count++;
          else failedLoginAttempts.set(key, { count: 1, firstAttempt: now });
        } else {
          failedLoginAttempts.set(key, { count: 1, firstAttempt: now });
        }
        const currentAttempts = failedLoginAttempts.get(key)!;
        if (currentAttempts.count >= FAILED_LOGIN_THRESHOLD) {
          shouldAlert = true;
          severity = currentAttempts.count >= 10 ? "critical" : "high";
          alertSubject = `🔐 Multiple Failed Login Attempts - ${currentAttempts.count} attempts`;
          alertMessage = `<h2 style="color:#dc2626;">Failed Login Attempts</h2><p><strong>Attempts:</strong> ${currentAttempts.count}</p><p><strong>IP:</strong> ${details.ipAddress || "Unknown"}</p>`;
          failedLoginAttempts.delete(key);
        }
        break;
      }
      case "suspicious_admin_activity":
        shouldAlert = true;
        severity = "high";
        alertSubject = `⚠️ Suspicious Admin Activity Detected`;
        alertMessage = `<h2 style="color:#f59e0b;">Suspicious Admin Activity</h2><p><strong>Action:</strong> ${details.action || "Unknown"}</p><p><strong>Details:</strong> ${details.additionalInfo || "None"}</p>`;
        break;
      case "unusual_access_pattern":
        shouldAlert = true;
        severity = "medium";
        alertSubject = `📊 Unusual Access Pattern Detected`;
        alertMessage = `<h2 style="color:#3b82f6;">Unusual Access Pattern</h2><p>${details.additionalInfo || "Unusual activity detected"}</p>`;
        break;
      case "rate_limit_exceeded":
        shouldAlert = true;
        severity = "medium";
        alertSubject = `🚦 Rate Limit Exceeded`;
        alertMessage = `<h2 style="color:#f59e0b;">Rate Limit Alert</h2><p><strong>Action:</strong> ${details.action || "Unknown"}</p>`;
        break;
    }

    await supabase.from("activity_logs").insert({
      user_id: details.userId || null,
      action: `security_alert_${alertType}`,
      log_type: "security",
      resource_type: "security_alert",
      details: { alert_type: alertType, severity, should_alert: shouldAlert, ...details },
      ip_address: details.ipAddress || null,
      user_agent: details.userAgent || null,
    });

    if (shouldAlert && adminEmails.length > 0) {
      const fullHtml = await renderBrandedEmailFor(supabase, {
        preheader: alertSubject,
        heading: "🛡️ MetsXM Security Alert",
        content: alertMessage,
        cta: { label: "View Activity Dashboard", url: "https://metsxmfanzone.com/admin/activity" },
      });

      for (const adminEmail of adminEmails) {
        try {
          await queueTransactionalEmail(supabase, {
            to: adminEmail,
            subject: alertSubject,
            html: fullHtml,
            label: `security_alert_${alertType}`,
            idempotencyKey: `security-alert:${alertType}:${adminEmail.toLowerCase()}:${Date.now()}`,
          });
        } catch (emailError) {
          console.error(`Failed to queue alert for ${adminEmail}:`, emailError);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, alerted: shouldAlert, severity, alertType }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Security alerts error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

Deno.serve(handler);
