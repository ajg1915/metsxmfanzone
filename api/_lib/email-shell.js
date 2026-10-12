// MetsXMFanZone email look: one shell used by every email (newsletter, welcome, alerts).
// Small logo on top, navy card, orange accents. No Supabase needed.

const SITE = "https://metsxmfanzone.com";
const LOGO = `${SITE}/metsxmfanzone-logo.png`;

export const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/**
 * @param {{preheader?:string, heading?:string, content:string, cta?:{label:string,url:string}, note?:string, unsubscribe?:boolean}} o
 * content is an HTML fragment you trust. Everything else is escaped for you.
 */
export function renderEmail({ preheader = "", heading = "", content, cta, note, unsubscribe = false }) {
  const button = cta
    ? `<tr><td align="center" style="padding:6px 0 22px"><a href="${esc(cta.url)}" style="display:inline-block;background:#ff4500;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:26px;font-weight:700;font-size:15px">${esc(cta.label)}</a></td></tr>`
    : "";
  const noteRow = note
    ? `<tr><td style="padding:0 0 16px;color:#8b99ab;font-size:12px;line-height:1.6;text-align:center">${esc(note)}</td></tr>`
    : "";
  const unsub = unsubscribe
    ? `<br><a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:#8b99ab;text-decoration:underline">Unsubscribe</a>`
    : "";
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark light"><title>${esc(heading)}</title></head>
<body style="margin:0;padding:0;background:#06101c;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#06101c"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#0c1c2c;border:1px solid #1d3550;border-top:3px solid #ff4500;border-radius:14px">
<tr><td align="center" style="padding:22px 24px 6px"><a href="${SITE}"><img src="${LOGO}" alt="MetsXMFanZone" width="56" height="auto" style="display:block;border:0;height:auto;width:56px"></a></td></tr>
<tr><td style="padding:6px 28px 8px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${heading ? `<tr><td style="padding:6px 0 14px"><h1 style="margin:0;color:#ffffff;font-size:24px;line-height:1.25;font-weight:800;text-align:center">${esc(heading)}</h1></td></tr>` : ""}
<tr><td style="color:#d3dde8;font-size:15px;line-height:1.65">${content}</td></tr>
<tr><td style="height:18px"></td></tr>
${button}${noteRow}
</table></td></tr>
<tr><td style="padding:16px 28px 22px;border-top:1px solid #1d3550;color:#8b99ab;font-size:12px;line-height:1.7;text-align:center">
© 2026 MetsXMFanZone · Fan-run coverage of the New York Mets<br>Not affiliated with MLB or the New York Mets.${unsub}
</td></tr></table></td></tr></table></body></html>`;
}
