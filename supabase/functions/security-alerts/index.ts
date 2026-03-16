import { createClient } from "npm:@supabase/supabase-js@2";
const Resend = (await import("https://esm.sh/resend@4.0.0")).Resend;

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

// Alert thresholds
const BULK_EXPORT_THRESHOLD = 50; // Alert if more than 50 records exported
const FAILED_LOGIN_THRESHOLD = 5; // Alert after 5 failed attempts
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// In-memory rate limiting (per instance)
const failedLoginAttempts = new Map<string, { count: number; firstAttempt: number }>();

const handler = async (req: Request): Promise<Response> => {
  console.log("Security alerts function invoked");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { alertType, details }: SecurityAlertRequest = await req.json();
    console.log(`Processing security alert: ${alertType}`, details);

    // Get admin emails for alerts
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    const adminEmails: string[] = [];
    if (adminRoles && adminRoles.length > 0) {
      for (const role of adminRoles) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("email")
          .eq("id", role.user_id)
          .single();
        
        if (profile?.email) {
          adminEmails.push(profile.email);
        }
      }
    }

    // Determine if alert should be sent
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
          alertMessage = `
            <h2 style="color: #dc2626;">Bulk Data Export Alert</h2>
            <p><strong>Severity:</strong> ${severity.toUpperCase()}</p>
            <p><strong>Time:</strong> ${new Date().toISOString()}</p>
            <p><strong>Admin Email:</strong> ${details.email || "Unknown"}</p>
            <p><strong>Data Type:</strong> ${details.dataType || "Unknown"}</p>
            <p><strong>Records Exported:</strong> ${details.recordCount}</p>
            <p><strong>IP Address:</strong> ${details.ipAddress || "Unknown"}</p>
            <p><strong>User Agent:</strong> ${details.userAgent || "Unknown"}</p>
            <hr>
            <p style="color: #666;">This alert was triggered because a large number of records were accessed. Please verify this activity is authorized.</p>
          `;
        }
        break;

      case "failed_login_attempts":
        const key = details.email || details.ipAddress || "unknown";
        const now = Date.now();
        const attempts = failedLoginAttempts.get(key);
        
        if (attempts) {
          if (now - attempts.firstAttempt < RATE_LIMIT_WINDOW_MS) {
            attempts.count++;
          } else {
            // Reset window
            failedLoginAttempts.set(key, { count: 1, firstAttempt: now });
          }
        } else {
          failedLoginAttempts.set(key, { count: 1, firstAttempt: now });
        }

        const currentAttempts = failedLoginAttempts.get(key)!;
        
        if (currentAttempts.count >= FAILED_LOGIN_THRESHOLD) {
          shouldAlert = true;
          severity = currentAttempts.count >= 10 ? "critical" : "high";
          alertSubject = `🔐 Multiple Failed Login Attempts - ${currentAttempts.count} attempts`;
          alertMessage = `
            <h2 style="color: #dc2626;">Failed Login Attempts Alert</h2>
            <p><strong>Severity:</strong> ${severity.toUpperCase()}</p>
            <p><strong>Time:</strong> ${new Date().toISOString()}</p>
            <p><strong>Email Attempted:</strong> ${details.email || "Unknown"}</p>
            <p><strong>Attempt Count:</strong> ${currentAttempts.count} attempts in ${Math.round((now - currentAttempts.firstAttempt) / 60000)} minutes</p>
            <p><strong>IP Address:</strong> ${details.ipAddress || "Unknown"}</p>
            <p><strong>User Agent:</strong> ${details.userAgent || "Unknown"}</p>
            <hr>
            <p style="color: #666;">This could indicate a brute force attack or unauthorized access attempt. Consider blocking this IP if suspicious activity continues.</p>
          `;
          
          // Reset after alerting
          failedLoginAttempts.delete(key);
        }
        break;

      case "suspicious_admin_activity":
        shouldAlert = true;
        severity = "high";
        alertSubject = `⚠️ Suspicious Admin Activity Detected`;
        alertMessage = `
          <h2 style="color: #f59e0b;">Suspicious Admin Activity</h2>
          <p><strong>Severity:</strong> ${severity.toUpperCase()}</p>
          <p><strong>Time:</strong> ${new Date().toISOString()}</p>
          <p><strong>Admin:</strong> ${details.email || "Unknown"}</p>
          <p><strong>Action:</strong> ${details.action || "Unknown"}</p>
          <p><strong>Details:</strong> ${details.additionalInfo || "No additional details"}</p>
          <p><strong>IP Address:</strong> ${details.ipAddress || "Unknown"}</p>
          <hr>
          <p style="color: #666;">Please review this activity and verify it was authorized.</p>
        `;
        break;

      case "unusual_access_pattern":
        shouldAlert = true;
        severity = "medium";
        alertSubject = `📊 Unusual Access Pattern Detected`;
        alertMessage = `
          <h2 style="color: #3b82f6;">Unusual Access Pattern</h2>
          <p><strong>Severity:</strong> ${severity.toUpperCase()}</p>
          <p><strong>Time:</strong> ${new Date().toISOString()}</p>
          <p><strong>User:</strong> ${details.email || "Unknown"}</p>
          <p><strong>Pattern:</strong> ${details.additionalInfo || "Unusual activity detected"}</p>
          <p><strong>IP Address:</strong> ${details.ipAddress || "Unknown"}</p>
        `;
        break;

      case "rate_limit_exceeded":
        shouldAlert = true;
        severity = "medium";
        alertSubject = `🚦 Rate Limit Exceeded`;
        alertMessage = `
          <h2 style="color: #f59e0b;">Rate Limit Alert</h2>
          <p><strong>Time:</strong> ${new Date().toISOString()}</p>
          <p><strong>User/IP:</strong> ${details.email || details.ipAddress || "Unknown"}</p>
          <p><strong>Action:</strong> ${details.action || "Unknown"}</p>
        `;
        break;
    }

    // Log the security event to activity_logs
    await supabase.from("activity_logs").insert({
      user_id: details.userId || null,
      action: `security_alert_${alertType}`,
      log_type: "security",
      resource_type: "security_alert",
      details: {
        alert_type: alertType,
        severity,
        should_alert: shouldAlert,
        ...details,
      },
      ip_address: details.ipAddress || null,
      user_agent: details.userAgent || null,
    });

    // Send email alerts to admins
    if (shouldAlert && resendApiKey && adminEmails.length > 0) {
      const resend = new Resend(resendApiKey);
      
      for (const adminEmail of adminEmails) {
        try {
          await resend.emails.send({
            from: "MetsXMFanZone <noreply@notify.www.metsxmfanzone.com>",
            to: [adminEmail],
            subject: alertSubject,
            html: `
              <!DOCTYPE html>
              <html>
              <head>
                <style>
                  body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                  .header { background: linear-gradient(135deg, #1e3a5f, #002d62); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
                  .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
                  .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #666; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <h1 style="margin: 0;">🛡️ MetsXM Security Alert</h1>
                  </div>
                  <div class="content">
                    ${alertMessage}
                  </div>
                  <div class="footer">
                    <p>This is an automated security alert from MetsXM Fan Zone.</p>
                    <p>View your <a href="https://metsxmfanzone.com/admin/activity">Activity Dashboard</a> for more details.</p>
                  </div>
                </div>
              </body>
              </html>
            `,
          });
          console.log(`Security alert email sent to ${adminEmail}`);
        } catch (emailError) {
          console.error(`Failed to send alert to ${adminEmail}:`, emailError);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        alerted: shouldAlert,
        severity,
        alertType,
      }),
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
