/**
 * MetsXMFanZone — Key Highlights Worker
 *
 * Generates short, fan-friendly "Key Highlights" bullet points for previous
 * Mets games and writes them into `game_recaps.highlights` (jsonb array of
 * strings). Designed to run after `gamecast-recap-worker.js`.
 *
 * For each finished Mets game in the lookback window it:
 *   1. Pulls the MLB Stats API live feed for the gamePk.
 *   2. Extracts scoring plays, HRs, multi-hit games, pitching lines, decisions.
 *   3. Asks Gemini to summarize into 4–6 punchy bullets.
 *   4. Upserts the bullets into `public.game_recaps.highlights` keyed by
 *      (game_date, opponent). If no recap row exists yet, it inserts a stub.
 *
 * ──────────────────────────────────────────────────────────────────────────
 *  wrangler.toml example:
 *
 *    name = "mets-key-highlights-worker"
 *    main = "key-highlights-worker.js"
 *    compatibility_date = "2025-01-01"
 *
 *    [triggers]
 *    crons = ["30 13 * * *"]   # 9:30 AM ET daily (after recap worker)
 *
 *    [vars]
 *    SUPABASE_URL = "https://rdmrxeplasttewtlfetc.supabase.co"
 *    LOOKBACK_DAYS = "3"
 *
 *  Secrets (do NOT commit):
 *    wrangler secret put SUPABASE_SERVICE_ROLE_KEY
 *    wrangler secret put GEMINI_API_KEY
 *
 *  Manual backfill:
 *    POST { "date": "2026-04-15" }            → single day
 *    POST { "from": "2026-04-10", "to": "2026-04-15" }   → range
 * ──────────────────────────────────────────────────────────────────────────
 */

const METS_TEAM_ID = 121;
const MODEL = "gemini-2.5-flash";

const todayET = () => {
  const ny = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
  return ny.toISOString().slice(0, 10);
};

const shiftDate = (iso, days) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const datesInRange = (from, to) => {
  const out = [];
  let cur = from;
  while (cur <= to) {
    out.push(cur);
    cur = shiftDate(cur, 1);
  }
  return out;
};

