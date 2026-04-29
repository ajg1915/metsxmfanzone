/**
 * MetsXMFanZone — Cloudflare Cron Worker
 *
 * Offloads high-frequency background jobs from Supabase pg_cron to Cloudflare.
 * Cloudflare Cron Triggers are free up to 5M invocations/month.
 *
 * REQUIRED ENV VARS (set in Cloudflare dashboard → Worker → Settings → Variables):
 *   SUPABASE_URL                 = https://clwghkbtkofacsjeyrtk.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY    = (secret) service role key — full DB access
 *   SUPABASE_ANON_KEY            = (secret) anon key — used to invoke edge functions
 *   CRON_SHARED_SECRET           = (secret) random string, also added to edge functions
 *                                  if you want to require it via X-Cron-Secret header
 *
 * Mark SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, and CRON_SHARED_SECRET as
 * "Encrypted" (Secrets) in Cloudflare — NEVER as plain text Variables.
 *
 * CRON SCHEDULES (defined in wrangler.toml — all UTC):
 *   "*/10 19-23,0-3 * * *"  → game-window polling (alerts + final scores)
 *   "0 * * * *"              → hourly pregame check
 *   "0 14 * * *"             → morning game alerts (10am ET)
 *   "0 18-23,0-3 * * *"      → lineup fetch (game window)
 *   "0 6 * * *"              → daily standings update
 *   "0 12 * * *"             → daily news fetch
 *   "0 16 * * *"             → daily stream status sync
 */

const METS_TEAM_ID = 121;

// ---------- Helpers ----------

async function invokeEdgeFunction(env, fnName, body = {}) {
  const url = `${env.SUPABASE_URL}/functions/v1/${fnName}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${env.SUPABASE_ANON_KEY}`,
      "X-Cron-Secret": env.CRON_SHARED_SECRET ?? "",
      "X-Triggered-By": "cloudflare-cron",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { fn: fnName, status: res.status, ok: res.ok, body: text.slice(0, 300) };
}

// Direct-to-Supabase write using the REST API (no client lib needed in Workers).
async function supabaseUpsert(env, table, rows, onConflict) {
  const url = `${env.SUPABASE_URL}/rest/v1/${table}` +
    (onConflict ? `?on_conflict=${onConflict}` : "");
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": env.SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Prefer": onConflict ? "resolution=merge-duplicates,return=minimal"
                           : "return=minimal",
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase upsert ${table} failed ${res.status}: ${err}`);
  }
  return { table, rowsWritten: rows.length };
}

// ---------- Direct MLB → Supabase (example: NL East standings) ----------

async function updateStandingsDirect(env) {
  // NL East = league 104, division 204
  const url = "https://statsapi.mlb.com/api/v1/standings?leagueId=104&season=2026&standingsTypes=regularSeason";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`MLB standings fetch failed: ${res.status}`);
  const data = await res.json();

  const rows = [];
  for (const record of data.records ?? []) {
    for (const team of record.teamRecords ?? []) {
      rows.push({
        team_id: team.team.id,
        team_name: team.team.name,
        division_id: record.division?.id,
        wins: team.wins,
        losses: team.losses,
        winning_percentage: parseFloat(team.winningPercentage ?? "0"),
        games_back: team.gamesBack === "-" ? 0 : parseFloat(team.gamesBack ?? "0"),
        streak: team.streak?.streakCode ?? null,
        last_updated: new Date().toISOString(),
      });
    }
  }
  if (rows.length === 0) return { table: "standings", rowsWritten: 0 };
  // NOTE: requires a `standings` table with `team_id` UNIQUE. If your table
  // name/schema differs, adjust here OR keep using the `update-standings`
  // edge-function path below instead.
  return await supabaseUpsert(env, "standings", rows, "team_id");
}

// ---------- Cron router ----------

async function runScheduled(cron, env) {
  const results = [];
  const safe = async (label, p) => {
    try { results.push({ label, ...(await p) }); }
    catch (e) { results.push({ label, error: String(e) }); }
  };

  switch (cron) {
    // Every 10 min during game window (19-03 UTC ≈ 3pm-11pm ET)
    case "*/10 19-23,0-3 * * *":
      await safe("alert_20min",
        invokeEdgeFunction(env, "auto-game-alerts", { triggerType: "pregame_20min" }));
      await safe("alert_5min",
        invokeEdgeFunction(env, "auto-game-alerts", { triggerType: "pregame_5min" }));
      await safe("final_scores",
        invokeEdgeFunction(env, "auto-game-alerts", { triggerType: "final_score" }));
      break;

    // Hourly pregame check
    case "0 * * * *":
      await safe("alert_pregame",
        invokeEdgeFunction(env, "auto-game-alerts", { triggerType: "pregame" }));
      break;

    // 10am ET morning game alerts
    case "0 14 * * *":
      await safe("alert_morning",
        invokeEdgeFunction(env, "auto-game-alerts", { triggerType: "morning" }));
      break;

    // Lineup fetch — every hour during game window
    case "0 18-23,0-3 * * *":
      await safe("lineups",
        invokeEdgeFunction(env, "scheduled-lineup-fetch", { triggered: "cloudflare-cron" }));
      break;

    // Daily 6am UTC standings update
    case "0 6 * * *":
      // Direct write — keeps load entirely off Supabase edge functions
      await safe("standings_direct", updateStandingsDirect(env));
      // Fallback / belt-and-suspenders: also call your edge function so any
      // downstream notifications still fire. Comment out if you don't need it.
      await safe("standings_fn",
        invokeEdgeFunction(env, "update-standings"));
      break;

    // Daily news fetch (noon UTC)
    case "0 12 * * *":
      await safe("news",
        invokeEdgeFunction(env, "fetch-mets-news"));
      break;

    // Daily stream status sync (4pm UTC)
    case "0 16 * * *":
      await safe("stream_status",
        invokeEdgeFunction(env, "auto-stream-status"));
      break;

    default:
      results.push({ label: "unknown_cron", cron });
  }

  console.log(JSON.stringify({ cron, results }));
  return results;
}

// ---------- Worker entry points ----------

export default {
  // Cron Trigger
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runScheduled(event.cron, env));
  },

  // Manual trigger via HTTPS (for testing). Protected by CRON_SHARED_SECRET.
  async fetch(req, env) {
    const url = new URL(req.url);
    const provided = req.headers.get("X-Cron-Secret") || url.searchParams.get("secret");
    if (!env.CRON_SHARED_SECRET || provided !== env.CRON_SHARED_SECRET) {
      return new Response("Forbidden", { status: 403 });
    }
    const cron = url.searchParams.get("cron");
    if (!cron) {
      return new Response("Provide ?cron=... matching a wrangler.toml schedule", { status: 400 });
    }
    const results = await runScheduled(cron, env);
    return new Response(JSON.stringify({ ok: true, results }, null, 2), {
      headers: { "Content-Type": "application/json" },
    });
  },
};
