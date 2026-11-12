// MetsXMFanZone newsletter templates. All use the shared email shell (navy card, orange accents, logo).
// Every function returns { subject, html } ready for Resend. Unsubscribe link is always included.
import { renderEmail, esc } from "./email-shell.js";

const SITE = "https://metsxmfanzone.com";
const B = (n) => `${SITE}/email/banner-${n}.png`;
const ORANGE = "#ff4500";
const MUTED = "#8b99ab";
const PANEL = "#10253a";
const LINE = "#1d3550";

const h2 = (t) =>
  `<h2 style="margin:26px 0 10px;padding-bottom:6px;border-bottom:2px solid ${ORANGE};color:#ffffff;font-size:16px;letter-spacing:.08em;text-transform:uppercase">${esc(t)}</h2>`;
const p = (t) => `<p style="margin:0 0 14px">${esc(t)}</p>`;
const link = (url, label) => `<a href="${esc(url)}" style="color:#ff7a3d;text-decoration:underline">${esc(label)}</a>`;

function storyCard({ title, summary, url, image, tag }) {
  const img = image
    ? `<tr><td><a href="${esc(url)}"><img src="${esc(image)}" alt="" width="100%" style="display:block;width:100%;height:auto;border:0;border-radius:10px 10px 0 0"></a></td></tr>`
    : "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px;background:${PANEL};border:1px solid ${LINE};border-radius:10px">
${img}<tr><td style="padding:14px 16px">
${tag ? `<div style="color:${ORANGE};font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;margin-bottom:4px">${esc(tag)}</div>` : ""}
<a href="${esc(url)}" style="color:#ffffff;text-decoration:none;font-size:17px;font-weight:800;line-height:1.3">${esc(title)}</a>
${summary ? `<div style="color:#b9c6d4;font-size:14px;line-height:1.55;margin-top:6px">${esc(summary)}</div>` : ""}
<div style="margin-top:8px">${link(url, "Read more")}</div>
</td></tr></table>`;
}

function resultRow({ opponent, score, result, date }) {
  const win = /^w/i.test(result || "");
  return `<tr><td style="padding:9px 12px;border-bottom:1px solid ${LINE};color:#d3dde8;font-size:14px">${esc(date || "")}</td>
<td style="padding:9px 12px;border-bottom:1px solid ${LINE};color:#ffffff;font-size:14px;font-weight:700">${esc(opponent)}</td>
<td align="right" style="padding:9px 12px;border-bottom:1px solid ${LINE};font-size:14px;font-weight:800;color:${win ? "#4ade80" : "#f87171"}">${esc(result || "")} ${esc(score || "")}</td></tr>`;
}

function table(rows) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PANEL};border:1px solid ${LINE};border-radius:10px">${rows}</table>`;
}

function upcomingRow({ opponent, when, where }) {
  return `<tr><td style="padding:9px 12px;border-bottom:1px solid ${LINE};color:#ffffff;font-size:14px;font-weight:700">${esc(opponent)}</td>
<td align="right" style="padding:9px 12px;border-bottom:1px solid ${LINE};color:#b9c6d4;font-size:13px">${esc(when)}${where ? ` · ${esc(where)}` : ""}</td></tr>`;
}

function showBox({ title, when, url }) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 6px;background:linear-gradient(180deg,#123b78,#0c2a57);border:1px solid #2a5aa8;border-radius:10px"><tr><td style="padding:14px 16px">
<div style="color:${ORANGE};font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase">Live on MetsXMFanZone</div>
<div style="color:#ffffff;font-size:17px;font-weight:800;margin:3px 0">${esc(title)}</div>
<div style="color:#cfe0f5;font-size:14px">${esc(when)} · ${link(url, "Watch live")}</div></td></tr></table>`;
}

/** Weekly Mets Recap: results, top stories, next week, live shows. */
export function weeklyRecap({ weekOf, intro, results = [], stories = [], upcoming = [], shows = [], shop } = {}) {
  const parts = [];
  if (intro) parts.push(p(intro));
  if (results.length) parts.push(h2("⚾ Last week's results"), table(results.map(resultRow).join("")));
  if (stories.length) parts.push(h2("📰 Top stories"), stories.map(storyCard).join(""));
  if (upcoming.length) parts.push(h2("📅 This week"), table(upcoming.map(upcomingRow).join("")));
  if (shows.length) parts.push(h2("🎙️ Watch & listen"), shows.map(showBox).join(""));
  if (shop) parts.push(h2("🛍️ Rep the orange & blue"), p(shop.text), `<p style="margin:0 0 6px">${link(shop.url, shop.label || "Shop Mets gear")}</p>`);
  return {
    subject: `Your Weekly Mets Recap${weekOf ? ` · ${weekOf}` : ""}`,
    html: renderEmail({
      preheader: intro || "Results, top stories and what's coming up this week.",
      heading: "Weekly Mets Recap",
      banner: B("weekly"),
      signoff: true,
      content: parts.join(""),
      cta: { label: "Open MetsXMFanZone", url: SITE },
      note: weekOf ? `Week of ${weekOf}` : undefined,
      unsubscribe: true,
    }),
  };
}

/** Breaking / Quick Update: one story, one button. */
export function breakingUpdate({ headline, body, image, url, buttonLabel = "Read the full story", tag = "Breaking" } = {}) {
  const img = image
    ? `<p style="margin:0 0 16px"><a href="${esc(url)}"><img src="${esc(image)}" alt="" width="100%" style="display:block;width:100%;height:auto;border:0;border-radius:10px"></a></p>`
    : "";
  return {
    subject: `${tag}: ${headline}`,
    html: renderEmail({
      preheader: body ? String(body).slice(0, 110) : headline,
      heading: headline,
      banner: B("breaking"),
      content: `<h1 style="margin:0 0 14px;color:#ffffff;font-size:24px;line-height:1.25;font-weight:800;text-align:center">🚨 ${esc(headline)}</h1>${img}${p(body || "")}`,
      cta: { label: buttonLabel, url: url || SITE },
      unsubscribe: true,
    }),
  };
}

/** Site & Feature Update: what's new on the site and app. */
export function siteUpdate({ title = "What's new at MetsXMFanZone", intro, features = [], cta } = {}) {
  const list = features
    .map(
      (f) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 12px;background:${PANEL};border:1px solid ${LINE};border-left:4px solid ${ORANGE};border-radius:8px"><tr><td style="padding:12px 14px">
<div style="color:#ffffff;font-size:16px;font-weight:800">${esc(f.title)}</div>
<div style="color:#b9c6d4;font-size:14px;line-height:1.55;margin-top:4px">${esc(f.text)}</div>
${f.url ? `<div style="margin-top:6px">${link(f.url, f.linkLabel || "Check it out")}</div>` : ""}</td></tr></table>`,
    )
    .join("");
  return {
    subject: title,
    html: renderEmail({
      preheader: intro || "New features, app updates and more.",
      heading: title,
      banner: B("update"),
      signoff: true,
      content: (intro ? p(intro) : "") + list,
      cta: cta || { label: "See what's new", url: SITE },
      unsubscribe: true,
    }),
  };
}

