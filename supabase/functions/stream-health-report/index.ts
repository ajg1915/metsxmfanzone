import { createServiceClient, queueTransactionalEmail } from '../_shared/queue-email.ts'
import { renderBrandedEmailFor } from '../_shared/email-brand.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const allowedIssues = new Set(['buffering', 'audio', 'video', 'casting', 'access', 'connection', 'lag', 'other']);
const allowedSeverities = new Set(['low', 'medium', 'high']);

const clean = (value: unknown, max: number): string =>
  typeof value === 'string' ? value.trim().replace(/[\u0000-\u001F\u007F]/g, ' ').slice(0, max) : '';

async function classifyTicket(issueType: string, description: string, diagnostics: Record<string, unknown>) {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) return null;
  const response = await fetch('https://ai.gateway.lovable.dev/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Lovable-API-Key': apiKey,
      'X-Lovable-AIG-SDK': 'fetch',
    },
    body: JSON.stringify({
      model: 'openai/gpt-6-astra',
      stream: true,
      reasoning: { effort: 'low', summary: 'concise' },
      include: ['reasoning.encrypted_content'],
      input: `Return JSON only with required keys category, severity, summary, confidence. Category must be buffering, audio, video, casting, access, connection, or other. Severity must be low, medium, high, or critical. Confidence must be 0 to 1. Triage this live-stream viewer report:\n${JSON.stringify({ issueType, description, diagnostics })}`,
      text: {
        format: {
          type: 'json_schema',
          name: 'stream_ticket_triage',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              category: { type: 'string', enum: ['buffering', 'audio', 'video', 'casting', 'access', 'connection', 'other'] },
              severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
              summary: { type: 'string' },
              confidence: { type: 'number', minimum: 0, maximum: 1 },
            },
            required: ['category', 'severity', 'summary', 'confidence'],
          },
        },
      },
    }),
  });
  if (!response.ok || !response.body) return null;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let output = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;
      try {
        const event = JSON.parse(line.slice(6));
        if (event.type === 'response.output_text.delta' && typeof event.delta === 'string') output += event.delta;
      } catch { /* Ignore malformed event lines. */ }
    }
  }
  try {
    const result = JSON.parse(output);
    if (!result?.category || !result?.severity || !result?.summary) return null;
    return result as { category: string; severity: string; summary: string; confidence: number };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const stream_id = clean(body.stream_id, 64) || null;
    const issue_type = clean(body.issue_type, 32).toLowerCase();
    const severity = clean(body.severity, 16).toLowerCase();
    const description = clean(body.description, 1500);
    const session_id = clean(body.session_id, 100);
    const manual = body.manual === true;
    const contactEmail = clean(body.contact_email, 254);
    const pagePath = clean(body.page_path, 300);
    const streamTitle = clean(body.stream_title, 160);
    const diagnostics = body.diagnostics && typeof body.diagnostics === 'object' && !Array.isArray(body.diagnostics)
      ? body.diagnostics as Record<string, unknown>
      : {};
    if (!allowedIssues.has(issue_type) || !allowedSeverities.has(severity) || description.length < 5) {
      return new Response(JSON.stringify({ error: 'Invalid stream report' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userAgent = req.headers.get('user-agent') || 'Unknown';

    const supabase = createServiceClient();

    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count: recentSessionCount } = await supabase
      .from('stream_health_reports')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', session_id)
      .gte('created_at', tenMinutesAgo);
    if ((recentSessionCount || 0) >= 5) {
      return new Response(JSON.stringify({ error: 'Please wait before sending another report.' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '600' },
      });
    }

    let triage: Awaited<ReturnType<typeof classifyTicket>> = null;
    if (manual) {
      try { triage = await classifyTicket(issue_type, description, diagnostics); }
      catch (error) { console.error('Ticket triage unavailable:', error instanceof Error ? error.message : 'Unknown error'); }
    }
    const storedDescription = manual
      ? [
          '[Viewer ticket]',
          description,
          `AI: ${triage?.severity || severity} · ${triage?.category || issue_type} · ${triage?.summary || 'Awaiting manual review'}${triage ? ` · ${Math.round(triage.confidence * 100)}%` : ''}`,
          `Page: ${pagePath || 'unknown'} · Stream: ${streamTitle || 'unknown'}`,
          `Contact: ${contactEmail || 'not provided'}`,
          `Diagnostics: ${JSON.stringify(diagnostics).slice(0, 800)}`,
        ].join('\n')
      : description;
    const storedSeverity = triage?.severity === 'critical' ? 'high' : (triage?.severity || severity);

    const { data: report, error: reportError } = await supabase
      .from('stream_health_reports')
      .insert({ stream_id, issue_type: triage?.category || issue_type, severity: storedSeverity, description: storedDescription, user_agent: userAgent, session_id })
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

    const shouldSendAlert = !manual && (severity === 'high' || !!(count && count >= 2));

    if (manual) {
      try {
        const { data: admins } = await supabase.from('user_roles').select('user_id').eq('role', 'admin');
        const targetUsers = (admins || []).map((row: { user_id: string }) => row.user_id);
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}`, 'X-System-Call': 'true' },
          body: JSON.stringify({
            title: `Viewer stream issue: ${triage?.severity || severity}`,
            body: triage?.summary || description.slice(0, 140),
            icon: '/logo-192.png',
            url: '/admin/stream-issues',
            tag: `stream-ticket-${report.id}`,
            targetUsers,
          }),
        });
      } catch (pushError) {
        console.error('Admin ticket notification failed:', pushError instanceof Error ? pushError.message : 'Unknown error');
      }
    }

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
       JSON.stringify({ success: true, report_id: report.id, alert_sent: shouldSendAlert, triaged: !!triage }),
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

  const subject = `⚠️ MetsXMFanZone Stream Maintenance Notice`;
  const content = `
    <div style="text-align: center; margin-bottom: 16px;"><span style="font-size: 36px;">${maintenanceEmoji}</span></div>
    <div style="background: #0a0e1a; border: 1px solid rgba(255,69,0,0.3); border-radius: 12px; padding: 18px; margin: 16px 0;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="color: #9CA3AF; font-size: 11px; padding: 4px 0;">Issue Type</td><td style="color: #FF4500; font-size: 13px; padding: 4px 0; text-align: right; font-weight: 700;">${escapeHtml(issueLabel)}</td></tr>
        <tr><td style="color: #9CA3AF; font-size: 11px; padding: 4px 0;">Status</td><td style="color: #FBBF24; font-size: 13px; padding: 4px 0; text-align: right;">Under Investigation</td></tr>
      </table>
    </div>
    <p style="text-align: center;">${safeMessage}</p>`;

  const html = await renderBrandedEmailFor(supabase, {
    preheader: safeMessage,
    heading: "Stream Maintenance Notice",
    content,
    cta: { label: "Check Status", url: "https://metsxmfanzone.com" },
  });

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
