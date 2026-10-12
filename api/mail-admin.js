// Admin-only newsletter actions, straight to Resend (no Supabase functions).
//   POST { action: "count" }
//   POST { action: "test", to, subject, content }
//   POST { action: "send", subject, content }
// The caller must be signed in as a site admin (their Supabase login token is checked).

import { renderEmail } from "./_lib/email-shell.js";

const SEGMENT_ID = "53422271-e367-4699-a322-b3e7d586f8a4";
const FROM = "MetsXMFanZone <noreply@metsxmfanzone.com>";
const REPLY_TO = "support@metsxmfanzone.com";
// Public project address and public (anon) key, the same ones the website itself uses.
// Hardcoded on purpose: the Vercel VITE_ variables point at an old project.
const SUPABASE_URL = "https://rdmrxeplasttewtlfetc.supabase.co";
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkbXJ4ZXBsYXN0dGV3dGxmZXRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NTIyNjAsImV4cCI6MjA3NzMyODI2MH0.P5msjdR8tgbx-rL2ifeSjqW1jvFzKtPNT4oapJIAkJA";
const ALLOWED_ORIGINS = ["https://metsxmfanzone.com", "https://www.metsxmfanzone.com"];

const resend = (path, init = {}) =>
  fetch(`https://api.resend.com${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.RESEND_CONTACTS_KEY}`, ...(init.headers || {}) },
  });

async function requireAdmin(req) {
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token || !ANON) return null;
  const u = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` } });
  if (!u.ok) return null;
  const user = await u.json();
  if (!user?.id) return null;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/user_roles?select=role&user_id=eq.${user.id}&role=eq.admin`, {
    headers: { apikey: ANON, Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return null;
  const rows = await r.json();
  return Array.isArray(rows) && rows.length ? user : null;
}

async function countSubscribers() {
  let total = 0;
  let after = "";
  for (let i = 0; i < 50; i++) {
    const res = await resend(`/contacts?segment_id=${SEGMENT_ID}&limit=100${after ? `&after=${after}` : ""}`);
    if (!res.ok) throw new Error(`Resend ${res.status}`);
    const body = await res.json();
    const rows = body.data || [];
    total += rows.filter((c) => !c.unsubscribed).length;
    if (!body.has_more || !rows.length) break;
    after = rows[rows.length - 1].id;
  }
  return total;
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const origin = req.headers.origin;
  if (origin && !ALLOWED_ORIGINS.includes(origin) && !/^http:\/\/localhost(:\d+)?$/.test(origin)) {
    return res.status(403).json({ error: "Origin not allowed" });
  }
  if (!process.env.RESEND_CONTACTS_KEY) return res.status(500).json({ error: "Email service is not configured" });

  try {
    const admin = await requireAdmin(req);
    if (!admin) return res.status(403).json({ error: "Admin access required" });

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const action = body.action;

    if (action === "count") return res.status(200).json({ count: await countSubscribers() });

    const subject = String(body.subject ?? "").trim().slice(0, 200);
    const content = String(body.content ?? "");
    if (!subject || !content.trim()) return res.status(400).json({ error: "Subject and content are required" });

    if (action === "test") {
      const to = String(body.to ?? "").trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return res.status(400).json({ error: "Enter a valid test email" });
      const html = renderEmail({
        preheader: subject,
        heading: subject,
        content,
        cta: { label: "Visit MetsXMFanZone", url: "https://metsxmfanzone.com" },
        note: "This is a test. Subscribers get an unsubscribe link here.",
      });
      const r = await resend("/emails", {
        method: "POST",
        body: JSON.stringify({ from: FROM, to: [to], subject: `[TEST] ${subject}`, html, reply_to: REPLY_TO }),
      });
      if (!r.ok) return res.status(502).json({ error: `Test failed: ${await r.text()}` });
      return res.status(200).json({ success: true });
    }

    if (action === "send") {
      const html = renderEmail({
        preheader: subject,
        heading: subject,
        content,
        cta: { label: "Visit MetsXMFanZone", url: "https://metsxmfanzone.com" },
        note: "You are getting this because you signed up for MetsXMFanZone news.",
        unsubscribe: true,
      });
      const created = await resend("/broadcasts", {
        method: "POST",
        body: JSON.stringify({ segment_id: SEGMENT_ID, from: FROM, reply_to: REPLY_TO, subject, name: subject, html }),
      });
      if (!created.ok) return res.status(502).json({ error: `Could not create broadcast: ${await created.text()}` });
      const { id } = await created.json();
      const sent = await resend(`/broadcasts/${id}/send`, { method: "POST", body: JSON.stringify({}) });
      if (!sent.ok) return res.status(502).json({ error: `Could not send broadcast: ${await sent.text()}` });
      return res.status(200).json({ success: true, id, count: await countSubscribers() });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (error) {
    console.error("mail-admin error:", error);
    return res.status(500).json({ error: "Something went wrong" });
  }
}