/** Welcome email, sent right after signup. */
export function welcome({ name } = {}) {
  const hi = name ? `Welcome, ${name}!` : "Welcome to the FanZone!";
  const perk = (t, d) =>
    `<tr><td style="padding:8px 0;color:#d3dde8;font-size:15px"><span style="color:${ORANGE};font-weight:800">&#9679;</span>&nbsp; <strong style="color:#fff">${esc(t)}</strong> ${esc(d)}</td></tr>`;
  return {
    subject: "Welcome to MetsXMFanZone",
    html: renderEmail({
      preheader: "Here's what you'll get from us every week.",
      heading: hi,
      banner: B("welcome"),
      signoff: true,
      content:
        `<h1 style="margin:0 0 14px;color:#ffffff;font-size:24px;line-height:1.25;font-weight:800;text-align:center">${esc(hi)}</h1>` +
        p("You're in. MetsXMFanZone is fan-run Mets coverage, and here's what lands in your inbox:") +
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">` +
        perk("Weekly Mets Recap", "results, top stories and what's coming up.") +
        perk("Breaking updates", "trades, signings and injuries the moment they happen.") +
        perk("Live shows", "when the podcast and game streams go live.") +
        perk("Site news", "new features and app updates.") +
        `</table>` +
        `<div style="height:10px"></div>` +
        p("Not into an email? Every message has a one-click unsubscribe at the bottom."),
      cta: { label: "Jump into the FanZone", url: SITE },
      unsubscribe: true,
    }),
  };
}

export const SAMPLES = {
  weekly: () =>
    weeklyRecap({
      weekOf: "Nov 9",
      intro: "Here's your week in Mets baseball: what happened, what mattered, and what's next.",
      results: [
        { date: "Mon", opponent: "vs Braves", result: "W", score: "6-3" },
        { date: "Tue", opponent: "vs Braves", result: "L", score: "2-4" },
        { date: "Wed", opponent: "at Phillies", result: "W", score: "5-1" },
      ],
      stories: [
        { tag: "Top story", title: "Sample headline: the story fans are talking about", summary: "A short two-line summary pulled from your latest blog post goes here.", url: `${SITE}/blog` },
        { title: "Second story from the blog", summary: "Another summary line from your latest articles.", url: `${SITE}/blog` },
      ],
      upcoming: [
        { opponent: "vs Marlins", when: "Fri 7:10 PM", where: "Citi Field" },
        { opponent: "vs Marlins", when: "Sat 4:10 PM", where: "Citi Field" },
      ],
      shows: [{ title: "MetsXMFanZone Podcast", when: "Mon 8 PM ET", url: `${SITE}/podcast` }],
      shop: { text: "Fresh jerseys, hats and tees from Fanatics.", url: `${SITE}/mets-shop`, label: "Visit the Mets Shop" },
    }),
  breaking: () =>
    breakingUpdate({ headline: "Sample: Mets sign a big free agent", body: "Two or three sentences with the key facts go here. Keep it short and send readers to the full story.", url: `${SITE}/blog` }),
  update: () =>
    siteUpdate({
      intro: "We've been busy. Here's what's new for fans.",
      features: [
        { title: "Listen mode", text: "Keep the game audio going with your screen locked, right from the app.", url: `${SITE}/install`, linkLabel: "Get the app" },
        { title: "Mets Shop", text: "Official gear from Fanatics, all in one place.", url: `${SITE}/mets-shop` },
      ],
    }),
  welcome: () => welcome({ name: "Anthony" }),
};
