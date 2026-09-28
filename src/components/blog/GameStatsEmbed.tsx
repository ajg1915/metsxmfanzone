// Live stats inside articles. Writers type a shortcode on its own line:
//   [mlb-game 776543]            line score + Mets standouts for a game
//   [mlb-game today]             today's Mets game (preview, live or final)
//   [mlb-player 624413]          season line for a player
// ArticleBody splits content on these shortcodes and renders this component
// in their place (see renderWithStats below). Data comes from the game-stats
// edge function, which Cloudflare caches, so pages stay fast on game night.
import { useQuery } from "@tanstack/react-query";

const STATS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/game-stats`;
const METS = 121;

export const SHORTCODE = /\[mlb-(game|player)\s+(\d{1,9}|today)\]/g;

async function fetchStats(query: string) {
  const res = await fetch(`${STATS_URL}?${query}`, {
    headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
  });
  if (!res.ok) throw new Error(`Stats ${res.status}`);
  return res.json();
}

function GameBox({ gamePk }: { gamePk: number }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["game-stats", gamePk],
    queryFn: () => fetchStats(`gamePk=${gamePk}`),
    // Poll while the game is live; stop once it's final.
    refetchInterval: (q) => (q.state.data?.summary?.state === "Live" ? 20_000 : false),
  });
  if (isLoading) return <div className="my-4 h-28 animate-pulse rounded-lg bg-muted" />;
  if (isError || !data) return null; // never break the article over stats

  const { summary, linescore, box } = data;
  const mets = box.home.teamId === METS ? box.home : box.away;
  const hitters = [...mets.batters].filter((b: any) => b.h || b.rbi || b.hr).slice(0, 4);
  const pitchers = mets.pitchers.filter((p: any) => p.decision || p.k >= 5).slice(0, 3);

  return (
    <figure className="not-prose my-6 rounded-lg border border-border bg-card p-4 text-sm">
      <figcaption className="mb-3 flex items-center justify-between font-semibold">
        <span>{data.headline}</span>
        {summary.state === "Live" && <span className="rounded bg-red-600 px-2 py-0.5 text-xs text-white">LIVE</span>}
      </figcaption>
      <div className="overflow-x-auto">
        <table className="w-full text-center tabular-nums">
          <thead className="text-muted-foreground">
            <tr>
              <th className="text-left" />
              {linescore.innings.map((i: any) => <th key={i.num}>{i.num}</th>)}
              <th>R</th><th>H</th><th>E</th>
            </tr>
          </thead>
          <tbody>
            {(["away", "home"] as const).map((side) => (
              <tr key={side}>
                <td className="text-left font-medium">{summary[side].abbr}</td>
                {linescore.innings.map((i: any) => <td key={i.num}>{i[side] ?? "-"}</td>)}
                <td className="font-bold">{linescore.totals[side].r}</td>
                <td>{linescore.totals[side].h}</td>
                <td>{linescore.totals[side].e}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(hitters.length > 0 || pitchers.length > 0) && (
        <ul className="mt-3 space-y-1">
          {hitters.map((b: any) => <li key={b.id}><strong>{b.name}</strong> {b.line}</li>)}
          {pitchers.map((p: any) => <li key={p.id}><strong>{p.name}</strong> {p.line}</li>)}
        </ul>
      )}
    </figure>
  );
}

function TodayGame() {
  // Key on the New York date so an open tab moves to the next day's game.
  const date = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const { data } = useQuery({
    queryKey: ["game-stats", "today", date],
    queryFn: () => fetchStats(`teamId=${METS}&date=${date}`),
  });
  const game = data?.games?.[0];
  if (!game) return null;
  return <GameBox gamePk={game.gamePk} />;
}

function PlayerLine({ playerId }: { playerId: number }) {
  const { data } = useQuery({ queryKey: ["player-stats", playerId], queryFn: () => fetchStats(`player=${playerId}`) });
  if (!data?.stats) return null;
  const s = data.stats;
  const line = data.group === "pitching"
    ? `${s.wins ?? 0}-${s.losses ?? 0}, ${s.era} ERA, ${s.inningsPitched} IP, ${s.strikeOuts} K, ${s.whip} WHIP`
    : `${s.avg} AVG, ${s.homeRuns} HR, ${s.rbi} RBI, ${s.ops} OPS, ${s.stolenBases} SB`;
  return (
    <aside className="not-prose my-4 rounded-lg border-l-4 border-primary bg-card px-4 py-3 text-sm">
      <strong>{data.name}</strong> ({data.season}): {line}
    </aside>
  );
}

export default function GameStatsEmbed({ kind, id }: { kind: "game" | "player"; id: string }) {
  if (kind === "player") return <PlayerLine playerId={Number(id)} />;
  if (id === "today") return <TodayGame />;
  return <GameBox gamePk={Number(id)} />;
}

/**
 * Splits article HTML on shortcodes. Use in ArticleBody:
 *   {renderWithStats(html, (h, i) => <div key={i} dangerouslySetInnerHTML={{ __html: h }} />)}
 */
export function renderWithStats(html: string, renderHtml: (h: string, key: number) => JSX.Element) {
  // A shortcode on its own line usually arrives wrapped in <p>; unwrap it so
  // splitting doesn't leave half-open paragraphs behind.
  html = html.replace(/<p[^>]*>\s*(\[mlb-(?:game|player)\s+(?:\d{1,9}|today)\])\s*<\/p>/g, "$1");
  const out: JSX.Element[] = [];
  let last = 0;
  let key = 0;
  for (const m of html.matchAll(SHORTCODE)) {
    out.push(renderHtml(html.slice(last, m.index), key++));
    out.push(<GameStatsEmbed key={key++} kind={m[1] as "game" | "player"} id={m[2]} />);
    last = m.index! + m[0].length;
  }
  out.push(renderHtml(html.slice(last), key++));
  return out;
}
