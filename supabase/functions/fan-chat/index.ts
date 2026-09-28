import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@0.128.0";
import { renderBrandedEmailFor, escapeHtml } from "../_shared/email-brand.ts";

// ---------------------------------------------------------------------------
// MetsXMFanZone AI chat ("Chat · MetsXMFanZone")
// Actions (POST JSON { action, ... }):
//   status        → { online, gameLabel, agentName, conversationId }
//   chat          → { reply } while online, { offline: true } otherwise
//   leave_message → saves a message for a reply when Chat is back online
//   inbox         → this visitor's/member's left messages + replies
//   poll          → new replies (AI or admin) for an open chat
//   admin_*       → admin portal (overview, set_mode, reply, delete, live, send, release)
// Works for logged-out visitors (visitorId) and members (Authorization bearer).
//
// Replies come from Claude (ANTHROPIC_API_KEY). If that key is missing or the
// call fails, it falls back to Cloudflare Workers AI so chat keeps working.
// ---------------------------------------------------------------------------

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const AGENT_NAME = "MetsXMFanZone";
const METS_TEAM_ID = 121;
const CLAUDE_MODEL = Deno.env.get("FAN_CHAT_MODEL") || "claude-opus-5";
const FALLBACK_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";
const VISITOR_DAILY_LIMIT = 10;
const MEMBER_DAILY_LIMIT = 20;
const IP_DAILY_LIMIT = 40; // stops one person rotating visitor ids
const OFFLINE_DAILY_LIMIT = 3;
const PROCESS_BATCH = 5;

// NY teams covered by the site's team pages (ESPN abbreviations)
const NY_TEAMS: { league: string; path: string; abbr: string; name: string; page: string }[] = [
  { league: "NFL", path: "football/nfl", abbr: "NYJ", name: "Jets", page: "ny-jets" },
  { league: "NFL", path: "football/nfl", abbr: "NYG", name: "Giants", page: "ny-giants" },
  { league: "NBA", path: "basketball/nba", abbr: "NY", name: "Knicks", page: "ny-knicks" },
  { league: "NBA", path: "basketball/nba", abbr: "BKN", name: "Nets", page: "brooklyn-nets" },
  { league: "NHL", path: "hockey/nhl", abbr: "NYR", name: "Rangers", page: "ny-rangers" },
  { league: "NHL", path: "hockey/nhl", abbr: "NYI", name: "Islanders", page: "ny-islanders" },
];

// Mirrors src/pages/Plans.tsx — update both if prices change
const PLANS_TEXT = `
PLANS (all billed through PayPal; PayPal supports cards, debit and PayPal balance):
- Free — $0 forever. PayPal link required but never charged ($0.00 agreement). Includes public Mets news, community access, member profile, membership notifications. No live streams.
- Weekly — $3.99 per week. All live streams, full game replays, all highlights, community access, HD streaming.
- Monthly — $9.99 per month (most popular). All live streams, full game replays, all highlights, community forum, ad-free, exclusive content, HD streaming, multi-device.
- Yearly — $129.99 per year. Everything in Monthly plus priority support, early access to content, exclusive merch discounts, VIP community badge.
POLICIES:
- Sign up / upgrade at metsxmfanzone.com/plans. Switch paid plans from the Member Center; new PayPal schedule starts with the new plan.
- Cancel anytime from account settings; access continues to the end of the billing period.
- 7-day money-back guarantee for first-time subscribers, regular season only (not Spring Training or off-season). Contact support within 7 days.
- Paid plans stream on up to 2 devices at once; more than 2 may get the account restricted.
`;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const todayET = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
const plusDaysET = (days: number) =>
  new Date(Date.now() + days * 864e5).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
const fmtET = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(iso).toLocaleString("en-US", { ...opts, timeZone: "America/New_York" });
const isUuid = (v: unknown) =>
  typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const cleanVisitorId = (v: unknown) =>
  typeof v === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(v) ? v : null;