const PROFANITY = /\b(f+u+c+k+\w*|s+h+i+t+\w*|b+i+t+c+h+\w*|a+s+s+h+o+l+e+\w*|d+i+c+k+\w*|p+u+s+s+y+\w*|c+u+n+t+\w*|b+a+s+t+a+r+d+\w*|n+i+g+\w*|f+a+g+\w*|r+e+t+a+r+d+\w*|w+h+o+r+e+\w*|s+l+u+t+\w*|m+o+t+h+e+r+f+\w*)\b/i;
const PII = [
  /[\w.+-]+@[\w-]+\.[\w.-]+/i,
  /(?:\+?\d{1,2}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/,
  /\b\d{3}-\d{2}-\d{4}\b/,
  /\bhttps?:\/\/\S+/i,
];
const isSafe = (s) => !!s && !PROFANITY.test(s) && !PII.some((r) => r.test(s));

const cleanOpponent = (name = "") =>
  name
    .replace(/^(New York|Atlanta|Philadelphia|Miami|Washington|Los Angeles|San Francisco|San Diego|St\. Louis|Kansas City|Chicago|Tampa Bay|Toronto|Cincinnati|Houston|Pittsburgh|Milwaukee|Arizona|Colorado|Seattle|Oakland|Minnesota|Cleveland|Detroit|Boston|Baltimore|Texas)\s+/i, "")
    .trim();

async function fetchSchedule(date) {
  const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=${METS_TEAM_ID}&date=${date}&hydrate=team,venue,linescore,decisions`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`schedule ${res.status}`);
  const data = await res.json();
  return data.dates?.[0]?.games ?? [];
}

async function fetchFeed(gamePk) {
  const res = await fetch(`https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live`);
  if (!res.ok) return null;
  return res.json();
}

function buildContext(game, feed) {
  const isHome = game.teams.home.team.id === METS_TEAM_ID;
  const opponent = cleanOpponent(isHome ? game.teams.away.team.name : game.teams.home.team.name);
  const metsScore = isHome ? game.teams.home.score : game.teams.away.score;
  const oppScore = isHome ? game.teams.away.score : game.teams.home.score;
  const result = metsScore > oppScore ? "W" : metsScore < oppScore ? "L" : "T";

  const allPlays = feed?.liveData?.plays?.allPlays ?? [];
  const scoring = allPlays
    .filter((p) => p?.about?.isScoringPlay)
    .slice(0, 20)
    .map((p) => ({
      inning: `${p.about?.halfInning} ${p.about?.inning}`,
      desc: p.result?.description,
      event: p.result?.event,
      score: `${p.result?.awayScore}-${p.result?.homeScore}`,
    }));

  const homeRuns = allPlays
    .filter((p) => (p?.result?.eventType || "").toLowerCase() === "home_run")
    .slice(0, 10)
    .map((p) => ({
      inning: `${p.about?.halfInning} ${p.about?.inning}`,
      desc: p.result?.description,
    }));

  const teamSide = isHome ? "home" : "away";
  const players = feed?.liveData?.boxscore?.teams?.[teamSide]?.players ?? {};
  const topBatters = Object.values(players)
    .map((p) => ({
      name: p?.person?.fullName,
      h: p?.stats?.batting?.hits,
      ab: p?.stats?.batting?.atBats,
      rbi: p?.stats?.batting?.rbi,
      hr: p?.stats?.batting?.homeRuns,
    }))
    .filter((p) => (p.ab ?? 0) > 0 && ((p.h ?? 0) >= 2 || (p.rbi ?? 0) >= 2 || (p.hr ?? 0) >= 1))
    .slice(0, 6);

  const pitchers = Object.values(players)
    .map((p) => ({
      name: p?.person?.fullName,
      ip: p?.stats?.pitching?.inningsPitched,
      k: p?.stats?.pitching?.strikeOuts,
      er: p?.stats?.pitching?.earnedRuns,
      h: p?.stats?.pitching?.hits,
    }))
    .filter((p) => p.ip && Number(p.ip) >= 1)
    .slice(0, 5);

  const decisions = feed?.liveData?.decisions ?? game.decisions ?? {};

  return {
    date: game.gameDate?.slice(0, 10),
    opponent,
    homeAway: isHome ? "home" : "away",
    final: { mets: metsScore, opponent: oppScore, result },
    decisions: {
      win: decisions?.winner?.fullName,
      loss: decisions?.loser?.fullName,
      save: decisions?.save?.fullName,
    },
    scoringPlays: scoring,
    homeRuns,
    topBatters,
    pitchers,
  };
}

async function generateHighlights(env, ctx) {
  const prompt = `You write KEY HIGHLIGHTS for Mets game recaps on MetsXMFanZone.
Given the JSON context below, return STRICT JSON of the form:
{"highlights":["...","...","..."]}

Rules:
- 4 to 6 bullets total.
- Each bullet is ONE short sentence, max 140 chars, no emojis, no markdown.
- Plain text only — no HTML, no quotes inside bullets, no URLs, no emails, no phone numbers.
- Highlight scoring plays, HRs, standout batters (2+ hits / 2+ RBI), and the winning/losing/save pitcher.
- Always include the final score in the FIRST bullet (e.g. "Mets beat Braves 7-4 at Citi Field.").
- Never use profanity.

CONTEXT:
${JSON.stringify(ctx, null, 2)}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${env.GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      systemInstruction: {
        parts: [{ text: "You write accurate, concise MLB highlight bullets. Always return valid JSON only." }],
      },
      generationConfig: { responseMimeType: "application/json", temperature: 0.5 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const ai = await res.json();
  const text = ai?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  const parsed = JSON.parse(text.replace(/^```json\s*|\s*```$/g, "").trim());
  const raw = Array.isArray(parsed.highlights) ? parsed.highlights : [];
  // Content-safety pass
  return raw
    .map((h) => String(h || "").trim())
    .filter((h) => h.length > 0 && h.length <= 200 && isSafe(h))
    .slice(0, 6);
}

async function upsertHighlights(env, ctx, highlights) {
  // Try update existing recap row by (game_date, opponent)
  const findUrl =
    `${env.SUPABASE_URL}/rest/v1/game_recaps` +
    `?game_date=eq.${ctx.date}&opponent=eq.${encodeURIComponent(ctx.opponent)}&select=id`;
  const findRes = await fetch(findUrl, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  const found = findRes.ok ? await findRes.json() : [];

  if (found.length > 0) {
    const id = found[0].id;
    const patch = await fetch(`${env.SUPABASE_URL}/rest/v1/game_recaps?id=eq.${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ highlights }),
    });
    if (!patch.ok) throw new Error(`patch ${patch.status}: ${await patch.text()}`);
    return { mode: "updated", id };
  }

  // Insert a stub recap row carrying the highlights
  const slug = `mets-${ctx.final.result === "W" ? "beat" : ctx.final.result === "L" ? "fall-to" : "tie"}-${ctx.opponent}-${ctx.date}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 90);

  const row = {
    title: `Mets ${ctx.final.result === "W" ? "beat" : ctx.final.result === "L" ? "fall to" : "tie"} ${ctx.opponent} ${ctx.final.mets}-${ctx.final.opponent}`,
    slug,
    opponent: ctx.opponent,
    game_date: ctx.date,
    home_away: ctx.homeAway,
    mets_score: ctx.final.mets,
    opponent_score: ctx.final.opponent,
    result: ctx.final.result,
    highlights,
    hero_image_url: "https://www.mlbstatic.com/team-logos/121.svg",
    status: "published",
    published_at: new Date().toISOString(),
  };

  const ins = await fetch(`${env.SUPABASE_URL}/rest/v1/game_recaps?on_conflict=slug`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify(row),
  });
  if (!ins.ok) throw new Error(`insert ${ins.status}: ${await ins.text()}`);
  const [recap] = await ins.json();
  return { mode: "inserted", id: recap.id };
}

async function runForDate(env, date) {
  const out = { date, games: [] };
  const games = await fetchSchedule(date);
  const finals = games.filter((g) =>
    ["Final", "Game Over", "Completed Early"].includes(g.status?.detailedState)
  );
  for (const g of finals) {
    try {
      const feed = await fetchFeed(g.gamePk);
      const ctx = buildContext(g, feed);
      if (ctx.final.mets == null || ctx.final.opponent == null) continue;
      const highlights = await generateHighlights(env, ctx);
      if (!highlights.length) {
        out.games.push({ gamePk: g.gamePk, ok: false, error: "no safe highlights generated" });
        continue;
      }
      const w = await upsertHighlights(env, ctx, highlights);
      out.games.push({ gamePk: g.gamePk, opponent: ctx.opponent, ...w, count: highlights.length });
    } catch (e) {
      out.games.push({ gamePk: g.gamePk, ok: false, error: e.message });
    }
  }
  return out;
}

async function runForRange(env, from, to) {
  const results = [];
  for (const d of datesInRange(from, to)) results.push(await runForDate(env, d));
  return results;
}

export default {
  async scheduled(event, env, ctx) {
    const lookback = parseInt(env.LOOKBACK_DAYS || "3", 10);
    const to = shiftDate(todayET(), -1);
    const from = shiftDate(to, -(lookback - 1));
    ctx.waitUntil(runForRange(env, from, to));
  },

  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response(
        "POST { date: 'YYYY-MM-DD' } or { from, to } to generate key highlights",
        { status: 405 }
      );
    }
    const body = await request.json().catch(() => ({}));
    let result;
    if (body.from && body.to) {
      result = await runForRange(env, body.from, body.to);
    } else {
      const date = body.date || shiftDate(todayET(), -1);
      result = await runForDate(env, date);
    }
    return new Response(JSON.stringify(result, null, 2), {
      headers: { "Content-Type": "application/json" },
    });
  },
};
