// Weekly Mets Recap (called from api/mail-admin.js on GET). Vercel Cron calls it every Monday; it sends at 8 AM New York time and builds the
// email from the last week's blog posts and the Mets' results and schedule (MLB Stats API).
//   Auth: Authorization: Bearer $CRON_SECRET (Vercel Cron sends this automatically when CRON_SECRET is set).
//   ?dry=1   returns the email HTML instead of sending.   ?force=1  skips the Monday-8AM check.
import { weeklyRecap } from "./newsletter-templates.js";
import { SUPABASE_URL, SUPABASE_ANON_KEY, SITE_URL, stripHtml, resolveImage, cleanText } from "./article.js";

const SEGMENT_ID = "53422271-e367-4699-a322-b3e7d586f8a4";
const FROM = "MetsXMFanZone <noreply@metsxmfanzone.com>";
const REPLY_TO = "support@metsxmfanzone.com";
const METS = 121;

const etParts = (d = new Date()) => {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", hour: "numeric", hour12: false, year: "numeric", month: "2-digit", day: "2-digit" });
  const o = Object.fromEntries(f.formatToParts(d).map((p) => [p.type, p.value]));
  return { weekday: o.weekday, hour: Number(o.hour) % 24, ymd: `${o.year}-${o.month}-${o.day}` };
};
const fmtDay = (iso, opts) => new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", ...opts }).format(new Date(iso));
const ymd = (d) => etParts(d).ymd;

async function stories() {
  const since = new Date(Date.now() - 7 * 864e5).toISOString();
  const url =
    `${SUPABASE_URL}/rest/v1/blog_posts?select=title,slug,excerpt,content,category,published_at,featured_image_url` +
    `&published=eq.true&published_at=gte.${since}&order=published_at.desc&limit=4`;
  const r = await fetch(url, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } });
  if (!r.ok) return [];
  const rows = await r.json();
  return (Array.isArray(rows) ? rows : []).map((p, i) => ({
    tag: i === 0 ? "Top story" : cleanText(p.category || ""),
    title: cleanText(p.title) || "Untitled",
    summary: stripHtml(p.excerpt || p.content || "").slice(0, 160),
    url: `${SITE_URL}/blog/${encodeURIComponent(p.slug || "")}`,
    image: i === 0 && p.featured_image_url ? resolveImage(p.featured_image_url) : "",
  }));
}

async function games() {
  const now = Date.now();
  const start = ymd(new Date(now - 7 * 864e5));
  const end = ymd(new Date(now + 7 * 864e5));
  const r = await fetch(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=${METS}&startDate=${start}&endDate=${end}&hydrate=team`);
  if (!r.ok) return { results: [], upcoming: [] };
  const data = await r.json();
  const all = (data.dates || []).flatMap((d) => d.games || []);
  const results = [];
  const upcoming = [];
  for (const g of all) {
    const home = g.teams.home;
    const away = g.teams.away;
    const metsHome = home.team.id === METS;
    const me = metsHome ? home : away;
    const opp = metsHome ? away : home;
    const label = `${metsHome ? "vs" : "at"} ${opp.team.teamName || opp.team.name}`;
    if (g.status?.abstractGameState === "Final") {
      results.push({
        date: fmtDay(g.gameDate, { weekday: "short" }),
        opponent: label,
        result: me.score > opp.score ? "W" : "L",
        score: `${me.score}-${opp.score}`,
      });
    } else if (new Date(g.gameDate).getTime() > now && g.status?.abstractGameState !== "Final") {
      upcoming.push({
        opponent: label,
        when: `${fmtDay(g.gameDate, { weekday: "short" })} ${fmtDay(g.gameDate, { hour: "numeric", minute: "2-digit" })}`,
        where: metsHome ? "Citi Field" : "",
      });
    }
  }
  return { results: results.slice(-7), upcoming: upcoming.slice(0, 7) };
}

export async function buildWeekly() {
  const [s, g] = await Promise.all([stories().catch(() => []), games().catch(() => ({ results: [], upcoming: [] }))]);
  const inSeason = g.results.length || g.upcoming.length;
  const weekOf = fmtDay(new Date(), { month: "short", day: "numeric" });
  const intro = inSeason
    ? "Here's your week in Mets baseball: what happened, what mattered, and what's next."
    : "The Mets are in the offseason, but the news never stops. Here's what you may have missed this week.";
  const mail = weeklyRecap({
    weekOf,
    intro,
    results: g.results,
    stories: s,
    upcoming: g.upcoming,
    shows: [{ title: "MetsXMFanZone Podcast", when: "Live Monday, Wednesday and Friday", url: "https://metsxmfanzone.com/podcast" }],
    shop: { text: "Official jerseys, hats and tees from Fanatics.", url: "https://metsxmfanzone.com/mets-shop", label: "Visit the Mets Shop" },
  });
  return { ...mail, hasContent: s.length > 0 || inSeason > 0, weekOf };
}

const resend = (path, init = {}) =>
  fetch(`https://api.resend.com${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.RESEND_CONTACTS_KEY}`, ...(init.headers || {}) },
  });

export async function runWeekly(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ error: "Unauthorized" });
  if (!process.env.RESEND_CONTACTS_KEY) return res.status(500).json({ error: "Email service is not configured" });

  const q = req.query || {};
  const { weekday, hour, ymd: today } = etParts();
  if (!q.force && !q.dry && !(weekday === "Mon" && hour === 8)) return res.status(200).json({ skipped: "Not Monday 8 AM ET", weekday, hour });

  try {
    const mail = await buildWeekly();
    if (q.dry) return res.status(200).setHeader("Content-Type", "text/html; charset=utf-8").send(mail.html);
    if (!mail.hasContent && !q.force) return res.status(200).json({ skipped: "Nothing to report this week" });

    const name = `Weekly Mets Recap ${today}`;
    const list = await resend("/broadcasts");
    if (list.ok) {
      const body = await list.json();
      if ((body.data || []).some((b) => b.name === name)) return res.status(200).json({ skipped: "Already sent today", name });
    }
    const created = await resend("/broadcasts", {
      method: "POST",
      body: JSON.stringify({ segment_id: SEGMENT_ID, from: FROM, reply_to: REPLY_TO, subject: mail.subject, name, html: mail.html }),
    });
    if (!created.ok) return res.status(502).json({ error: `Create failed: ${await created.text()}` });
    const { id } = await created.json();
    const sent = await resend(`/broadcasts/${id}/send`, { method: "POST", body: JSON.stringify({}) });
    if (!sent.ok) return res.status(502).json({ error: `Send failed: ${await sent.text()}` });
    return res.status(200).json({ success: true, id, name });
  } catch (e) {
    console.error("weekly-newsletter error:", e);
    return res.status(500).json({ error: "Something went wrong" });
  }
}
