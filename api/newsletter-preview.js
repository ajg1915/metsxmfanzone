// Preview the newsletter templates with sample content: /api/newsletter-preview?t=weekly|breaking|update|welcome
import { SAMPLES } from "./_lib/newsletter-templates.js";

export default function handler(req, res) {
  const t = String(req.query?.t || "weekly");
  const make = SAMPLES[t];
  res.setHeader("X-Robots-Tag", "noindex");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  if (!make) {
    const links = Object.keys(SAMPLES).map((k) => `<li><a href="?t=${k}">${k}</a></li>`).join("");
    return res.status(200).send(`<!doctype html><meta name="viewport" content="width=device-width"><body style="font-family:sans-serif;background:#06101c;color:#fff;padding:24px"><h1>Newsletter templates</h1><ul>${links}</ul>`);
  }
  return res.status(200).send(make().html.replace("{{{RESEND_UNSUBSCRIBE_URL}}}", "#"));
}
