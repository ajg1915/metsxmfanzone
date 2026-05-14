/**
 * MetsXMFanZone — Gamecast Recap Worker
 *
 * Runs on a Cloudflare Cron Trigger. For each finished Mets game it:
 *   1. Calls the `archive-gamecast` Supabase edge function to save the full
 *      play-by-play, line score, box score, and decisions into the
 *      `gamecast_archives` table (idempotent — safe to re-run).
 *   2. Reads any archived games that don't yet have a recap.
 *   3. Generates a recap with YOUR OWN AI provider key (OpenAI by default)
 *      so it does NOT count against the Lovable AI Gateway quota.
 *   4. Inserts the recap into `game_recaps` and marks the archive done.
 *
 * ──────────────────────────────────────────────────────────────────────────
 *  wrangler.toml example:
 *
 *    name = "mets-recap-worker"
 *    main = "gamecast-recap-worker.js"
 *    compatibility_date = "2025-01-01"
 *
 *    [triggers]
 *    crons = ["0 13 * * *"]   # 9:00 AM ET daily
 *
 *    [vars]
 *    SUPABASE_URL = "https://clwghkbtkofacsjeyrtk.supabase.co"
 *
 *  Then add secrets (NOT committed):
 *    wrangler secret put SUPABASE_SERVICE_ROLE_KEY
 *    wrangler secret put GEMINI_API_KEY
 *
 *  Get a Gemini API key at: https://aistudio.google.com/apikey
 *
 *  You can also POST to the worker URL with { "date": "2026-04-15" } to
 *  backfill a specific day.
 * ──────────────────────────────────────────────────────────────────────────
 */

const MODEL = "gemini-2.5-flash"; // fast + cheap; use "gemini-2.5-pro" for higher quality

const yesterdayET = () => {
  const ny = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
  ny.setDate(ny.getDate() - 1);
  return ny.toISOString().slice(0, 10);
};

const slugify = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 90);

async function archiveDay(env, date) {
  const res = await fetch(`${env.SUPABASE_URL}/functions/v1/archive-gamecast`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    },
    body: JSON.stringify({ date }),
  });
  if (!res.ok) throw new Error(`archive-gamecast ${res.status}: ${await res.text()}`);
  return res.json();
}

async function fetchPendingArchives(env, date) {
  const url =
    `${env.SUPABASE_URL}/rest/v1/gamecast_archives` +
    `?game_date=eq.${date}&recap_generated=eq.false&select=*`;
  const res = await fetch(url, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`fetch archives ${res.status}`);
  return res.json();
}

function buildContext(arc) {
  // Trim plays to scoring + key events to keep token cost low.
  const scoring = (arc.plays || []).filter(
    (p) => p?.about?.isScoringPlay || (p?.result?.rbi ?? 0) > 0
  );
  const keyEvents = (arc.plays || []).filter((p) => {
    const e = (p?.result?.eventType || "").toLowerCase();
    return /home_run|triple|double|strikeout|walk|stolen_base|error/.test(e);
  });

  const teamSide = arc.home_away === "home" ? "home" : "away";
  const players =
    arc.boxscore?.teams?.[teamSide]?.players ?? {};
  const topBatters = Object.values(players)
    .map((p) => ({
      name: p?.person?.fullName,
      stats: p?.stats?.batting,
    }))
    .filter((p) => p.stats?.atBats > 0)
    .slice(0, 8);

  return {
    date: arc.game_date,
    opponent: arc.opponent,
    venue: arc.venue,
    homeAway: arc.home_away,
    final: { mets: arc.mets_score, opponent: arc.opponent_score, result: arc.result },
    decisions: {
      win: arc.winning_pitcher,
      loss: arc.losing_pitcher,
      save: arc.save_pitcher,
    },
    innings: arc.linescore?.innings?.map((i) => ({
      inning: i.num,
      home: i.home?.runs,
      away: i.away?.runs,
    })),
    topBatters,
    scoringPlays: scoring.slice(0, 25).map((p) => ({
      inning: `${p.about?.halfInning} ${p.about?.inning}`,
      desc: p.result?.description,
      score: `${p.result?.awayScore}-${p.result?.homeScore}`,
    })),
    keyEvents: keyEvents.slice(0, 15).map((p) => ({
      inning: `${p.about?.halfInning} ${p.about?.inning}`,
      event: p.result?.event,
      desc: p.result?.description,
    })),
  };
}

