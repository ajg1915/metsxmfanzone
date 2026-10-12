// New-look versions of the site emails, all built on the shared shell.
import { renderEmail, esc } from "./email-shell.js";

const SITE = "https://metsxmfanzone.com";
const p = (t) => `<p style="margin:0 0 14px">${t}</p>`;

export function welcomeEmail({ name = "Mets Fan" } = {}) {
  return renderEmail({
    preheader: "Your MetsXMFanZone account is ready.",
    heading: `Welcome, ${esc(name)}!`,
    content:
      p("Your account has been created. Here is what you can do next:") +
      `<ul style="margin:0 0 14px;padding-left:20px"><li>Choose your plan</li><li>Watch live streams</li><li>Connect with other Mets fans</li></ul>` +
      p("Let's go Mets!"),
    cta: { label: "Open MetsXMFanZone", url: SITE },
  });
}

export function gameAlertEmail({ title = "Game Time!", message = "The Mets are about to take the field.", opponent = "", gameTime = "", venue = "", label = "GAMEDAY ALERT", linkUrl = SITE } = {}) {
  const row = (k, v) => (v ? `<p style="margin:0 0 6px"><strong style="color:#ffffff">${k}:</strong> ${esc(v)}</p>` : "");
  return renderEmail({
    preheader: title,
    heading: title,
    content:
      `<p style="margin:0 0 14px;text-align:center"><span style="display:inline-block;background:#ff4500;color:#ffffff;font-size:11px;font-weight:700;letter-spacing:1.4px;padding:5px 12px;border-radius:12px">${esc(label)}</span></p>` +
      p(esc(message)) +
      row("Opponent", opponent) + row("First pitch", gameTime ? `${gameTime} ET` : "") + row("Venue", venue),
    cta: { label: "Watch Live", url: linkUrl },
  });
}
