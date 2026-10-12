// Newsletter signup. Adds the visitor to the "MetsXMFanZone Newsletter" list in Resend.
// The Resend key stays on the server.

const SEGMENT_ID = "53422271-e367-4699-a322-b3e7d586f8a4";
const ALLOWED_ORIGINS = ["https://metsxmfanzone.com", "https://www.metsxmfanzone.com"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Allow", "POST");
    return res.status(204).end();
  }
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method not allowed" });

  const origin = req.headers.origin;
  if (origin && !ALLOWED_ORIGINS.includes(origin) && !/^http:\/\/localhost(:\d+)?$/.test(origin) && !/\.vercel\.app$/.test(new URL(origin).hostname)) {
    return res.status(403).json({ success: false, error: "Origin not allowed" });
  }

  const apiKey = process.env.RESEND_CONTACTS_KEY;
  if (!apiKey) return res.status(500).json({ success: false, error: "Email service is not configured" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const email = String(body.email ?? "").trim().toLowerCase();
    const name = String(body.name ?? "").trim().slice(0, 100);
    if (!EMAIL_RE.test(email) || email.length > 254) {
      return res.status(400).json({ success: false, error: "Please enter a valid email." });
    }

    const headers = { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` };
    const created = await fetch("https://api.resend.com/contacts", {
      method: "POST",
      headers,
      body: JSON.stringify({ email, first_name: name || undefined, unsubscribed: false, segments: [{ id: SEGMENT_ID }] }),
    });
    if (created.ok) return res.status(200).json({ success: true });

    // Already a contact: make sure they are on the newsletter list.
    const added = await fetch(
      `https://api.resend.com/contacts/${encodeURIComponent(email)}/segments/${SEGMENT_ID}`,
      { method: "POST", headers },
    );
    if (added.ok) return res.status(200).json({ success: true });

    console.error("Resend signup failed:", created.status, await created.text());
    return res.status(502).json({ success: false, error: "Could not subscribe right now." });
  } catch (error) {
    console.error("join-fan-list error:", error);
    return res.status(500).json({ success: false, error: "Could not subscribe right now." });
  }
}