async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function fetchJson(url: string) {
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

// ---------- Mets game status (cached briefly per instance) ----------
type GameInfo = { online: boolean; label: string; context: string };
let gameCache: { at: number; info: GameInfo } | null = null;

async function getMetsInfo(): Promise<GameInfo> {
  let info: GameInfo = { online: false, label: "No Mets game right now", context: "No Mets game today." };
  try {
    const data = await fetchJson(
      `https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=${METS_TEAM_ID}&date=${todayET()}&hydrate=linescore,team`,
    );
    const games = data?.dates?.[0]?.games ?? [];
    const live = games.find((g: any) => g?.status?.abstractGameState === "Live");
    const game = live ?? games[0];
    if (game) {
      const isHome = game.teams.home.team.id === METS_TEAM_ID;
      const opp = isHome ? game.teams.away.team.name : game.teams.home.team.name;
      const vs = isHome ? "vs" : "@";
      const time = fmtET(game.gameDate, { hour: "numeric", minute: "2-digit" });
      const ls = game.linescore;
      const mets = isHome ? ls?.teams?.home?.runs : ls?.teams?.away?.runs;
      const them = isHome ? ls?.teams?.away?.runs : ls?.teams?.home?.runs;
      const state = game.status?.abstractGameState;
      if (state === "Live") {
        info = {
          online: true,
          label: `Mets ${vs} ${opp} — LIVE`,
          context: `LIVE NOW: Mets ${vs} ${opp}. Score: Mets ${mets ?? 0}, ${opp} ${them ?? 0}, ${ls?.inningState ?? ""} ${ls?.currentInning ?? ""}. Watch at metsxmfanzone.com (live streams need Weekly, Monthly or Yearly).`,
        };
      } else if (state === "Final") {
        info = { online: false, label: `Final: Mets ${mets}, ${opp} ${them}`, context: `Today's Mets game is over. Final: Mets ${mets}, ${opp} ${them}.` };
      } else {
        info = { online: false, label: `Mets ${vs} ${opp} at ${time} ET`, context: `Today: Mets ${vs} ${opp} at ${time} ET (not started yet).` };
      }
    }
  } catch (e) {
    console.warn("Mets game lookup failed:", e);
  }

  // Next few Mets games, so "when do they play next?" has an answer
  try {
    const data = await fetchJson(
      `https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=${METS_TEAM_ID}&startDate=${plusDaysET(1)}&endDate=${plusDaysET(10)}&hydrate=team`,
    );
    const next = (data?.dates ?? []).flatMap((d: any) => d.games ?? []).slice(0, 3).map((g: any) => {
      const isHome = g.teams.home.team.id === METS_TEAM_ID;
      const opp = isHome ? g.teams.away.team.name : g.teams.home.team.name;
      return `${fmtET(g.gameDate, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} ET ${isHome ? "vs" : "@"} ${opp}`;
    });
    if (next.length) info.context += ` Next Mets games: ${next.join("; ")}.`;
  } catch (e) {
    console.warn("Mets schedule lookup failed:", e);
  }
  return info;
}

// ---------- Other NY teams today (ESPN public scoreboards) ----------
type NyInfo = { liveLabel: string | null; context: string };

async function getNyTeamsInfo(): Promise<NyInfo> {
  const date = todayET().replaceAll("-", "");
  const paths = [...new Set(NY_TEAMS.map((t) => t.path))];
  const boards = await Promise.all(
    paths.map((p) =>
      fetchJson(`https://site.api.espn.com/apis/site/v2/sports/${p}/scoreboard?dates=${date}`)
        .then((d) => [p, d] as const)
        .catch((e) => {
          console.warn(`ESPN ${p} lookup failed:`, e);
          return [p, null] as const;
        }),
    ),
  );
  const lines: string[] = [];
  let liveLabel: string | null = null;
  for (const [path, board] of boards) {
    for (const ev of board?.events ?? []) {
      const comp = ev?.competitions?.[0];
      const sides = comp?.competitors ?? [];
      for (const team of NY_TEAMS.filter((t) => t.path === path)) {
        const us = sides.find((c: any) => c?.team?.abbreviation === team.abbr);
        if (!us) continue;
        const them = sides.find((c: any) => c !== us);
        const opp = them?.team?.displayName ?? "TBD";
        const vs = us.homeAway === "home" ? "vs" : "@";
        const state = ev?.status?.type?.state; // pre | in | post
        const detail = ev?.status?.type?.shortDetail ?? "";
        if (state === "in") {
          lines.push(`LIVE NOW: ${team.name} ${vs} ${opp}, ${team.name} ${us.score ?? 0}, ${opp} ${them?.score ?? 0} (${detail}).`);
          liveLabel ??= `${team.name} ${vs} ${opp} — LIVE`;
        } else if (state === "post") {
          lines.push(`Final today: ${team.name} ${us.score}, ${opp} ${them?.score} (${detail}).`);
        } else {
          lines.push(`Today: ${team.name} ${vs} ${opp}, ${ev?.date ? fmtET(ev.date, { hour: "numeric", minute: "2-digit" }) + " ET" : detail}.`);
        }
      }
    }
  }
  return {
    liveLabel,
    context: lines.length ? `OTHER NY TEAMS TODAY (${NY_TEAMS.map((t) => t.name).join(", ")}): ${lines.join(" ")}` : "No Jets, Giants, Knicks, Nets, Rangers or Islanders games today.",
  };
}

// Mets first; any live NY team game also counts as "game on" for Auto mode
async function getGameInfo(): Promise<GameInfo> {
  if (gameCache && Date.now() - gameCache.at < 60_000) return gameCache.info;
  const [mets, ny] = await Promise.all([
    getMetsInfo(),
    getNyTeamsInfo().catch(() => ({ liveLabel: null, context: "" }) as NyInfo),
  ]);
  const info: GameInfo = {
    online: mets.online || !!ny.liveLabel,
    label: mets.online ? mets.label : ny.liveLabel ?? mets.label,
    context: `METS: ${mets.context}\n${ny.context}`,
  };
  gameCache = { at: Date.now(), info };
  return info;
}

// ---------- Site context: streams + lineup + predictions + (member) subscription ----------
async function getSiteContext(supabase: any, userId: string | null) {
  const date = todayET();
  const parts: string[] = [];

  const { data: streams } = await supabase
    .from("live_streams").select("title, status, scheduled_start, assigned_pages")
    .eq("published", true).in("status", ["scheduled", "live"])
    .lte("scheduled_start", new Date(Date.now() + 3 * 864e5).toISOString())
    .gte("scheduled_start", new Date(Date.now() - 12 * 36e5).toISOString())
    .order("scheduled_start", { ascending: true }).limit(8);
  if (streams?.length) {
    parts.push("LIVE STREAMS ON THE SITE (next 3 days; need Weekly, Monthly or Yearly): " +
      streams.map((s: any) =>
        `${s.title} — ${s.status === "live" ? "LIVE NOW" : fmtET(s.scheduled_start, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + " ET"}`
      ).join(" | "));
  } else {
    parts.push("No live streams are scheduled on the site in the next 3 days.");
  }

  const { data: card } = await supabase
    .from("lineup_cards").select("opponent, game_time, location, lineup_data, starting_pitcher")
    .eq("game_date", date).maybeSingle();
  if (card && Array.isArray(card.lineup_data) && card.lineup_data.length) {
    const order = [...card.lineup_data].sort((a: any, b: any) => a.position - b.position)
      .map((p: any) => `${p.position}. ${p.name} (${p.fieldPosition})`).join(", ");
    const sp = card.starting_pitcher ? `${card.starting_pitcher.name} (${card.starting_pitcher.hand}, ${card.starting_pitcher.era} ERA)` : "TBD";
    parts.push(`TODAY'S METS LINEUP vs ${card.opponent} (${card.game_time}, ${card.location}): ${order}. Starting pitcher: ${sp}.`);
  } else {
    parts.push("Today's Mets lineup hasn't been posted yet (usually 2-3 hours before first pitch).");
  }

  const { data: preds } = await supabase
    .from("daily_player_predictions").select("player_name, status, description")
    .eq("prediction_date", date).limit(8);
  if (preds?.length) {
    parts.push("TODAY'S SITE PREDICTIONS (Anthony's Predictions page): " +
      preds.map((p: any) => `${p.player_name} [${p.status}] ${p.description}`).join(" | "));
  }

  if (userId) {
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("plan_type, status, end_date, next_payment_date, next_payment_amount, cancellation_status")
      .eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle();
    const planName: Record<string, string> = { free: "Free", weekly: "Weekly", premium: "Monthly", annual: "Yearly", trial: "Trial" };
    if (sub) {
      const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : null;
      parts.push(`THIS FAN IS A LOGGED-IN MEMBER. Their plan: ${planName[sub.plan_type] ?? sub.plan_type}, status: ${sub.status}` +
        (sub.next_payment_date ? `, next payment ${fmt(sub.next_payment_date)}${sub.next_payment_amount ? ` ($${sub.next_payment_amount})` : ""}` : "") +
        (sub.end_date ? `, access through ${fmt(sub.end_date)}` : "") +
        (sub.cancellation_status && sub.cancellation_status !== "none" ? `, cancellation: ${sub.cancellation_status}` : "") + ".");
    } else {
      parts.push("THIS FAN IS LOGGED IN but has no subscription on file yet.");
    }
  } else {
    parts.push("This fan is NOT logged in (a visitor). You can't see any account details; if they ask about their own account, ask them to log in.");
  }
  return parts.join("\n");
}

// Stable part first so it can be prompt-cached; live context goes in a second block
const BASE_PROMPT = `You are MetsXMFanZone, the AI chat for metsxmfanzone.com — a fan site and streaming community for the New York Mets, plus the Jets, Giants, Knicks, Nets, Rangers and Islanders.

HOW YOU TALK:
- Like a lifelong New York fan texting a friend: casual, warm, short (1-3 sentences usually). Contractions, natural phrasing, some Mets energy.
- No bullet lists, no headings, no markdown. Don't over-apologize. Don't start every message with a greeting.
- Use the fan's own words. Ask a quick follow-up when it helps (e.g. which plan fits them).
- You are MetsXMFanZone's AI assistant. If a fan asks whether you're a person or a bot, say so plainly and keep helping. Never claim to be a human.

WHAT YOU KNOW (use only this and general, well-established baseball and NY sports knowledge — never invent prices, live scores, stats, injuries, trades or stream times):
${PLANS_TEXT}
RULES:
- You can't change accounts, process refunds or cancel anything yourself. Point them to the Member Center / account settings, or support@metsxmfanzone.com for refunds.
- If you don't know something (especially anything recent), say so plainly and suggest they check the site or contact support.
- Never share anything about other members.
- Stay on sports, the site and fan talk. Politely steer away from anything unrelated.`;

function liveContext(gameContext: string, siteContext: string, mode: "live" | "offline_reply") {
  return `RIGHT NOW (${fmtET(new Date().toISOString(), { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })} ET):
${gameContext}
${siteContext}
${mode === "offline_reply" ? "\nThe fan left this message earlier while chat was offline. Reply to it naturally, like you're getting back to them (e.g. 'Hey, just seeing this —')." : ""}`;
}

type ChatTurn = { role: "user" | "assistant"; content: string };

let anthropic: Anthropic | null = null;
async function callClaude(system: string, live: string, history: ChatTurn[]) {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  anthropic ??= new Anthropic({ apiKey, timeout: 30_000, maxRetries: 1 });
  const params: Record<string, unknown> = {
    model: CLAUDE_MODEL,
    max_tokens: 4000,
    output_config: { effort: "low" }, // quick, chatty replies
    system: [
      { type: "text", text: system, cache_control: { type: "ephemeral" } },
      { type: "text", text: live },
    ],
    messages: history,
  };
  // Server-side refusal fallback (Claude API only)
  params.betas = ["server-side-fallback-2026-07-01"];
  params.fallbacks = "default";
  // deno-lint-ignore no-explicit-any
  const msg: any = await anthropic.beta.messages.create(params as any);
  if (msg.stop_reason === "refusal") throw new Error("Claude declined to answer");
  const text = (msg.content ?? [])
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("")
    .trim();
  if (!text) throw new Error(`Empty Claude response (stop_reason ${msg.stop_reason})`);
  return text;
}

async function callCloudflare(system: string, live: string, history: ChatTurn[]) {
  const accountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");
  const token = Deno.env.get("CLOUDFLARE_API_TOKEN");
  if (!accountId || !token) throw new Error("Cloudflare AI credentials missing");
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${FALLBACK_MODEL}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [{ role: "system", content: `${system}\n\n${live}` }, ...history], max_tokens: 300, temperature: 0.7 }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Cloudflare AI ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`);
  const data = await res.json();
  const text = String(data?.result?.response ?? "").trim();
  if (!text) throw new Error("Empty Cloudflare AI response");
  return text.replace(/^\s*(as an ai[^.]*\.\s*)/i, "");
}

async function callAi(live: string, history: ChatTurn[]) {
  try {
    return await callClaude(BASE_PROMPT, live, history);
  } catch (e) {
    console.warn("Claude failed, falling back to Cloudflare AI:", e);
    return await callCloudflare(BASE_PROMPT, live, history);
  }
}

// ---------- Email for offline replies ----------
async function emailReply(supabase: any, to: string, original: string, reply: string) {
  const key = Deno.env.get("RESEND_API_KEY_1") ?? Deno.env.get("RESEND_API_KEY");
  if (!key) return false;
  const html = await renderBrandedEmailFor(supabase, {
    preheader: `${AGENT_NAME} got back to you`,
    heading: `${AGENT_NAME} got back to you`,
    content: `<p style="margin:0 0 8px;color:#8b93a1;font-size:13px;">You wrote:</p>
      <p style="margin:0 0 16px;font-style:italic;">"${escapeHtml(original)}"</p>
      <p style="margin:0 0 16px;">${escapeHtml(reply)}</p>`,
    cta: { label: "Open MetsXMFanZone", url: "https://metsxmfanzone.com" },
  });
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "MetsXMFanZone <noreply@metsxmfanzone.com>",
      to: [to],
      subject: `${AGENT_NAME} replied to your message`,
      html,
      text: `You wrote: "${original}"\n\n${AGENT_NAME}: ${reply}\n\nhttps://metsxmfanzone.com`,
      reply_to: "support@metsxmfanzone.com",
    }),
  });
  if (!res.ok) console.error("Offline reply email failed:", res.status, await res.text().catch(() => ""));
  return res.ok;
}

