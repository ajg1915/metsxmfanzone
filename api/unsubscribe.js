// One-click unsubscribe for emails sent one at a time (welcome emails). Broadcasts use Resend's own link.
import { validToken } from "./_lib/unsub.js";

const page = (msg) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unsubscribe | MetsXMFanZone</title></head><body style="margin:0;background:#06101c;color:#fff;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center;padding:24px"><div style="max-width:420px"><img src="/metsxmfanzone-logo.png" alt="MetsXMFanZone" width="96"><h1 style="font-size:24px">${msg}</h1><a href="/" style="color:#ff7a3d">Back to MetsXMFanZone</a></div></body></html>`;

export default async function handler(req, res) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("X-Robots-Tag", "noindex");
  const email = String(req.query?.e || "").trim().toLowerCase();
  if (!email || !validToken(email, req.query?.t)) return res.status(400).send(page("That unsubscribe link isn't valid."));
  const key = process.env.RESEND_CONTACTS_KEY;
  if (!key) return res.status(500).send(page("Something went wrong. Please try again later."));
  const r = await fetch(`https://api.resend.com/contacts/${encodeURIComponent(email)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ unsubscribed: true }),
  });
  if (!r.ok && r.status !== 404) return res.status(502).send(page("We couldn't unsubscribe you right now. Please try again."));
  return res.status(200).send(page("You're unsubscribed. Sorry to see you go!"));
}
