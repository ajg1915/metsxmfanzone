// Article prompts for the admin.
//   { "mode": "postgame" }  every 10 min: once a Mets game goes Final, send the
//                           compiled stats + suggested headlines (once per game).
//   { "mode": "morning" }   8 AM ET: last night's result, today's preview,
//                           overnight rumors and suggested topics.
import { createServiceClient } from '../_shared/queue-email.ts'
import { notifyAdmin, requireCronSecret } from '../_shared/admin-notify.ts'
import {
  getGames, getGameDetail, todayET, standouts, formatScore, METS_TEAM_ID,
  type GameDetail, type GameSummary,
} from '../_shared/mlb-stats.ts'

const ordinal = (n: number) => {
  const tens = n % 100
  if (tens >= 11 && tens <= 13) return `${n}th`
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`
}

const lastName = (s: string) => s.split(':')[0].trim().split(' ').slice(-1)[0]

function metsSide(g: GameSummary) {
  const metsHome = g.home.id === METS_TEAM_ID
  const mets = metsHome ? g.home : g.away
  const opp = metsHome ? g.away : g.home
  return { metsHome, mets, opp, won: (mets.runs ?? 0) > (opp.runs ?? 0) }
}

function suggestHeadlines(d: GameDetail): string[] {
  const { metsHome, mets, opp, won } = metsSide(d.summary)
  const m = mets.runs ?? 0
  const o = opp.runs ?? 0
  const box = metsHome ? d.box.home : d.box.away
  const star = standouts(box, 1).hitters[0]
  const ace = standouts(box).pitchers.find((p) => p.includes('(W)') || p.includes('(L)'))
  const last = d.scoringPlays.at(-1)
  const before = d.scoringPlays.at(-2)
  // Walk-off: the Mets' final scoring play came in the bottom of the 9th or
  // later and turned a tie or deficit into the win.
  const walkOff = won && metsHome && last && /^Bot (9|1\d)/.test(last.inning)
    && (before ? before.homeScore <= before.awayScore : true)
  const out: string[] = []
  if (walkOff) out.push(`Walk-off! Mets stun the ${opp.name} ${m}-${o} in the ${ordinal(Number(last!.inning.replace('Bot ', '')))}`)
  if (won) {
    if (o === 0) out.push(`Mets blank the ${opp.name} ${m}-0${ace ? ` as ${lastName(ace)} deals` : ''}`)
    if (star) out.push(`${lastName(star)} powers Mets past ${opp.name}, ${m}-${o}`)
    out.push(`Mets take down the ${opp.name} ${m}-${o}: takeaways and grades`)
  } else {
    out.push(`Mets fall to the ${opp.name} ${o}-${m}: what went wrong`)
    if (star) out.push(`${lastName(star)}'s big night not enough as Mets drop one to ${opp.name}`)
    out.push(`Mets vs. ${opp.name} recap: turning point, grades and what's next`)
  }
  return out.slice(0, 3)
}

function gameBrief(d: GameDetail): string {
  const { metsHome } = metsSide(d.summary)
  const mine = standouts(metsHome ? d.box.home : d.box.away)
  const theirs = standouts(metsHome ? d.box.away : d.box.home, 2)
  return [
    `📊 ${formatScore(d.summary)}`,
    d.decisions.winner ? `W: ${d.decisions.winner} · L: ${d.decisions.loser}${d.decisions.save ? ` · S: ${d.decisions.save}` : ''}` : '',
    '',
    'Mets standouts',
    ...[...mine.hitters, ...mine.pitchers].map((l) => `• ${l}`),
    theirs.hitters.length ? `Opponent: ${theirs.hitters.join('; ')}` : '',
    '',
    'Key scoring plays',
    ...d.scoringPlays.slice(-4).map((p) => `• ${p.inning}: ${p.description}`),
    '',
    '✍️ Suggested headlines',
    ...suggestHeadlines(d).map((h) => `• ${h}`),
    '',
    `Embed live stats in the article with: [mlb-game ${d.summary.gamePk}]`,
  ].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n')
}

