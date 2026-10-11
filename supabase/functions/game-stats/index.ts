// Public read-only stats endpoint for articles, game previews and widgets.
//   GET /game-stats?date=2026-09-27[&teamId=121]  -> games that day
//   GET /game-stats?gamePk=776543                 -> line score, box, scoring plays
//   GET /game-stats?player=624413[&season=2026]   -> season line
// Cache-Control lets Cloudflare hold responses at the edge: 15s while a game
// is live, 1 day once it's final.
import {
  getGames, getGameDetail, getPlayerSeason, todayET, METS_TEAM_ID,
  formatBatter, formatPitcher, formatScore,
} from '../_shared/mlb-stats.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const reply = (body: unknown, maxAge: number, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors,
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=${Math.min(maxAge, 60)}, s-maxage=${maxAge}, stale-while-revalidate=30`,
    },
  })

const intParam = (v: string | null) => (v && /^\d{1,9}$/.test(v) ? Number(v) : null)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  if (req.method !== 'GET') return reply({ error: 'Method not allowed' }, 0, 405)

  const q = new URL(req.url).searchParams
  try {
    const gamePk = intParam(q.get('gamePk'))
    if (gamePk) {
      const g = await getGameDetail(gamePk)
      const withLines = (t: typeof g.box.home) => ({
        ...t,
        batters: t.batters.map((b) => ({ ...b, line: formatBatter(b) })),
        pitchers: t.pitchers.map((p) => ({ ...p, line: formatPitcher(p) })),
      })
      const body = { ...g, headline: formatScore(g.summary), box: { away: withLines(g.box.away), home: withLines(g.box.home) } }
      return reply(body, g.summary.state === 'Final' ? 86_400 : g.summary.state === 'Live' ? 15 : 300)
    }

    const playerId = intParam(q.get('player'))
    if (playerId) {
      return reply(await getPlayerSeason(playerId, intParam(q.get('season')) ?? undefined), 600)
    }

    const date = q.get('date') ?? todayET()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return reply({ error: 'date must be YYYY-MM-DD' }, 0, 400)
    const games = await getGames(date, intParam(q.get('teamId')) ?? METS_TEAM_ID)
    const anyLive = games.some((g) => g.state === 'Live')
    return reply({ date, games: games.map((g) => ({ ...g, headline: formatScore(g) })) }, anyLive ? 15 : 120)
  } catch (e) {
    const status = (e as { status?: number }).status === 404 ? 404 : 502
    console.error('game-stats failed', (e as Error).message)
    return reply({ error: status === 404 ? 'Not found' : 'Stats temporarily unavailable' }, 0, status)
  }
})
