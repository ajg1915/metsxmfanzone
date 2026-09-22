import { createServiceClient, queueTransactionalEmail } from '../_shared/queue-email.ts'
import { renderBrandedEmailFor, escapeHtml } from '../_shared/email-brand.ts'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WriterApprovalEmailRequest {
  email: string;
  name: string;
  status: "approved" | "rejected";
  adminNotes?: string;
}

const loadSavedEmojis = async (supabase: any): Promise<Record<string, string>> => {
  const defaults: Record<string, string> = { writer_approval: '🎉', writer_revoked: '📝' };
  try {
    const { data } = await supabase
      .from('site_settings')
      .select('setting_value')
      .eq('setting_key', 'email_emojis')
      .maybeSingle();
    if (data?.setting_value && typeof data.setting_value === 'object') {
      return { ...defaults, ...(data.setting_value as Record<string, string>) };
    }
  } catch (err) {
    console.error('Failed to load emoji settings:', err);
  }
  return defaults;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createServiceClient();
    const { email, name, status, adminNotes }: WriterApprovalEmailRequest = await req.json();

    const emojis = await loadSavedEmojis(supabase);
    const safeName = escapeHtml(name);
    const safeNotes = adminNotes ? escapeHtml(adminNotes) : '';

    let subject: string;
    let htmlContent: string;

    if (status === "approved") {
      subject = `${emojis.writer_approval} Your Writer Application Has Been Approved!`;
      htmlContent = await renderBrandedEmailFor(supabase, {
        preheader: "Your writer application has been approved!",
        heading: "Welcome to the Writer Team!",
        content: `
          <p style="margin:0 0 16px;">Hi ${safeName},</p>
          <p style="margin:0 0 16px;">Great news! Your application to become a writer at MetsXMFanZone has been <strong style="color:#22c55e;">approved</strong>!</p>
          ${safeNotes ? `<p style="background:#0f2942;padding:15px;border-radius:8px;border-left:4px solid #0284c7;margin:0 0 16px;"><strong>Note from Admin:</strong> ${safeNotes}</p>` : ''}
          <p style="margin:0 0 16px;">You can now log in to the Writer Portal and start creating amazing content for our community.</p>
          <p style="margin:0;">We're excited to have you on board!</p>`,
        cta: { label: "Access Writer Portal", url: "https://www.metsxmfanzone.com/writer-auth" },
      });
    } else {
      subject = "Update on Your Writer Application";
      htmlContent = await renderBrandedEmailFor(supabase, {
        preheader: "An update on your writer application.",
        heading: "Application Update",
        content: `
          <p style="margin:0 0 16px;">Hi ${safeName},</p>
          <p style="margin:0 0 16px;">Thank you for your interest in becoming a writer at MetsXMFanZone.</p>
          <p style="margin:0 0 16px;">After careful review, we've decided not to move forward with your application at this time.</p>
          ${safeNotes ? `<p style="background:#3a2f0f;padding:15px;border-radius:8px;border-left:4px solid #f59e0b;margin:0 0 16px;"><strong>Feedback:</strong> ${safeNotes}</p>` : ''}
          <p style="margin:0;">This doesn't mean you can't apply again in the future.</p>`,
        cta: { label: "Visit MetsXMFanZone", url: "https://www.metsxmfanzone.com" },
      });
    }

    const { messageId } = await queueTransactionalEmail(supabase, {
      to: email,
      subject,
      html: htmlContent,
      label: `writer_${status}`,
      idempotencyKey: `writer-${status}:${email.toLowerCase()}:${Date.now()}`,
    });

    return new Response(JSON.stringify({ success: true, messageId }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-writer-approval-email:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