// Reply to messages left while offline (runs in the background once Chat is online)
async function processPending(supabase: any, game: GameInfo) {
  const { data: pending } = await supabase
    .from("chat_offline_messages").select("*")
    .eq("status", "pending").order("created_at", { ascending: true }).limit(PROCESS_BATCH);
  for (const msg of pending ?? []) {
    // claim it so parallel requests don't double-reply
    const { data: claimed } = await supabase
      .from("chat_offline_messages").update({ status: "processing" })
      .eq("id", msg.id).eq("status", "pending").select("id");
    if (!claimed?.length) continue;
    try {
      const siteContext = await getSiteContext(supabase, msg.user_id);
      const reply = await callAi(liveContext(game.context, siteContext, "offline_reply"), [{ role: "user", content: msg.message }]);
      let emailed = false;
      if (msg.email) emailed = await emailReply(supabase, msg.email, msg.message, reply).catch(() => false);
      await supabase.from("chat_offline_messages")
        .update({ status: "replied", reply, replied_at: new Date().toISOString(), reply_emailed: emailed })
        .eq("id", msg.id);
    } catch (e) {
      console.error("Offline reply failed:", e);
      // back to pending so the next online check retries
      await supabase.from("chat_offline_messages").update({ status: "pending" }).eq("id", msg.id);
      break;
    }
  }
}

