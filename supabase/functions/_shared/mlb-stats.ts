// MLB Stats API client (statsapi.mlb.com, free, no key). Typed, cached and
// shaped for articles: every function returns small plain objects, and the
// format* helpers turn them into the lines writers use ("2-4, HR, 3 RBI").
//
// Cache: per-isolate memory. Live games 15s, scheduled 5 min, final 24h.
// Put the game-stats endpoint behind Cloudflare with s-maxage for a shared cache.

export const METS_TEAM_ID = 121
const BASE = 'https://statsapi.mlb.com/api'

type CacheEntry = { at: number; ttl: number; value: unknown }
const cache = new Map<string, CacheEntry>()

async function getJson<T>(path: string, ttlMs: number): Promise<T> {
  const hit = cache.get(path)
  if (hit && Date.now() - hit.at < hit.ttl) return hit.value as T
  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${BASE}${path}`, { signal: AbortSignal.timeout(8000) })
      if (res.status === 404) throw Object.assign(new Error('Not found'), { status: 404 })
      if (!res.ok) throw new Error(`MLB API ${res.status} for ${path}`)
      const value = (await res.json()) as T
      cache.set(path, { at: Date.now(), ttl: ttlMs, value })
      return value
    } catch (e) {
      lastError = e
      if ((e as { status?: number }).status === 404) break
      await new Promise((r) => setTimeout(r, 300 * 2 ** attempt))
    }
  }
  if (hit) return hit.value as T // serve stale rather than nothing
  throw lastError
}

// ---------------------------------------------------------------- types

export type GameState = 'Preview' | 'Live' | 'Final'

export type GameSummary = {
  gamePk: number
  date: string // ISO start time
  state: GameState
  detailedState: string // e.g. "In Progress", "Final", "Postponed"
  home: { id: number; name: string; abbr: string; runs: number | null }
  away: { id: number; name: string; abbr: string; runs: number | null }
  venue: string
  inning: string | null // "Top 7th"
  probablePitchers: { home: string | null; away: string | null }
}

export type LineScore = {
  innings: Array<{ num: number; away: number | null; home: number | null }>
  totals: { away: { r: number; h: number; e: number }; home: { r: number; h: number; e: number } }
}

export type BatterLine = {
  id: number; name: string; pos: string
  ab: number; r: number; h: number; hr: number; rbi: number; bb: number; k: number; sb: number
  doubles: number; triples: number; avg: string; ops: string
}

export type PitcherLine = {
  id: number; name: string
  ip: string; h: number; r: number; er: number; bb: number; k: number; hr: number
  pitches: number; strikes: number; era: string; decision: 'W' | 'L' | 'S' | 'H' | null
}

export type TeamBox = { teamId: number; abbr: string; batters: BatterLine[]; pitchers: PitcherLine[] }

export type ScoringPlay = { inning: string; description: string; awayScore: number; homeScore: number }

export type GameDetail = {
  summary: GameSummary
  linescore: LineScore
  box: { away: TeamBox; home: TeamBox }
  scoringPlays: ScoringPlay[]
  decisions: { winner: string | null; loser: string | null; save: string | null }
}

// ---------------------------------------------------------------- schedule

/** Games for a team on a date (YYYY-MM-DD, America/New_York). Handles doubleheaders. */
export async function getGames(date: string, teamId = METS_TEAM_ID): Promise<GameSummary[]> {
  const data = await getJson<any>(
    `/v1/schedule?sportId=1&teamId=${teamId}&date=${date}&hydrate=linescore,probablePitcher,team,venue`,
    60_000,
  )
  return (data.dates?.[0]?.games ?? []).map(toSummary)
}

/** Today's date in New York as YYYY-MM-DD. */
export function todayET(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000)
  return d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
}

function toSummary(g: any): GameSummary {
  const ls = g.linescore ?? {}
  const side = (s: 'home' | 'away') => ({
    id: g.teams[s].team.id,
    name: g.teams[s].team.teamName ?? g.teams[s].team.name,
    abbr: g.teams[s].team.abbreviation ?? '',
    runs: g.teams[s].score ?? ls.teams?.[s]?.runs ?? null,
  })
  return {
    gamePk: g.gamePk,
    date: g.gameDate,
    state: g.status.abstractGameState as GameState,
    detailedState: g.status.detailedState,
    home: side('home'),
    away: side('away'),
    venue: g.venue?.name ?? '',
    inning: ls.currentInning ? `${ls.inningHalf ?? ''} ${ls.currentInningOrdinal ?? ''}`.trim() : null,
    probablePitchers: {
      home: g.teams.home.probablePitcher?.fullName ?? null,
      away: g.teams.away.probablePitcher?.fullName ?? null,
    },
  }
}

// ---------------------------------------------------------------- game detail

/** Full game: line score, both box scores, scoring plays, decisions. */
export async function getGameDetail(gamePk: number): Promise<GameDetail> {
  // Short TTL first; if the game is final, re-cache for a day.
  const path = `/v1.1/game/${gamePk}/feed/live`
  const feed = await getJson<any>(path, 15_000)
  const state = feed.gameData.status.abstractGameState as GameState
  if (state === 'Final') cache.set(path, { at: Date.now(), ttl: 86_400_000, value: feed })

  const ls = feed.liveData.linescore
  const box = feed.liveData.boxscore
  const gd = feed.gameData
  const dec = feed.liveData.decisions ?? {}

  const summary: GameSummary = toSummary({
    gamePk,
    gameDate: gd.datetime.dateTime,
    status: gd.status,
    venue: gd.venue,
    linescore: ls,
    teams: {
      home: { team: gd.teams.home, score: ls.teams?.home?.runs, probablePitcher: gd.probablePitchers?.home },
      away: { team: gd.teams.away, score: ls.teams?.away?.runs, probablePitcher: gd.probablePitchers?.away },
    },
  })

  const allPlays: any[] = feed.liveData.plays?.allPlays ?? []
  // A live feed can list a scoring index before the play itself arrives.
  const scoringPlays = (feed.liveData.plays?.scoringPlays ?? [])
    .map((i: number) => allPlays[i])
    .filter((p: any) => p?.about && p?.result)
    .map((p: any) => ({
      inning: `${p.about.halfInning === 'top' ? 'Top' : 'Bot'} ${p.about.inning}`,
      description: p.result.description,
      awayScore: p.result.awayScore,
      homeScore: p.result.homeScore,
    }))

  return {
    summary,
    linescore: {
      innings: (ls.innings ?? []).map((i: any) => ({ num: i.num, away: i.away?.runs ?? null, home: i.home?.runs ?? null })),
      totals: {
        away: { r: ls.teams?.away?.runs ?? 0, h: ls.teams?.away?.hits ?? 0, e: ls.teams?.away?.errors ?? 0 },
        home: { r: ls.teams?.home?.runs ?? 0, h: ls.teams?.home?.hits ?? 0, e: ls.teams?.home?.errors ?? 0 },
      },
    },
    box: { away: teamBox(box.teams.away, dec), home: teamBox(box.teams.home, dec) },
    scoringPlays,
    decisions: {
      winner: dec.winner?.fullName ?? null,
      loser: dec.loser?.fullName ?? null,
      save: dec.save?.fullName ?? null,
    },
  }
}

function teamBox(t: any, dec: any): TeamBox {
  const player = (id: number) => t.players[`ID${id}`]
  const batters: BatterLine[] = (t.batters ?? [])
    .map(player)
    .filter((p: any) => p?.stats?.batting && Object.keys(p.stats.batting).length)
    .map((p: any) => {
      const b = p.stats.batting
      const s = p.seasonStats?.batting ?? {}
      return {
        id: p.person.id, name: p.person.fullName, pos: p.position?.abbreviation ?? '',
        ab: b.atBats ?? 0, r: b.runs ?? 0, h: b.hits ?? 0, hr: b.homeRuns ?? 0, rbi: b.rbi ?? 0,
        bb: b.baseOnBalls ?? 0, k: b.strikeOuts ?? 0, sb: b.stolenBases ?? 0,
        doubles: b.doubles ?? 0, triples: b.triples ?? 0, avg: s.avg ?? '-', ops: s.ops ?? '-',
      }
    })
  const pitchers: PitcherLine[] = (t.pitchers ?? []).map(player).map((p: any) => {
    const x = p.stats.pitching ?? {}
    const id = p.person.id
    const decision = dec.winner?.id === id ? 'W' : dec.loser?.id === id ? 'L' : dec.save?.id === id ? 'S'
      : (x.holds ?? 0) > 0 ? 'H' : null
    return {
      id, name: p.person.fullName,
      ip: x.inningsPitched ?? '0.0', h: x.hits ?? 0, r: x.runs ?? 0, er: x.earnedRuns ?? 0,
      bb: x.baseOnBalls ?? 0, k: x.strikeOuts ?? 0, hr: x.homeRuns ?? 0,
      pitches: x.numberOfPitches ?? 0, strikes: x.strikes ?? 0,
      era: p.seasonStats?.pitching?.era ?? '-', decision,
    }
  })
  return { teamId: t.team.id, abbr: t.team.abbreviation ?? '', batters, pitchers }
}

// ---------------------------------------------------------------- players

export type SeasonStats = {
  id: number; name: string; group: 'hitting' | 'pitching'; season: number
  stats: Record<string, string | number>
}

/** Season line for a player. group defaults to their primary role. */
export async function getPlayerSeason(
  playerId: number,
  season = new Date().getFullYear(),
  group?: 'hitting' | 'pitching',
): Promise<SeasonStats> {
  const person = (await getJson<any>(`/v1/people/${playerId}`, 86_400_000)).people[0]
  const g = group ?? (person.primaryPosition?.type === 'Pitcher' ? 'pitching' : 'hitting')
  const data = await getJson<any>(`/v1/people/${playerId}/stats?stats=season&group=${g}&season=${season}`, 600_000)
  return { id: playerId, name: person.fullName, group: g, season, stats: data.stats?.[0]?.splits?.[0]?.stat ?? {} }
}

// ---------------------------------------------------------------- formatters

const plural = (n: number, s: string) => (n > 1 ? `${n} ${s}` : s)

/** "2-4, HR, 2B, 3 RBI, BB" */
export function formatBatter(b: BatterLine): string {
  const parts = [`${b.h}-${b.ab}`]
  if (b.hr) parts.push(plural(b.hr, 'HR'))
  if (b.triples) parts.push(plural(b.triples, '3B'))
  if (b.doubles) parts.push(plural(b.doubles, '2B'))
  if (b.rbi) parts.push(`${b.rbi} RBI`)
  if (b.r) parts.push(plural(b.r, 'R'))
  if (b.bb) parts.push(plural(b.bb, 'BB'))
  if (b.sb) parts.push(plural(b.sb, 'SB'))
  return parts.join(', ')
}

/** "6.0 IP, 4 H, 2 ER, 1 BB, 8 K (W)" */
export function formatPitcher(p: PitcherLine): string {
  const line = `${p.ip} IP, ${p.h} H, ${p.er} ER, ${p.bb} BB, ${p.k} K`
  return p.decision ? `${line} (${p.decision})` : line
}

/** "Mets 5, Braves 3 (Final)" */
export function formatScore(s: GameSummary): string {
  return `${s.away.name} ${s.away.runs ?? 0}, ${s.home.name} ${s.home.runs ?? 0} (${s.inning && s.state === 'Live' ? s.inning : s.detailedState})`
}

/** Top performers for one team, for recaps and prompts. */
export function standouts(box: TeamBox, limit = 3): { hitters: string[]; pitchers: string[] } {
  const score = (b: BatterLine) => b.hr * 4 + b.rbi * 2 + b.h + b.r + b.sb
  const hitters = [...box.batters].sort((a, b) => score(b) - score(a)).filter((b) => score(b) > 1).slice(0, limit)
  const pitchers = box.pitchers.filter((p) => p.decision || p.k >= 6 || parseFloat(p.ip) >= 6)
  return {
    hitters: hitters.map((b) => `${b.name}: ${formatBatter(b)}`),
    pitchers: pitchers.map((p) => `${p.name}: ${formatPitcher(p)}`),
  }
}
