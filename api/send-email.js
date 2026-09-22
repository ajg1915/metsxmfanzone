// Backup email sender. Used when the Supabase edge email functions are unavailable.
// Sends through Resend with the same MetsXMFanZone sender identity.

const FROM = "MetsXMFanZone <noreply@metsxmfanzone.com>";
const REPLY_TO = "support@metsxmfanzone.com";

const ALLOWED_ORIGINS = [
  "https://metsxmfanzone.com",
  "https://www.metsxmfanzone.com",
  "https://metsxmfanzone.lovable.app",
];

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Allow", "POST");
    return res.status(204).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const origin = req.headers.origin;
  if (origin && !ALLOWED_ORIGINS.includes(origin) && !/^http:\/\/localhost(:\d+)?$/.test(origin)) {
    return res.status(403).json({ success: false, error: "Origin not allowed" });
  }

  const apiKey = process.env.RESEND_API_KEY || process.env.RESEND_API_KEY_1;
  if (!apiKey) {
    return res.status(500).json({ success: false, error: "Email service is not configured" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const { to, subject, html, text } = body;

    const recipients = (Array.isArray(to) ? to : [to])
      .filter((value) => typeof value === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.trim()))
      .map((value) => value.trim().toLowerCase())
      .slice(0, 50);

    if (!recipients.length || typeof subject !== "string" || !subject.trim() || (!html && !text)) {
      return res.status(400).json({ success: false, error: "to, subject and html are required" });
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: FROM,
        to: recipients,
        subject: subject.slice(0, 200),
        html: html || undefined,
        text: text || undefined,
        reply_to: REPLY_TO,
        headers: {
          "List-Unsubscribe": "<https://metsxmfanzone.com/unsubscribe>",
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("Backup send-email failed", { status: response.status });
      return res.status(response.status).json({
        success: false,
        error: data?.message || data?.error?.message || "Email could not be sent",
      });
    }

    return res.status(200).json({ success: true, id: data.id, sent: recipients.length });
  } catch (error) {
    console.error("Backup send-email error", error instanceof Error ? error.message : "unknown");
    return res.status(500).json({ success: false, error: "Email could not be sent" });
  }
}
