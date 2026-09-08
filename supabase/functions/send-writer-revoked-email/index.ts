import { createServiceClient, queueTransactionalEmail } from '../_shared/queue-email.ts'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const escapeHtml = (str: string): string => {
  if (!str) return '';
  return str.replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m] || m));
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
    const htmlContent = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #dc2626; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <img src="https://rdmrxeplasttewtlfetc.supabase.co/storage/v1/object/public/email-assets/logo-192.png" alt="MetsXMFanZone" style="width: 85px; height: auto; margin-bottom: 8px; border-radius: 12px;" />
    <h1 style="color: white; margin: 0; font-size: 28px;">Writer Access Revoked</h1>
  </div>
  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0; border-top: none;">
    <p style="font-size: 18px;">Dear ${safeName},</p>
    <p>We regret to inform you that your writer access at MetsXMFanZone has been <strong style="color: #dc2626;">revoked</strong>.</p>
    <div style="background: #fef2f2; padding: 20px; border-radius: 8px; border-left: 4px solid #dc2626; margin: 20px 0;">
      <p style="margin: 0 0 10px 0;"><strong>Article in question:</strong> "${safeTitle}"</p>
      <p style="margin: 0;"><strong>Reason(s):</strong></p>
      <ul style="margin: 10px 0 0 0; padding-left: 20px;">
        ${safeReasons.map(reason => `<li>${reason}</li>`).join('')}
      </ul>
    </div>
    <div style="background: #fff7ed; padding: 20px; border-radius: 8px; border-left: 4px solid #f97316; margin: 20px 0;">
      <h3 style="margin: 0 0 10px 0; color: #c2410c;">Our Content Policy</h3>
      <p style="margin: 0;">At MetsXMFanZone, we maintain strict standards for original, authentic content:</p>
      <ul style="margin: 10px 0 0 0; padding-left: 20px;">
        <li><strong>No AI-Generated Content:</strong> All articles must be written entirely by the author.</li>
        <li><strong>Original Work Only:</strong> Content must not be copied or plagiarized.</li>
        <li><strong>Proper Citations Required:</strong> Any quotes or statistics must include proper citations.</li>
      </ul>
    </div>
    <p>The article "${safeTitle}" has been removed from our platform.</p>
    <p>If you believe this decision was made in error, you may contact our support team.</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="mailto:support@metsxmfanzone.com" style="background: #002D72; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Contact Support</a>
    </div>
    <p style="margin-top: 30px;">Regards,<br><strong>MetsXMFanZone Editorial Team</strong></p>
  </div>
  <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
    <p>© ${new Date().getFullYear()} MetsXMFanZone. All rights reserved.</p>
  </div>
</body>
</html>`;

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