// ---------- Manual on/off switch (admin portal) ----------
type ChatMode = "auto" | "online" | "offline";
async function getChatMode(supabase: any): Promise<ChatMode> {
  const { data } = await supabase.from("chat_settings").select("mode").eq("id", 1).maybeSingle();
  const m = data?.mode;
  return m === "online" || m === "offline" ? m : "auto";
}
function isOnline(mode: ChatMode, game: GameInfo) {
  return mode === "online" ? true : mode === "offline" ? false : game.online;
}

// ---------- Live conversation log (so you can watch + take over chats) ----------
function ownsConversation(conv: any, userId: string | null, visitorId: string | null) {
  return userId ? conv.user_id === userId : !!visitorId && conv.visitor_id === visitorId && !conv.user_id;
}

async function ensureConversation(supabase: any, id: string, userId: string | null, visitorId: string | null) {
  const { data: existing } = await supabase.from("chat_conversations").select("*").eq("id", id).maybeSingle();
  if (existing) return ownsConversation(existing, userId, visitorId) ? existing : null;
  const row = { id, user_id: userId, visitor_id: userId ? null : visitorId, agent_name: AGENT_NAME };
  const { data, error } = await supabase.from("chat_conversations").insert(row).select("*").single();
  if (error) {
    // created by a parallel request — re-read
    const { data: again } = await supabase.from("chat_conversations").select("*").eq("id", id).maybeSingle();
    return again && ownsConversation(again, userId, visitorId) ? again : null;
  }
  return data;
}

