import { createServiceClient, queueTransactionalEmail } from '../_shared/queue-email.ts'

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

    const supabase = createServiceClient();

    const { data: report, error: reportError } = await supabase
      .from('stream_health_reports')
      .insert({ stream_id, issue_type, severity, description, user_agent: userAgent, session_id })
      .select()
      .single();

    if (reportError) throw reportError;

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from('stream_health_reports')
      .select('*', { count: 'exact', head: true })
      .eq('stream_id', stream_id)
      .eq('issue_type', issue_type)
      .gte('created_at', fiveMinutesAgo);

    const shouldSendAlert = severity === 'high' || (count && count >= 2);

    if (shouldSendAlert) {
      const { data: existingAlert } = await supabase
        .from('stream_alerts')
        .select('*')
        .eq('stream_id', stream_id)
        .eq('is_active', true)
        .single();

      if (!existingAlert) {
        const alertMessage = getAlertMessage(issue_type, severity);

        await supabase.from('stream_alerts').insert({ stream_id, message: alertMessage, is_active: true });

        // Push notifications
        try {
          const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
          const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
          const pushUrl = `${supabaseUrl}/functions/v1/send-push-notification`;
          await fetch(pushUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}`, 'X-System-Call': 'true' },
            body: JSON.stringify({
              title: `⚠️ Stream Issue: ${issue_type.charAt(0).toUpperCase() + issue_type.slice(1)}`,
              body: alertMessage, icon: '/logo-192.png', url: '/', tag: `stream-alert-${stream_id}`,
            }),
          });
        } catch (pushErr) {
          console.error('Error sending push notifications:', pushErr);
        }

        // Send maintenance emails via queue
        try {
          await sendMaintenanceEmails(supabase, issue_type, alertMessage);
        } catch (emailErr) {
          console.error('Error sending maintenance emails:', emailErr);
        }
      }
    }

    // Auto-resolve
    const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000).toISOString();
    const { count: recentIssueCount } = await supabase
      .from('stream_health_reports')
      .select('*', { count: 'exact', head: true })
      .eq('stream_id', stream_id)
      .gte('created_at', threeMinutesAgo);

    if (recentIssueCount === 0) {
      await supabase
        .from('stream_alerts')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('stream_id', stream_id)
        .eq('is_active', true);
    }

    return new Response(
      JSON.stringify({ success: true, report_id: report.id, alert_sent: shouldSendAlert }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in stream-health-report:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function getAlertMessage(issueType: string, severity: string): string {
  const severityPrefix = severity === 'high' ? '⚠️ ' : '';
  switch (issueType) {
    case 'buffering': return `${severityPrefix}We're aware of buffering issues and are actively working to resolve them.`;
    case 'audio': return `${severityPrefix}We're experiencing audio issues and our team is working on a fix.`;
    case 'video': return `${severityPrefix}We're aware of video quality issues and are actively working to restore normal service.`;
    case 'connection': return `${severityPrefix}Some viewers are experiencing connection issues. Our team is investigating.`;
    case 'lag': return `${severityPrefix}We're aware of lag issues affecting the stream. We're working to improve performance.`;
    default: return `${severityPrefix}We're experiencing technical difficulties. Our team is working on a fix.`;
  }
}

const escapeHtml = (str: string): string => {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
};

async function sendMaintenanceEmails(supabase: any, issueType: string, alertMessage: string) {
  const { data: profiles } = await supabase.from('profiles').select('email').not('email', 'is', null);
  if (!profiles?.length) return;

  let maintenanceEmoji = '🔧';
  try {
    const { data: emojiData } = await supabase.from('site_settings').select('setting_value').eq('setting_key', 'email_emojis').maybeSingle();
    if (emojiData?.setting_value?.maintenance) maintenanceEmoji = emojiData.setting_value.maintenance;
  } catch {}

  const issueLabel = issueType.charAt(0).toUpperCase() + issueType.slice(1);
  const safeMessage = escapeHtml(alertMessage);
  const logoUrl = 'https://rdmrxeplasttewtlfetc.supabase.co/storage/v1/object/public/email-assets/logo-192.png';

  const subject = `⚠️ MetsXMFanZone Stream Maintenance Notice`;
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #002D72; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 420px; margin: 0 auto; padding: 20px 12px;">
    <div style="text-align: center; padding: 24px 0 16px 0;">
      <img src="${logoUrl}" alt="MetsXMFanZone" width="85" style="width: 85px; height: auto; border-radius: 12px;" />
    </div>
    <div style="background: linear-gradient(180deg, #141a2e 0%, #0d1222 100%); border: 1px solid rgba(255,69,0,0.25); border-radius: 16px; padding: 28px 20px;">
      <div style="text-align: center; margin-bottom: 16px;"><span style="font-size: 36px;">${maintenanceEmoji}</span></div>
      <h1 style="color: white; font-size: 20px; text-align: center; margin: 0 0 12px;">Stream Maintenance Notice</h1>
      <div style="background: #0a0e1a; border: 1px solid rgba(255,69,0,0.3); border-radius: 12px; padding: 18px; margin: 16px 0;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="color: #9CA3AF; font-size: 11px; padding: 4px 0;">Issue Type</td><td style="color: #FF4500; font-size: 13px; padding: 4px 0; text-align: right; font-weight: 700;">${escapeHtml(issueLabel)}</td></tr>
          <tr><td style="color: #9CA3AF; font-size: 11px; padding: 4px 0;">Status</td><td style="color: #FBBF24; font-size: 13px; padding: 4px 0; text-align: right;">Under Investigation</td></tr>
        </table>
      </div>
      <p style="color: #D1D5DB; font-size: 14px; text-align: center;">${safeMessage}</p>
      <div style="text-align: center; margin-top: 24px;">
        <a href="https://metsxmfanzone.com" style="display: inline-block; background: #FF4500; color: white; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 700; font-size: 14px;">Check Status</a>
      </div>
    </div>
    <p style="color: #6B7280; font-size: 10px; text-align: center; margin-top: 15px;">&copy; ${new Date().getFullYear()} MetsXMFanZone</p>
  </div>
</body></html>`;

  let sent = 0;
  for (const profile of profiles) {
    if (!profile.email) continue;
    try {
      await queueTransactionalEmail(supabase, {
        to: profile.email,
        subject,
        html,
        label: "stream_maintenance",
        idempotencyKey: `stream-maintenance:${profile.email.toLowerCase()}:${Date.now()}`,
      });
      sent++;
    } catch { /* skip */ }
  }
  console.log(`Stream maintenance emails queued: ${sent}`);
}
