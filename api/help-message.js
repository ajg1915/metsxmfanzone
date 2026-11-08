// Help Center "Send us a message" form. Emails the visitor's message to the support inbox.
// The Resend key stays on the server. Replies go straight to the visitor.

const FROM = "MetsXMFanZone Help <noreply@metsxmfanzone.com>";
const SUPPORT_INBOX = "support@metsxmfanzone.com";
const ALLOWED_ORIGINS = ["https://metsxmfanzone.com", "https://www.metsxmfanzone.com"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Allow", "POST");
    return res.status(204).end();
  }
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method not allowed" });

  const origin = req.headers.origin;
  if (origin) {
    let host = "";
    try { host = new URL(origin).hostname; } catch { /* bad origin */ }
    if (!ALLOWED_ORIGINS.includes(origin) && !/^http:\/\/localhost(:\d+)?$/.test(origin) && !/\.vercel\.app$/.test(host)) {
      return res.status(403).json({ success: false, error: "Origin not allowed" });
    }
  }

  const apiKey = process.env.RESEND_API_KEY || process.env.RESEND_API_KEY_1;
  if (!apiKey) return res.status(500).json({ success: false, error: "Messaging is not available right now." });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    if (body.website) return res.status(200).json({ success: true }); // honeypot: bots fill this in

    const name = String(body.name ?? "").trim().slice(0, 100);
    const email = String(body.email ?? "").trim().toLowerCase();
    const message = String(body.message ?? "").trim();
    if (!EMAIL_RE.test(email) || email.length > 254) {
      return res.status(400).json({ success: false, error: "Please enter a valid email so we can reply." });
    }
    if (message.length < 5) return res.status(400).json({ success: false, error: "Please describe your issue." });
    if (message.length > 3000) return res.status(400).json({ success: false, error: "Message is too long (3000 characters max)." });

    const page = String(body.page ?? "").slice(0, 200);
    const html = `<p><strong>From:</strong> ${esc(name || "(no name)")} &lt;${esc(email)}&gt;</p>
<p><strong>Sent from:</strong> ${esc(page || "Help Center")}</p>
<hr><p style="white-space:pre-wrap">${esc(message)}</p>`;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        from: FROM,
        to: [SUPPORT_INBOX],
        reply_to: email,
        subject: `Help Center message from ${name || email}`.slice(0, 200),
        html,
        text: `From: ${name || "(no name)"} <${email}>\nSent from: ${page || "Help Center"}\n\n${message}`,
      }),
    });
    if (!response.ok) {
      console.error("help-message send failed", response.status);
      return res.status(502).json({ success: false, error: "Could not send right now. Please email support@metsxmfanzone.com." });
    }
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("help-message error", error instanceof Error ? error.message : "unknown");
    return res.status(500).json({ success: false, error: "Could not send right now. Please email support@metsxmfanzone.com." });
  }
}
