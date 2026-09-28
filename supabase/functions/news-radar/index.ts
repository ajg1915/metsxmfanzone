// Breaking news / trade rumor radar. Runs every 10 minutes (pg_cron).
// Reads Mets news feeds, scores each new headline for high-volatility
// keywords, and pings the admin once per story:
//   🚨 Breaking trade rumor detected: <headline> — Time to write your report!
// Feeds can be overridden with a site_settings row `news_radar_feeds`
// (JSON array of RSS/Atom URLs).
import { createServiceClient } from '../_shared/queue-email.ts'
import { notifyAdmin, requireCronSecret } from '../_shared/admin-notify.ts'

const DEFAULT_FEEDS = [
  'https://www.mlbtraderumors.com/new-york-mets/feed',
  'https://www.mlb.com/mets/feeds/news/rss.xml',
  'https://news.google.com/rss/search?q=Mets+(trade+OR+rumor+OR+injury+OR+%22injured+list%22+OR+DFA+OR+signs)+when:1d&hl=en-US&gl=US&ceid=US:en',
]
const MAX_AGE_MS = 6 * 3_600_000
const MAX_ALERTS_PER_RUN = 5

type Topic = 'trade' | 'injury' | 'roster'
const RULES: Array<{ topic: Topic; weight: number; re: RegExp }> = [
  { topic: 'trade', weight: 3, re: /\btrade (rumou?rs?|talks?|target|deadline)\b|\b(acquire[sd]?|deal for|in talks|interest in|linked to|pursuing|swap)\b/i },
  { topic: 'trade', weight: 2, re: /\b(trade[sd]?|rumou?rs?|sources say|per sources)\b/i },
  { topic: 'injury', weight: 3, re: /\b(injured list|IL|MRI|surgery|torn|fracture[sd]?|strain|sprain|out for (the )?season)\b/i },
  { topic: 'injury', weight: 2, re: /\b(injur(y|ed|ies)|day-to-day|scratched|left the game)\b/i },
  { topic: 'roster', weight: 3, re: /\b(DFA'?d?|designate[sd]? .{0,30}for assignment|calls? up|called up|recall(s|ed)?|option(s|ed)?|select(s|ed)? the contract|release[sd]?|waivers|claim(s|ed)?)\b/i },
  { topic: 'roster', weight: 2, re: /\b(roster move|signs?|agree(s|d)? to|extension|promot(ed|ion))\b/i },
]
const HEADLINE: Record<Topic, (t: string) => string> = {
  trade: (t) => `🚨 Breaking trade rumor detected: ${t} — Time to write your report!`,
  injury: (t) => `🚑 Injury update detected: ${t} — Time to write your report!`,
  roster: (t) => `🔁 Roster move detected: ${t} — Time to write your report!`,
}

type Item = { title: string; link: string; summary: string; published: number; source: string }

const decode = (s: string) =>
  s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&#8217;/g, "'")
    .replace(/\s+/g, ' ').trim()

const tag = (block: string, name: string) => block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'))?.[1] ?? ''

function parseFeed(xml: string, source: string): Item[] {
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>|<entry[\s>][\s\S]*?<\/entry>/gi) ?? []
  return blocks.map((b) => {
    const link = decode(tag(b, 'link')) || (b.match(/<link[^>]*href="([^"]+)"/i)?.[1] ?? '')
    const date = tag(b, 'pubDate') || tag(b, 'published') || tag(b, 'updated') || tag(b, 'dc:date')
    return {
      title: decode(tag(b, 'title')),
      link,
      summary: decode(tag(b, 'description') || tag(b, 'summary')).slice(0, 400),
      published: Date.parse(decode(date)) || 0,
      source,
    }
  }).filter((i) => i.title && i.link)
}

function score(item: Item): { topic: Topic; score: number } | null {
  const text = `${item.title} ${item.summary}`
  // Team-specific feeds are about the Mets already; general feeds must say so.
  if (!/mets/i.test(item.source) && !/\bmets\b/i.test(text)) return null
  const totals: Record<Topic, number> = { trade: 0, injury: 0, roster: 0 }
  for (const r of RULES) if (r.re.test(text)) totals[r.topic] += r.weight
  const [topic, best] = (Object.entries(totals) as Array<[Topic, number]>).sort((a, b) => b[1] - a[1])[0]
  return best >= 3 ? { topic, score: best } : null
}

async function storyKey(title: string) {
  // Same headline syndicated across feeds -> one alert.
  const norm = title.toLowerCase().replace(/\s[-|–]\s[^-|–]+$/, '').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(norm))
  return Array.from(new Uint8Array(hash).slice(0, 12), (b) => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  const denied = requireCronSecret(req)
  if (denied) return denied
  const supabase = createServiceClient()

  const { data: setting } = await supabase.from('site_settings').select('setting_value').eq('setting_key', 'news_radar_feeds').maybeSingle()
  let feeds = DEFAULT_FEEDS
  try {
    const custom = typeof setting?.setting_value === 'string' ? JSON.parse(setting.setting_value) : setting?.setting_value
    if (Array.isArray(custom) && custom.length) feeds = custom
  } catch { /* keep defaults */ }

  const feedErrors: string[] = []
  const items = (await Promise.all(feeds.map(async (url) => {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'MetsXMFanZone news radar' }, signal: AbortSignal.timeout(10_000) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return parseFeed(await res.text(), url)
    } catch (e) {
      feedErrors.push(`${new URL(url).hostname}: ${(e as Error).message}`)
      return []
    }
  }))).flat()

  const fresh = items
    .filter((i) => Date.now() - i.published < MAX_AGE_MS)
    .map((i) => ({ item: i, hit: score(i) }))
    .filter((x): x is { item: Item; hit: { topic: Topic; score: number } } => x.hit !== null)
    .sort((a, b) => b.hit.score - a.hit.score || b.item.published - a.item.published)

  let sent = 0
  const itemErrors: string[] = []
  for (const { item, hit } of fresh) {
    if (sent >= MAX_ALERTS_PER_RUN) break
    // One malformed link or failed alert must not stop the rest of the run.
    try {
      const link = new URL(item.link, item.source)
      const r = await notifyAdmin(supabase, {
        dedupeKey: `rumor:${await storyKey(item.title)}`,
        kind: 'rumor',
        title: HEADLINE[hit.topic](item.title),
        body: `${item.summary ? `${item.summary}\n` : ''}Source: ${link.hostname}`,
        url: link.href,
        payload: { topic: hit.topic, score: hit.score, source: item.source },
      })
      if (r.sent) sent++
    } catch (e) {
      itemErrors.push(`${item.title.slice(0, 60)}: ${(e as Error).message}`)
    }
  }

  return new Response(JSON.stringify({ scanned: items.length, candidates: fresh.length, sent, feedErrors, itemErrors }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
