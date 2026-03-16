import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { stream_id, issue_type, severity, description, session_id } = await req.json();
    const userAgent = req.headers.get('user-agent') || 'Unknown';

    console.log('Received stream health report:', { stream_id, issue_type, severity, description });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Insert the health report
    const { data: report, error: reportError } = await supabase
      .from('stream_health_reports')
      .insert({
        stream_id,
        issue_type,
        severity,
        description,
        user_agent: userAgent,
        session_id
      })
      .select()
      .single();

    if (reportError) {
      console.error('Error inserting report:', reportError);
      throw reportError;
    }

    console.log('Health report created:', report.id);

    // Auto-send alert based on severity and issue frequency
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from('stream_health_reports')
      .select('*', { count: 'exact', head: true })
      .eq('stream_id', stream_id)
      .eq('issue_type', issue_type)
      .gte('created_at', fiveMinutesAgo);

    console.log(`Similar issues in last 5 minutes: ${count}, Severity: ${severity}`);

    // Auto-send alert: immediately for high severity, or 2+ reports for medium/low
    const shouldSendAlert = severity === 'high' || (count && count >= 2);

    if (shouldSendAlert) {
      // Check if there's already an active alert for this stream and issue type
      const { data: existingAlert } = await supabase
        .from('stream_alerts')
        .select('*')
        .eq('stream_id', stream_id)
        .eq('is_active', true)
        .single();

      if (!existingAlert) {
        const alertMessage = getAlertMessage(issue_type, severity);
        
        console.log(`Auto-sending alert for stream ${stream_id}: ${alertMessage}`);

        const { error: alertError } = await supabase
          .from('stream_alerts')
          .insert({
            stream_id,
            message: alertMessage,
            is_active: true
          });

        if (alertError) {
          console.error('Error creating auto-alert:', alertError);
        } else {
          console.log('Auto-alert sent to viewers for stream:', stream_id);
        }

        // Send push notifications to ALL users (admins + regular users)
        try {
          const pushUrl = `${supabaseUrl}/functions/v1/send-push-notification`;
          const pushResponse = await fetch(pushUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseKey}`,
              'X-System-Call': 'true',
            },
            body: JSON.stringify({
              title: `⚠️ Stream Issue: ${issue_type.charAt(0).toUpperCase() + issue_type.slice(1)}`,
              body: alertMessage,
              icon: '/logo-192.png',
              url: '/',
              tag: `stream-alert-${stream_id}`,
            }),
          });
          const pushResult = await pushResponse.json();
          console.log('Push notifications sent:', pushResult);
        } catch (pushErr) {
          console.error('Error sending push notifications:', pushErr);
        }

        // Send maintenance emails for medium and high severity issues
        try {
          await sendMaintenanceEmails(supabase, issue_type, alertMessage);
        } catch (emailErr) {
          console.error('Error sending maintenance emails:', emailErr);
        }
      } else {
        console.log('Active alert already exists for stream:', stream_id);
      }
    }

    // Auto-resolve alert when stream stabilizes (no issues for 3 minutes)
    const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000).toISOString();
    const { count: recentIssueCount } = await supabase
      .from('stream_health_reports')
      .select('*', { count: 'exact', head: true })
      .eq('stream_id', stream_id)
      .gte('created_at', threeMinutesAgo);

    if (recentIssueCount === 0) {
      // Deactivate any active alerts for this stream
      await supabase
        .from('stream_alerts')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('stream_id', stream_id)
        .eq('is_active', true);
      
      console.log('Stream stabilized, auto-deactivated alerts for:', stream_id);
    }

    return new Response(
      JSON.stringify({ success: true, report_id: report.id, alert_sent: shouldSendAlert }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in stream-health-report function:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function getAlertMessage(issueType: string, severity: string): string {
  const severityPrefix = severity === 'high' ? '⚠️ ' : '';
  
  switch (issueType) {
    case 'buffering':
      return `${severityPrefix}We're aware of buffering issues and are actively working to resolve them. Thank you for your patience.`;
    case 'audio':
      return `${severityPrefix}We're experiencing audio issues and our team is working on a fix. We apologize for the inconvenience.`;
    case 'video':
      return `${severityPrefix}We're aware of video quality issues and are actively working to restore normal service.`;
    case 'connection':
      return `${severityPrefix}Some viewers are experiencing connection issues. Our team is investigating and working on a fix.`;
    case 'lag':
      return `${severityPrefix}We're aware of lag issues affecting the stream. We're working to improve performance.`;
    default:
      return `${severityPrefix}We're experiencing technical difficulties. Our team is aware and working on a fix. We apologize for any inconvenience.`;
  }
}

const escapeHtml = (str: string): string => {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
};

async function sendMaintenanceEmails(supabase: any, issueType: string, alertMessage: string) {
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  if (!resendApiKey) {
    console.log('RESEND_API_KEY not configured, skipping maintenance emails');
    return;
  }

  // Get all members with email
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('email, full_name')
    .not('email', 'is', null);

  if (profilesError || !profiles?.length) {
    console.error('Error fetching profiles for maintenance email:', profilesError);
    return;
  }

  const logoUrl = 'https://clwghkbtkofacsjeyrtk.supabase.co/storage/v1/object/public/email-assets/logo-192.png';
  const safeMessage = escapeHtml(alertMessage);
  const issueLabel = issueType.charAt(0).toUpperCase() + issueType.slice(1);

  // Load saved emojis from site_settings
  let maintenanceEmoji = '🔧';
  try {
    const { data: emojiData } = await supabase
      .from('site_settings')
      .select('setting_value')
      .eq('setting_key', 'email_emojis')
      .maybeSingle();
    if (emojiData?.setting_value && typeof emojiData.setting_value === 'object') {
      const saved = emojiData.setting_value as Record<string, string>;
      if (saved.maintenance) maintenanceEmoji = saved.maintenance;
    }
  } catch (err) {
    console.error('Failed to load emoji settings:', err);
  }

  const subject = `⚠️ MetsXMFanZone Stream Maintenance Notice`;
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Stream Maintenance Notice</title>
</head>
<body style="margin: 0; padding: 0; background-color: #002D72; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <div style="max-width: 420px; margin: 0 auto; padding: 20px 12px;">
    
    <!-- Header: Logo Only -->
    <div style="text-align: center; padding: 24px 0 16px 0;">
      <img src="${logoUrl}" alt="MetsXMFanZone" width="85" style="width: 85px; height: auto; display: block; margin: 0 auto 8px auto; border-radius: 12px;" />
      <span style="color: #FF4500; font-size: 18px; font-weight: 800; letter-spacing: -0.5px;">MetsXMFanZone</span>
    </div>

    <!-- Main Card -->
    <div style="background: linear-gradient(180deg, #141a2e 0%, #0d1222 100%); border: 1px solid rgba(255,69,0,0.25); border-radius: 16px; padding: 28px 20px; margin-bottom: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.4);">
      
      <div style="text-align: center; margin-bottom: 16px;">
        <div style="font-size: 36px; margin-bottom: 12px;">${maintenanceEmoji}</div>
        <h1 style="color: white; font-size: 20px; font-weight: 800; margin: 0 0 8px 0; line-height: 1.3;">Stream Maintenance Notice</h1>
      </div>

      <div style="background: #0a0e1a; border: 1px solid rgba(255,69,0,0.3); border-radius: 12px; padding: 18px; margin: 16px 0;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="color: #9CA3AF; font-size: 11px; padding: 4px 0; text-transform: uppercase; letter-spacing: 1px;">Issue Type</td>
            <td style="color: #FF4500; font-size: 13px; padding: 4px 0; text-align: right; font-weight: 700;">${escapeHtml(issueLabel)}</td>
          </tr>
          <tr>
            <td style="color: #9CA3AF; font-size: 11px; padding: 4px 0; text-transform: uppercase; letter-spacing: 1px;">Status</td>
            <td style="color: #FBBF24; font-size: 13px; padding: 4px 0; text-align: right; font-weight: 600;">Under Investigation</td>
          </tr>
        </table>
      </div>

      <p style="color: #D1D5DB; font-size: 14px; line-height: 1.6; text-align: center; margin: 0 0 16px 0;">${safeMessage}</p>
      
      <p style="color: #9CA3AF; font-size: 12px; line-height: 1.5; text-align: center; margin: 0;">
        Our team is working to restore service as quickly as possible. We'll notify you when the stream is back online.
      </p>

      <div style="text-align: center; margin-top: 24px;">
        <a href="https://metsxmfanzone.com" style="display: inline-block; background: linear-gradient(135deg, #FF4500 0%, #FF6B35 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 700; font-size: 14px; letter-spacing: 0.3px; box-shadow: 0 4px 14px rgba(255,69,0,0.4);">
          Check Status
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align: center; padding: 16px 0; border-top: 1px solid rgba(255,255,255,0.08);">
      <div style="margin-bottom: 12px;">
        <a href="https://facebook.com/metsxmfanzone" style="color: #9CA3AF; text-decoration: none; margin: 0 6px; font-size: 11px;">Facebook</a>
        <span style="color: #374151;">•</span>
        <a href="https://twitter.com/metsxmfanzone" style="color: #9CA3AF; text-decoration: none; margin: 0 6px; font-size: 11px;">Twitter</a>
        <span style="color: #374151;">•</span>
        <a href="https://instagram.com/metsxmfanzone" style="color: #9CA3AF; text-decoration: none; margin: 0 6px; font-size: 11px;">Instagram</a>
        <span style="color: #374151;">•</span>
        <a href="https://youtube.com/@metsxmfanzone" style="color: #9CA3AF; text-decoration: none; margin: 0 6px; font-size: 11px;">YouTube</a>
      </div>
      <p style="color: #6B7280; font-size: 10px; margin: 0 0 6px 0;">
        You're receiving this as a registered MetsXMFanZone member.
      </p>
      <p style="color: #4B5563; font-size: 10px; margin: 0;">
        &copy; ${new Date().getFullYear()} MetsXMFanZone. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>`;

  let sent = 0;
  let failed = 0;

  for (const profile of profiles) {
    if (!profile.email) continue;
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${resendApiKey}` },
        body: JSON.stringify({
          from: 'MetsXMFanZone <noreply@notify.www.metsxmfanzone.com>',
          to: [profile.email],
          subject,
          html,
        }),
      });
      if (response.ok) sent++; else failed++;
    } catch {
      failed++;
    }
  }

  console.log(`Maintenance emails sent: ${sent} successful, ${failed} failed`);
}