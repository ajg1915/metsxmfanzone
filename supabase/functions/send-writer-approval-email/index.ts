import { createClient } from "npm:@supabase/supabase-js@2";

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

const loadSavedEmojis = async (): Promise<Record<string, string>> => {
  const defaults: Record<string, string> = { writer_approval: '🎉', writer_revoked: '📝' };
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
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
    const { Resend } = await import("https://esm.sh/resend@4.0.0");
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    
    const { email, name, status, adminNotes }: WriterApprovalEmailRequest = await req.json();

    console.log(`Sending writer ${status} email to ${email}`);

    const emojis = await loadSavedEmojis();

    let subject: string;
    let htmlContent: string;

    if (status === "approved") {
      subject = `${emojis.writer_approval} Your Writer Application Has Been Approved!`;
      htmlContent = `
        <!DOCTYPE html>
        <html xmlns="http://www.w3.org/1999/xhtml">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta name="color-scheme" content="light dark">
          <meta name="supported-color-schemes" content="light dark">
        </head>
        <body style="margin: 0; padding: 0;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f4f4f5" style="background-color: #f4f4f5; margin: 0; padding: 0;">
            <tr>
              <td align="center" style="padding: 20px;">
                <table width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 10px; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333;">
                  <tr>
                    <td bgcolor="#002D72" style="background: linear-gradient(135deg, #002D72 0%, #FF5910 100%); padding: 30px; text-align: center;">
            <img src="https://clwghkbtkofacsjeyrtk.supabase.co/storage/v1/object/public/email-assets/logo-192.png" alt="MetsXMFanZone" style="width: 85px; height: auto; margin-bottom: 8px; border-radius: 12px;" />
            <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to the Writer Team!</h1>
                    </td>
                  </tr>
                  <tr>
                    <td bgcolor="#f9f9f9" style="background-color: #f9f9f9; padding: 30px; border: 1px solid #e0e0e0; border-top: none;">
            <p style="font-size: 18px;">Hi ${name},</p>
            <p>Great news! Your application to become a writer at MetsXMFanZone has been <strong style="color: #22c55e;">approved</strong>!</p>
            ${adminNotes ? `<p style="background: #e0f2fe; padding: 15px; border-radius: 8px; border-left: 4px solid #0284c7;"><strong>Note from Admin:</strong> ${adminNotes}</p>` : ''}
            <p>You can now log in to the Writer Portal and start creating amazing content for our community.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://www.metsxmfanzone.com/writer-auth" style="background-color: #FF5910; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Access Writer Portal</a>
            </div>
            <p>We're excited to have you on board!</p>
            <p style="margin-top: 30px;">Best regards,<br><strong>MetsXMFanZone Team</strong></p>
                    </td>
                  </tr>
                  <tr>
                    <td style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
                      <p>&copy; ${new Date().getFullYear()} MetsXMFanZone. All rights reserved.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;
    } else {
      subject = "Update on Your Writer Application";
      htmlContent = `
        <!DOCTYPE html>
        <html xmlns="http://www.w3.org/1999/xhtml">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta name="color-scheme" content="light dark">
          <meta name="supported-color-schemes" content="light dark">
        </head>
        <body style="margin: 0; padding: 0;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f4f4f5" style="background-color: #f4f4f5; margin: 0; padding: 0;">
            <tr>
              <td align="center" style="padding: 20px;">
                <table width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 10px; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333;">
                  <tr>
                    <td bgcolor="#002D72" style="background-color: #002D72; padding: 30px; text-align: center;">
            <img src="https://clwghkbtkofacsjeyrtk.supabase.co/storage/v1/object/public/email-assets/logo-192.png" alt="MetsXMFanZone" style="width: 85px; height: auto; margin-bottom: 8px; border-radius: 12px;" />
            <h1 style="color: white; margin: 0; font-size: 28px;">Application Update</h1>
                    </td>
                  </tr>
                  <tr>
                    <td bgcolor="#f9f9f9" style="background-color: #f9f9f9; padding: 30px; border: 1px solid #e0e0e0; border-top: none;">
            <p style="font-size: 18px;">Hi ${name},</p>
            <p>Thank you for your interest in becoming a writer at MetsXMFanZone.</p>
            <p>After careful review, we've decided not to move forward with your application at this time.</p>
            ${adminNotes ? `<p style="background: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b;"><strong>Feedback:</strong> ${adminNotes}</p>` : ''}
            <p>This doesn't mean you can't apply again in the future.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://www.metsxmfanzone.com" style="background-color: #002D72; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Visit MetsXMFanZone</a>
            </div>
            <p style="margin-top: 30px;">Best regards,<br><strong>MetsXMFanZone Team</strong></p>
                    </td>
                  </tr>
                  <tr>
                    <td style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
                      <p>&copy; ${new Date().getFullYear()} MetsXMFanZone. All rights reserved.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;
    }

    const emailResponse = await resend.emails.send({
      from: "MetsXMFanZone <noreply@notify.www.metsxmfanzone.com>",
      to: [email],
      subject,
      html: htmlContent,
    });

    console.log("Writer approval email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-writer-approval-email function:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});