async function postgame(supabase: any) {
  // Yesterday too, so a game that ends after midnight is still caught.
  const games = [...(await getGames(todayET(-1))), ...(await getGames(todayET()))]
  const finals = games.filter((g) =>
    g.state === 'Final' && !/postponed|cancel/i.test(g.detailedState) && Date.now() - Date.parse(g.date) < 14 * 3_600_000)
  const sent: number[] = []
  for (const g of finals) {
    const d = await getGameDetail(g.gamePk)
    const { opp, won } = metsSide(d.summary)
    const r = await notifyAdmin(supabase, {
      dedupeKey: `postgame:${g.gamePk}`,
      kind: 'postgame',
      title: `${won ? '🟢 Mets win' : '🔴 Mets lose'} vs ${opp.name}: time to write the recap`,
      body: gameBrief(d),
      url: 'https://www.metsxmfanzone.com/admin/blog',
      payload: { gamePk: g.gamePk },
    })
    if (r.sent) sent.push(g.gamePk)
  }
  return { finals: finals.length, sent }
}

async function morning(supabase: any) {
  const [yesterday, today] = await Promise.all([getGames(todayET(-1)), getGames(todayET())])
  const lines: string[] = []
  const topics: string[] = []

  for (const g of yesterday.filter((x) => x.state === 'Final')) {
    const d = await getGameDetail(g.gamePk)
    const { opp, won } = metsSide(d.summary)
    lines.push(`🌙 Last night: ${formatScore(d.summary)}`)
    const mine = standouts(d.summary.home.id === METS_TEAM_ID ? d.box.home : d.box.away, 2)
    lines.push(...[...mine.hitters, ...mine.pitchers].map((l) => `   • ${l}`))
    topics.push(won ? `What last night's win over the ${opp.name} tells us` : `Three fixes after the loss to the ${opp.name}`)
  }

  for (const g of today) {
    const { metsHome, opp } = metsSide(g)
    const time = new Date(g.date).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' })
    const probable = metsHome ? [g.probablePitchers.home, g.probablePitchers.away] : [g.probablePitchers.away, g.probablePitchers.home]
    lines.push(`⚾ Today: ${metsHome ? 'vs' : '@'} ${opp.name}, ${time} ET at ${g.venue}`)
    if (probable[0] || probable[1]) lines.push(`   Probables: ${probable[0] ?? 'TBD'} vs ${probable[1] ?? 'TBD'}`)
    topics.push(`Game preview: Mets ${metsHome ? 'vs' : 'at'} ${opp.name}, keys to the game`)
    lines.push(`   Embed in the preview: [mlb-game ${g.gamePk}]`)
  }
  if (!today.length) {
    lines.push('⚾ No Mets game today.')
    topics.push('Off-day mailbag or roster outlook')
  }

  const { data: rumors } = await supabase
    .from('admin_alerts')
    .select('title')
    .eq('kind', 'rumor')
    .gte('created_at', new Date(Date.now() - 24 * 3_600_000).toISOString())
    .order('created_at', { ascending: false })
    .limit(5)
  if (rumors?.length) {
    lines.push('', '📰 Overnight news')
    lines.push(...rumors.map((r: { title: string }) => `   • ${r.title.replace(/^.*detected: /, '').replace(/ — Time to write.*$/, '')}`))
    topics.push('Rumor roundup: what the latest reports mean for the Mets')
  }

  lines.push('', '✍️ Suggested topics', ...topics.map((t) => `   • ${t}`))
  return notifyAdmin(supabase, {
    dedupeKey: `morning:${todayET()}`,
    kind: 'morning',
    title: `☀️ Morning brief · ${todayET()}`,
    body: lines.join('\n'),
    url: 'https://www.metsxmfanzone.com/admin/blog',
  })
}

Deno.serve(async (req) => {
  const denied = requireCronSecret(req)
  if (denied) return denied
  const supabase = createServiceClient()
  const { mode } = await req.json().catch(() => ({ mode: null }))
  try {
    const result = mode === 'morning' ? await morning(supabase) : mode === 'postgame' ? await postgame(supabase) : null
    if (!result) return new Response(JSON.stringify({ error: 'mode must be postgame or morning' }), { status: 400 })
    return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error('admin-prompts failed', mode, (e as Error).message)
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500 })
  }
})
