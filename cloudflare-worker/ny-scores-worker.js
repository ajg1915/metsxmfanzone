// ny-scores — Cloudflare Worker for MetsXMFanZone
// Live scores for the six New York teams (Giants, Jets, Knicks, Nets, Rangers,
// Islanders), pulled straight from ESPN's public feeds. Supabase isn't involved.
//
// Paste this whole file into: Cloudflare dashboard → Workers & Pages →
// Create → Worker → name it "ny-scores" → Deploy → Edit code →
// replace everything → Deploy.
//
// No settings, secrets, bindings or timers are needed. The home page asks this
// worker for scores; the worker asks ESPN and keeps a short in-memory copy so a
// busy page doesn't hammer ESPN:
//   - today's scoreboards (live score, period, clock) ...... refreshed every 20 seconds
//   - each team's schedule (last result, next game) ......... refreshed every 10 minutes
// If ESPN is slow or down, the last good copy is served instead of nothing.
//
// GET /            → { updatedAt, teams: [...] }   (see shapeGame below for fields)
// GET /?debug=1    → same, plus which ESPN calls failed

const TEAMS = [
  { key: "giants", label: "Giants", league: "NFL", path: "football/nfl", slug: "nyg", abbr: "NYG" },
  { key: "jets", label: "Jets", league: "NFL", path: "football/nfl", slug: "nyj", abbr: "NYJ" },
  { key: "knicks", label: "Knicks", league: "NBA", path: "basketball/nba", slug: "ny", abbr: "NY" },
  { key: "nets", label: "Nets", league: "NBA", path: "basketball/nba", slug: "bkn", abbr: "BKN" },
  { key: "rangers", label: "Rangers", league: "NHL", path: "hockey/nhl", slug: "nyr", abbr: "NYR" },
  { key: "islanders", label: "Islanders", league: "NHL", path: "hockey/nhl", slug: "nyi", abbr: "NYI" },
];
const LEAGUE_PATHS = [...new Set(TEAMS.map((t) => t.path))];

const SCOREBOARD_TTL = 20_000;
const SCHEDULE_TTL = 10 * 60_000;
const FETCH_TIMEOUT = 8_000;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const ET = "America/New_York";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

// ---------- small in-memory cache (lives as long as this worker instance) ----------
const cache = new Map(); // url -> { at, data }
const backoff = new Map(); // url -> time we may try again after a failure
const RETRY_AFTER = 30_000;

