import { createServiceClient, queueTransactionalEmail } from '../_shared/queue-email.ts'
import { renderBrandedEmailFor, escapeHtml } from '../_shared/email-brand.ts'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WriterRevokedEmailRequest {
  email: string;
  name: string;
  articleTitle: string;
  reasons: string[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createServiceClient();
    const { email, name, articleTitle, reasons }: WriterRevokedEmailRequest = await req.json();

    // Load emojis
    let writerRevokedEmoji = '📝';
    try {
      const { data } = await supabase.from('site_settings').select('setting_value').eq('setting_key', 'email_emojis').maybeSingle();
      if (data?.setting_value && typeof data.setting_value === 'object') {
        const saved = data.setting_value as Record<string, string>;
        if (saved.writer_revoked) writerRevokedEmoji = saved.writer_revoked;
      }
    } catch {}

    const safeName = escapeHtml(name);
    const safeTitle = escapeHtml(articleTitle);
    const safeReasons = reasons.map(r => escapeHtml(r));

    const subject = `${writerRevokedEmoji} Important: Your Writer Access Has Been Revoked`;
    const htmlContent = await renderBrandedEmailFor(supabase, {
      preheader: "Your writer access has been revoked.",
      heading: "Writer Access Revoked",
      content: `
        <p style="margin:0 0 16px;">Dear ${safeName},</p>
        <p style="margin:0 0 16px;">We regret to inform you that your writer access at MetsXMFanZone has been <strong style="color:#dc2626;">revoked</strong>.</p>
        <div style="background:#3a1414;padding:20px;border-radius:8px;border-left:4px solid #dc2626;margin:0 0 16px;">
          <p style="margin:0 0 10px;"><strong>Article in question:</strong> "${safeTitle}"</p>
          <p style="margin:0;"><strong>Reason(s):</strong></p>
          <ul style="margin:10px 0 0;padding-left:20px;">
            ${safeReasons.map(reason => `<li>${reason}</li>`).join('')}
          </ul>
        </div>
        <div style="background:#3a2a14;padding:20px;border-radius:8px;border-left:4px solid #f97316;margin:0 0 16px;">
          <h3 style="margin:0 0 10px;color:#f97316;">Our Content Policy</h3>
          <p style="margin:0;">At MetsXMFanZone, we maintain strict standards for original, authentic content:</p>
          <ul style="margin:10px 0 0;padding-left:20px;">
            <li><strong>No AI-Generated Content:</strong> All articles must be written entirely by the author.</li>
            <li><strong>Original Work Only:</strong> Content must not be copied or plagiarized.</li>
            <li><strong>Proper Citations Required:</strong> Any quotes or statistics must include proper citations.</li>
          </ul>
        </div>
        <p style="margin:0 0 16px;">The article "${safeTitle}" has been removed from our platform.</p>
        <p style="margin:0;">If you believe this decision was made in error, you may contact our support team.</p>`,
      cta: { label: "Contact Support", url: "mailto:support@metsxmfanzone.com" },
    });

    const { messageId } = await queueTransactionalEmail(supabase, {
      to: email,
      subject,
      html: htmlContent,
      label: "writer_revoked",
      idempotencyKey: `writer-revoked:${email.toLowerCase()}:${Date.now()}`,
    });

    return new Response(JSON.stringify({ success: true, messageId }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-writer-revoked-email:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