async function addMessage(supabase: any, conversationId: string, role: "user" | "assistant" | "admin", content: string) {
  const { data } = await supabase.from("chat_messages")
    .insert({ conversation_id: conversationId, role, content: content.slice(0, 2000) })
    .select("id").single();
  await supabase.from("chat_conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conversationId);
  return data?.id ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");

    // Who is this? A member (valid user token) or a visitor.
    let userId: string | null = null;
    const auth = req.headers.get("Authorization") ?? "";
    if (auth.startsWith("Bearer ")) {
      const { data } = await supabase.auth.getUser(auth.slice(7)).catch(() => ({ data: null as any }));
      userId = data?.user?.id ?? null;
    }
    const visitorId = cleanVisitorId(body.visitorId);

    // ---- admin actions (admin portal → Chat page) ----
    if (action.startsWith("admin_")) {
      if (!userId) return json({ error: "Login required" }, 401);
      const { data: role } = await supabase.from("user_roles").select("role")
        .eq("user_id", userId).eq("role", "admin").maybeSingle();
      if (!role) return json({ error: "Admin access required" }, 403);

      if (action === "admin_overview") {
        const since = `${todayET()}T00:00:00-04:00`;
        const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
        const [msgs, today, week, pending] = await Promise.all([
          supabase.from("chat_offline_messages")
            .select("id, agent_name, email, message, status, reply, replied_at, reply_emailed, created_at, user_id, visitor_id")
            .order("created_at", { ascending: false }).limit(200),
          supabase.from("chat_usage").select("id", { count: "exact", head: true }).gte("created_at", since),
          supabase.from("chat_usage").select("id", { count: "exact", head: true }).gte("created_at", weekAgo),
          supabase.from("chat_offline_messages").select("id", { count: "exact", head: true }).in("status", ["pending", "processing"]),
        ]);
        const game = await getGameInfo();
        const mode = await getChatMode(supabase);
        return json({
          online: isOnline(mode, game),
          mode,
          gameLabel: game.label,
          messages: (msgs.data ?? []).map((m: any) => ({
            ...m,
            status: m.status === "processing" ? "pending" : m.status,
            is_member: !!m.user_id,
            user_id: undefined,
            visitor_id: undefined,
          })),
          stats: {
            chatsToday: today.count ?? 0,
            chatsWeek: week.count ?? 0,
            pending: pending.count ?? 0,
            memberLimit: MEMBER_DAILY_LIMIT,
            visitorLimit: VISITOR_DAILY_LIMIT,
          },
        });
      }

      if (action === "admin_set_mode") {
        const mode = body.mode;
        if (!["auto", "online", "offline"].includes(mode)) return json({ error: "mode must be auto, online or offline" }, 400);
        const { error } = await supabase.from("chat_settings")
          .upsert({ id: 1, mode, updated_at: new Date().toISOString(), updated_by: userId });
        if (error) throw error;
        const game = await getGameInfo();
        return json({ mode, online: isOnline(mode as ChatMode, game) });
      }

      if (action === "admin_reply") {
        const reply = String(body.reply ?? "").trim().slice(0, 2000);
        if (!isUuid(body.id) || !reply) return json({ error: "Message id and reply required" }, 400);
        const { data: msg } = await supabase.from("chat_offline_messages").select("*").eq("id", body.id).maybeSingle();
        if (!msg) return json({ error: "Message not found" }, 404);
        let emailed = false;
        if (msg.email) emailed = await emailReply(supabase, msg.email, msg.message, reply).catch(() => false);
        const { error } = await supabase.from("chat_offline_messages")
          .update({ status: "replied", reply, replied_at: new Date().toISOString(), reply_emailed: emailed || msg.reply_emailed })
          .eq("id", msg.id);
        if (error) throw error;
        return json({ saved: true, emailed, hadEmail: !!msg.email });
      }

      if (action === "admin_delete") {
        if (!isUuid(body.id)) return json({ error: "Message id required" }, 400);
        const { error } = await supabase.from("chat_offline_messages").delete().eq("id", body.id);
        if (error) throw error;
        return json({ deleted: true });
      }

      if (action === "admin_live") {
        const hours = Math.min(Math.max(Number(body.hours) || 6, 1), 72);
        const since = new Date(Date.now() - hours * 36e5).toISOString();
        const { data: convs } = await supabase.from("chat_conversations")
          .select("id, agent_name, user_id, taken_over, started_at, last_message_at")
          .gte("last_message_at", since).order("last_message_at", { ascending: false }).limit(40);
        const ids = (convs ?? []).map((c: any) => c.id);
        const { data: msgs } = ids.length
          ? await supabase.from("chat_messages").select("id, conversation_id, role, content, created_at")
            .in("conversation_id", ids).order("created_at", { ascending: true }).limit(2000)
          : { data: [] };
        return json({
          conversations: (convs ?? []).map((c: any) => ({
            id: c.id,
            agent_name: c.agent_name,
            is_member: !!c.user_id,
            taken_over: c.taken_over,
            started_at: c.started_at,
            last_message_at: c.last_message_at,
            messages: (msgs ?? []).filter((m: any) => m.conversation_id === c.id)
              .map((m: any) => ({ id: m.id, role: m.role, content: m.content, created_at: m.created_at })),
          })),
        });
      }

      if (action === "admin_send") {
        const content = String(body.content ?? "").trim().slice(0, 2000);
        if (!isUuid(body.conversationId) || !content) return json({ error: "Conversation and message required" }, 400);
        const { data: conv } = await supabase.from("chat_conversations").select("id").eq("id", body.conversationId).maybeSingle();
        if (!conv) return json({ error: "Conversation not found" }, 404);
        await supabase.from("chat_conversations")
          .update({ taken_over: true, taken_over_at: new Date().toISOString() }).eq("id", conv.id);
        const id = await addMessage(supabase, conv.id, "admin", content);
        return json({ sent: true, id });
      }

      if (action === "admin_release") {
        if (!isUuid(body.conversationId)) return json({ error: "Conversation required" }, 400);
        await supabase.from("chat_conversations").update({ taken_over: false }).eq("id", body.conversationId);
        return json({ released: true });
      }

      return json({ error: "Unknown admin action" }, 400);
    }

    if (!userId && !visitorId) return json({ error: "visitorId required" }, 400);
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
    const ipHash = await sha256(`${ip}:${todayET()}`);

    const game = await getGameInfo();
    const online = isOnline(await getChatMode(supabase), game);

    // ---- status ----
    if (action === "status") {
      if (online) {
        // @ts-ignore EdgeRuntime is available in Supabase Edge Functions
        EdgeRuntime.waitUntil(processPending(supabase, game).catch((e: unknown) => console.error(e)));
      }
      return json({ online, gameLabel: game.label, agentName: AGENT_NAME, conversationId: crypto.randomUUID() });
    }

    // ---- inbox ----
    if (action === "inbox") {
      let q = supabase.from("chat_offline_messages")
        .select("id, agent_name, message, status, reply, replied_at, created_at")
        .order("created_at", { ascending: false }).limit(20);
      q = userId ? q.eq("user_id", userId) : q.eq("visitor_id", visitorId);
      const { data } = await q;
      return json({
        messages: (data ?? []).map((m: any) => ({
          ...m,
          agent_name: AGENT_NAME,
          status: m.status === "processing" ? "pending" : m.status,
        })),
      });
    }

    // ---- leave_message ----
    if (action === "leave_message") {
      const message = String(body.message ?? "").trim().slice(0, 2000);
      const email = typeof body.email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())
        ? body.email.trim().toLowerCase() : null;
      if (!message) return json({ error: "Message is empty" }, 400);
      const since = `${todayET()}T00:00:00-04:00`;
      let q = supabase.from("chat_offline_messages").select("id", { count: "exact", head: true }).gte("created_at", since);
      q = userId ? q.eq("user_id", userId) : q.eq("visitor_id", visitorId);
      const { count } = await q;
      if ((count ?? 0) >= OFFLINE_DAILY_LIMIT) {
        return json({ error: "You've already left a few messages today — we'll get back to you soon!" }, 429);
      }
      let finalEmail = email;
      if (!finalEmail && userId) {
        const { data: prof } = await supabase.from("profiles").select("email").eq("id", userId).maybeSingle();
        finalEmail = prof?.email ?? null;
      }
      const { error } = await supabase.from("chat_offline_messages").insert({
        conversation_id: isUuid(body.conversationId) ? body.conversationId : crypto.randomUUID(),
        user_id: userId, visitor_id: visitorId, agent_name: AGENT_NAME,
        email: finalEmail, message,
      });
      if (error) throw error;
      return json({ saved: true, willEmail: !!finalEmail });
    }

    // ---- chat ----
    if (action === "chat") {
      const msgs = Array.isArray(body.messages) ? body.messages : [];
      let history: ChatTurn[] = msgs
        .filter((m: any) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string" && m.content.trim())
        .slice(-12)
        .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, 1500) }));
      // Claude needs the conversation to start with the fan (drop the canned greeting)
      while (history.length && history[0].role !== "user") history = history.slice(1);
      if (!history.length || history[history.length - 1].role !== "user") return json({ error: "Send a message" }, 400);
      if (!isUuid(body.conversationId)) return json({ error: "conversationId required" }, 400);

      const conv = await ensureConversation(supabase, body.conversationId, userId, visitorId);
      if (!conv) return json({ error: "Conversation not found" }, 403);

      if (!online && !conv.taken_over) return json({ offline: true, gameLabel: game.label });

      const userText = history[history.length - 1].content;
      await addMessage(supabase, conv.id, "user", userText);

      // You took over this chat — the AI stays quiet; your reply arrives via "poll"
      if (conv.taken_over) return json({ queued: true });

      // Rate limits (AI replies only)
      const since = `${todayET()}T00:00:00-04:00`;
      const countBy = async (col: string, val: string) => {
        const { count } = await supabase.from("chat_usage").select("id", { count: "exact", head: true })
          .eq(col, val).gte("created_at", since);
        return count ?? 0;
      };
      const mine = userId ? await countBy("user_id", userId) : await countBy("visitor_id", visitorId!);
      const limit = userId ? MEMBER_DAILY_LIMIT : VISITOR_DAILY_LIMIT;
      if (mine >= limit || (!userId && (await countBy("ip_hash", ipHash)) >= IP_DAILY_LIMIT)) {
        const reply = userId
          ? "That's all the chat I've got for today — hit me up again tomorrow! ⚾"
          : "That's all the chat I've got for now! Log in or join (metsxmfanzone.com/plans) and we can keep talking. ⚾";
        const id = await addMessage(supabase, conv.id, "assistant", reply);
        return json({ limited: true, reply, id });
      }
      await supabase.from("chat_usage").insert({ user_id: userId, visitor_id: userId ? null : visitorId, ip_hash: ipHash });

      const siteContext = await getSiteContext(supabase, userId);
      try {
        const reply = await callAi(liveContext(game.context, siteContext, "live"), history);
        // If you jumped in while the AI was thinking, drop the AI's answer
        const { data: fresh } = await supabase.from("chat_conversations").select("taken_over").eq("id", conv.id).maybeSingle();
        if (fresh?.taken_over) return json({ queued: true });
        const id = await addMessage(supabase, conv.id, "assistant", reply);
        // @ts-ignore EdgeRuntime is available in Supabase Edge Functions
        EdgeRuntime.waitUntil(processPending(supabase, game).catch((e: unknown) => console.error(e)));
        return json({ reply, id, agentName: AGENT_NAME });
      } catch (e: any) {
        console.error("Chat AI error:", e);
        const reply = "I'm swamped right now — leave a message and I'll get back to you soon!";
        const id = await addMessage(supabase, conv.id, "assistant", reply);
        return json({ busy: true, reply, id });
      }
    }

    // ---- poll: new replies (AI or you) for the fan's open chat ----
    if (action === "poll") {
      if (!isUuid(body.conversationId)) return json({ messages: [] });
      const { data: conv } = await supabase.from("chat_conversations").select("*").eq("id", body.conversationId).maybeSingle();
      if (!conv || !ownsConversation(conv, userId, visitorId)) return json({ messages: [] });
      const after = typeof body.after === "string" && !isNaN(Date.parse(body.after)) ? body.after : conv.started_at;
      const { data } = await supabase.from("chat_messages").select("id, role, content, created_at")
        .eq("conversation_id", conv.id).in("role", ["assistant", "admin"]).gt("created_at", after)
        .order("created_at", { ascending: true }).limit(50);
      return json({
        takenOver: conv.taken_over,
        messages: (data ?? []).map((m: any) => ({ id: m.id, role: "assistant", content: m.content, created_at: m.created_at })),
      });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("fan-chat error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