async function getJSON(url, ttl, errors) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < ttl) return hit.data;
  if ((backoff.get(url) || 0) > Date.now()) {
    errors.push(`${url}: waiting before retrying a failed call`);
    return hit ? hit.data : null;
  }
  try {
    const res = await fetch(url, {
      headers: { accept: "application/json", "user-agent": "Mozilla/5.0 (ny-scores worker)" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
      cf: { cacheTtl: Math.round(ttl / 1000), cacheEverything: true },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    cache.set(url, { at: Date.now(), data });
    backoff.delete(url);
    return data;
  } catch (err) {
    backoff.set(url, Date.now() + RETRY_AFTER);
    errors.push(`${url}: ${err && err.message ? err.message : err}`);
    return hit ? hit.data : null; // stale beats empty
  }
}

const etDay = (d) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: ET, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const espnDate = (d) => etDay(d).replaceAll("-", "");

// ESPN sends scores either as "3" or as { value, displayValue }
function scoreOf(c) {
  const s = c && c.score;
  if (s == null) return null;
  if (typeof s === "object") return s.displayValue ?? (s.value != null ? String(s.value) : null);
  return String(s);
}

function logoOf(team, league) {
  if (!team) return null;
  if (typeof team.logo === "string" && team.logo) return team.logo;
  const href = team.logos && team.logos[0] && team.logos[0].href;
  if (href) return href;
  return team.abbreviation
    ? `https://a.espncdn.com/i/teamlogos/${league.toLowerCase()}/500/${team.abbreviation.toLowerCase()}.png`
    : null;
}

function tvOf(comp) {
  const names = new Set();
  for (const b of (comp && comp.broadcasts) || []) {
    if (b && b.media && b.media.shortName) names.add(b.media.shortName);
    for (const n of (b && b.names) || []) names.add(n);
  }
  return names.size ? [...names].slice(0, 2).join(", ") : null;
}

// Turn one ESPN event into the shape the home page uses, from the NY team's side.
function shapeGame(ev, team) {
  const comp = ev && ev.competitions && ev.competitions[0];
  if (!comp || !ev.date) return null;
  const cs = comp.competitors || [];
  const us = cs.find((c) => c.team && c.team.abbreviation === team.abbr);
  const them = cs.find((c) => c !== us);
  if (!us || !them) return null;

  const status = comp.status || ev.status || {};
  const type = status.type || {};
  const state = type.state === "in" || type.state === "post" ? type.state : "pre";
  const teamScore = state === "pre" ? null : scoreOf(us);
  const oppScore = state === "pre" ? null : scoreOf(them);

  let result = null;
  if (state === "post") {
    if (us.winner === true) result = "W";
    else if (them.winner === true) result = "L";
    else if (teamScore != null && oppScore != null && Number(teamScore) === Number(oppScore)) result = "T";
  }

  return {
    id: String(ev.id),
    start: new Date(ev.date).toISOString(),
    state, // "pre" | "in" | "post"
    detail: type.shortDetail || type.detail || null, // e.g. "8:41 - 2nd", "Final/OT", "10/4 - 1:00 PM EDT"
    isHome: us.homeAway === "home",
    team: {
      name: (us.team && us.team.displayName) || team.label,
      abbr: (us.team && us.team.abbreviation) || team.abbr,
      logo: logoOf(us.team, team.league),
      score: teamScore,
    },
    opponent: {
      name: (them.team && (them.team.shortDisplayName || them.team.displayName)) || "TBD",
      abbr: (them.team && them.team.abbreviation) || null,
      logo: logoOf(them.team, team.league),
      score: oppScore,
    },
    result, // "W" | "L" | "T" | null
    tv: tvOf(comp),
  };
}

// Which game a team's card shows:
// live → today's final → a final from the last ~30h (last night) → today's upcoming
// → latest final this week → next game.  "next" is the following game to tease.
function pick(games, now) {
  const sorted = [...games].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const today = etDay(new Date(now));
  const isToday = (g) => etDay(new Date(g.start)) === today;
  const live = sorted.find((g) => g.state === "in");
  const finals = sorted.filter((g) => g.state === "post" && now - Date.parse(g.start) <= 7 * DAY);
  const todaysFinal = finals.filter(isToday).pop();
  const recentFinal = finals.filter((g) => now - Date.parse(g.start) <= 30 * HOUR).pop();
  const upcoming = sorted.filter((g) => g.state === "pre" && Date.parse(g.start) >= now - 6 * HOUR);
  const todaysUpcoming = upcoming.find(isToday);

  const main = live || todaysFinal || recentFinal || todaysUpcoming || finals[finals.length - 1] || upcoming[0] || null;
  const next = upcoming.find((g) => !main || g.id !== main.id) || null;
  return { main, next };
}

async function buildScores() {
  const errors = [];
  const now = Date.now();
  const days = [espnDate(new Date(now - DAY)), espnDate(new Date(now))];

  // Scoreboards: yesterday + today for each league (live clock, finals). NFL's
  // default scoreboard is the current week, which already covers both.
  const boardUrls = [];
  for (const path of LEAGUE_PATHS) {
    if (path === "football/nfl") boardUrls.push(`https://site.api.espn.com/apis/site/v2/sports/${path}/scoreboard`);
    else for (const d of days) boardUrls.push(`https://site.api.espn.com/apis/site/v2/sports/${path}/scoreboard?dates=${d}`);
  }
  const scheduleUrls = TEAMS.map(
    (t) => `https://site.web.api.espn.com/apis/site/v2/sports/${t.path}/teams/${t.slug}/schedule`,
  );

  const [boards, schedules] = await Promise.all([
    Promise.all(boardUrls.map((u) => getJSON(u, SCOREBOARD_TTL, errors).then((data) => ({ u, data })))),
    Promise.all(scheduleUrls.map((u) => getJSON(u, SCHEDULE_TTL, errors))),
  ]);

  const teams = TEAMS.map((team, i) => {
    const byId = new Map();
    // schedule first (wide range, less live) ...
    for (const ev of (schedules[i] && schedules[i].events) || []) {
      const g = shapeGame(ev, team);
      if (g) byId.set(g.id, g);
    }
    // ... then scoreboards on top (live score + clock win)
    for (const { u, data } of boards) {
      if (!u.includes(`/${team.path}/`)) continue;
      for (const ev of (data && data.events) || []) {
        const g = shapeGame(ev, team);
        if (g) byId.set(g.id, { ...byId.get(g.id), ...g, tv: g.tv || (byId.get(g.id) || {}).tv || null });
      }
    }
    const { main, next } = pick([...byId.values()], now);
    return { key: team.key, label: team.label, league: team.league, main, next };
  });

  // live games first, then the usual team order
  teams.sort((a, b) => Number(b.main && b.main.state === "in") - Number(a.main && a.main.state === "in"));
  const anyLive = teams.some((t) => t.main && t.main.state === "in");
  return { updatedAt: new Date(now).toISOString(), anyLive, teams, errors };
}

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
    if (request.method !== "GET") return new Response("Method not allowed", { status: 405, headers: CORS });

    const url = new URL(request.url);
    try {
      const { errors, ...body } = await buildScores();
      const nothing = body.teams.every((t) => !t.main && !t.next);
      if (nothing && errors.length) {
        return new Response(JSON.stringify({ error: "Scores are unavailable right now", errors }), {
          status: 502,
          headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      }
      const payload = url.searchParams.has("debug") ? { ...body, errors } : body;
      return new Response(JSON.stringify(payload), {
        headers: {
          ...CORS,
          "Content-Type": "application/json",
          // browsers/CDN may reuse a copy briefly; shorter while a game is live
          "Cache-Control": `public, max-age=${body.anyLive ? 15 : 60}`,
        },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: String((err && err.message) || err) }), {
        status: 500,
        headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" },
      });
    }
  },
};