async function generateRecapWithGemini(env, context) {
  const prompt = `You are a Mets beat writer for MetsXMFanZone. Write a sharp, fan-focused recap of this game.

GAME CONTEXT (JSON):
${JSON.stringify(context, null, 2)}

Return STRICT JSON matching this schema:
{
  "title": "Catchy headline under 80 chars including final score",
  "summary": "1-2 sentence TL;DR (max 200 chars)",
  "body": "<p>...</p> ...HTML body 350-500 words. Use <p>, <strong>, <h3> only. Cover key moments, standout players, pitching, and what's next."
}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${env.GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      systemInstruction: {
        parts: [{ text: "You write concise, accurate MLB recaps. Always return valid JSON only, no markdown fences." }],
      },
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.7,
      },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const ai = await res.json();
  const text = ai?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  return JSON.parse(text.replace(/^```json\s*|\s*```$/g, "").trim());
}

async function insertRecap(env, arc, ai) {
  const slug = slugify(
    `mets-${arc.result === "W" ? "beat" : arc.result === "L" ? "fall-to" : "tie"}-${arc.opponent}-${arc.game_date}-${arc.game_pk}`
  );

  const row = {
    title:
      ai.title ||
      `Mets ${arc.result === "W" ? "beat" : "fall to"} ${arc.opponent} ${arc.mets_score}-${arc.opponent_score}`,
    slug,
    opponent: arc.opponent,
    game_date: arc.game_date,
    home_away: arc.home_away,
    mets_score: arc.mets_score,
    opponent_score: arc.opponent_score,
    result: arc.result,
    summary: ai.summary || null,
    body: ai.body || null,
    hero_image_url: "https://www.mlbstatic.com/team-logos/121.svg",
    status: "published",
    published_at: new Date().toISOString(),
  };

  const upsert = await fetch(
    `${env.SUPABASE_URL}/rest/v1/game_recaps?on_conflict=slug`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify(row),
    }
  );
  if (!upsert.ok) throw new Error(`recap upsert ${upsert.status}: ${await upsert.text()}`);
  const [recap] = await upsert.json();

  // Mark archive done
  await fetch(
    `${env.SUPABASE_URL}/rest/v1/gamecast_archives?game_pk=eq.${arc.game_pk}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ recap_generated: true, recap_id: recap.id }),
    }
  );

  return recap;
}

async function runForDate(env, date) {
  const out = { date, archived: null, recaps: [] };
  out.archived = await archiveDay(env, date);

  const pending = await fetchPendingArchives(env, date);
  for (const arc of pending) {
    try {
      const ctx = buildContext(arc);
      const ai = await generateRecapWithGemini(env, ctx);
      const recap = await insertRecap(env, arc, ai);
      out.recaps.push({ game_pk: arc.game_pk, slug: recap.slug, ok: true });
    } catch (e) {
      out.recaps.push({ game_pk: arc.game_pk, ok: false, error: e.message });
    }
  }
  return out;
}

export default {
  // Cron entry point
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runForDate(env, yesterdayET()));
  },

  // HTTP entry point — POST { "date": "YYYY-MM-DD" } to backfill
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("POST { date: 'YYYY-MM-DD' } to run", { status: 405 });
    }
    const body = await request.json().catch(() => ({}));
    const date = body.date || yesterdayET();
    const result = await runForDate(env, date);
    return new Response(JSON.stringify(result, null, 2), {
      headers: { "Content-Type": "application/json" },
    });
  },
};
