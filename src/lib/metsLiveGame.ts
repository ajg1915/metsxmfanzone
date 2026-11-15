import { useEffect, useRef, useState } from "react";

/**
 * Live Mets game data for the stream pages, read straight from MLB's public Stats API
 * (the same source the Gamecast page uses). No server, no database.
 */

const API = "https://statsapi.mlb.com/api";
export const METS_ID = 121;

export type LiveState = "loading" | "live" | "final" | "pregame" | "offair" | "offseason";

type Side = "away" | "home";

export interface TeamChip {
  id: number;
  abbr: string;
  name: string;
}

export interface BatterLine {
  id: number;
  name: string;
  pos: string;
  ab: number;
  r: number;
  h: number;
  rbi: number;
  bb: number;
  k: number;
  avg?: string;
}

export interface PitcherLine {
  id: number;
  name: string;
  ip: string;
  h: number;
  er: number;
  bb: number;
  k: number;
  pitches: number;
  era?: string;
}

export interface PitchEvent {
  n: number;
  type: string;
  mph?: number;
  call: string;
  kind: "ball" | "strike" | "inplay";
}

export interface PlayItem {
  inning: number;
  half: string;
  text: string;
  scoring: boolean;
}

export interface GameView {
  gamePk: number;
  final: boolean;
  statusText: string;
  away: TeamChip;
  home: TeamChip;
  runs: { away: number; home: number };
  hits: { away: number; home: number };
  errors: { away: number; home: number };
  innings: Array<{ num: number; away?: number; home?: number }>;
  inningLabel: string; // "7th", "Final"
  isTop: boolean;
  outs: number;
  balls: number;
  strikes: number;
  bases: { first: boolean; second: boolean; third: boolean };
  batter?: {
    id: number;
    name: string;
    pos: string;
    side?: string;
    today: string;
    avg?: string;
    hr?: string;
    rbi?: string;
    ops?: string;
  };
  pitcher?: { id: number; name: string; hand?: string; ip: string; k: number; pitches: number; era?: string };
  pitches: PitchEvent[];
  metsSide: Side;
  batting: { away: BatterLine[]; home: BatterLine[] };
  pitching: { away: PitcherLine[]; home: PitcherLine[] };
  plays: PlayItem[];
}

export interface NextGame {
  date: Date;
  opponent: string;
  home: boolean;
  spring: boolean;
}

export interface LiveGameResult {
  state: LiveState;
  game: GameView | null;
  next: NextGame | null;
}

/* ---------- helpers ---------- */

const etDay = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const chip = (t: Any): TeamChip => ({
  id: num(t?.id),
  abbr: String(t?.abbreviation || t?.teamCode?.toUpperCase() || t?.name?.slice(0, 3)?.toUpperCase() || ""),
  name: String(t?.teamName || t?.name || ""),
});

const batterLines = (team: Any): BatterLine[] => {
  const players = team?.players || {};
  const order: number[] = team?.batters || [];
  const lines: BatterLine[] = [];
  for (const id of order) {
    const p = players[`ID${id}`];
    const b = p?.stats?.batting;
    if (!p || !b || b.atBats === undefined) continue;
    lines.push({
      id,
      name: String(p.person?.fullName || ""),
      pos: String(p.position?.abbreviation || ""),
      ab: num(b.atBats),
      r: num(b.runs),
      h: num(b.hits),
      rbi: num(b.rbi),
      bb: num(b.baseOnBalls),
      k: num(b.strikeOuts),
      avg: p.seasonStats?.batting?.avg,
    });
  }
  return lines;
};

const pitcherLines = (team: Any): PitcherLine[] => {
  const players = team?.players || {};
  const ids: number[] = team?.pitchers || [];
  return ids
    .map((id) => {
      const p = players[`ID${id}`];
      const s = p?.stats?.pitching;
      if (!p || !s) return null;
      return {
        id,
        name: String(p.person?.fullName || ""),
        ip: String(s.inningsPitched ?? "0.0"),
        h: num(s.hits),
        er: num(s.earnedRuns),
        bb: num(s.baseOnBalls),
        k: num(s.strikeOuts),
        pitches: num(s.numberOfPitches),
        era: p.seasonStats?.pitching?.era,
      } as PitcherLine;
    })
    .filter(Boolean) as PitcherLine[];
};

const pitchKind = (ev: Any): PitchEvent["kind"] => {
  if (ev?.details?.isInPlay) return "inplay";
  if (ev?.details?.isStrike) return "strike";
  return "ball";
};

export const buildView = (feed: Any): GameView | null => {
  const gd = feed?.gameData;
  const ld = feed?.liveData;
  if (!gd || !ld) return null;
  const ls = ld.linescore || {};
  const box = ld.boxscore?.teams || {};
  const away = chip(gd.teams?.away);
  const home = chip(gd.teams?.home);
  const metsSide: Side = away.id === METS_ID ? "away" : "home";
  const abstract = String(gd.status?.abstractGameState || "");
  const final = abstract === "Final";

  const cur = ld.plays?.currentPlay;
  const matchup = cur?.matchup;
  const batterId = matchup?.batter?.id;
  const pitcherId = matchup?.pitcher?.id;
  const allPlayers: Record<string, Any> = { ...(box.away?.players || {}), ...(box.home?.players || {}) };
  const bp = batterId ? allPlayers[`ID${batterId}`] : undefined;
  const pp = pitcherId ? allPlayers[`ID${pitcherId}`] : undefined;

  let batter: GameView["batter"];
  if (matchup?.batter) {
    const b = bp?.stats?.batting;
    const s = bp?.seasonStats?.batting;
    batter = {
      id: batterId,
      name: String(matchup.batter.fullName || ""),
      pos: String(bp?.position?.abbreviation || ""),
      side: matchup.batSide?.code,
      today: b ? `${num(b.hits)}-${num(b.atBats)}` : "0-0",
      avg: s?.avg,
      hr: s?.homeRuns !== undefined ? String(s.homeRuns) : undefined,
      rbi: s?.rbi !== undefined ? String(s.rbi) : undefined,
      ops: s?.ops,
    };
  }
  let pitcher: GameView["pitcher"];
  if (matchup?.pitcher) {
    const s = pp?.stats?.pitching;
    pitcher = {
      id: pitcherId,
      name: String(matchup.pitcher.fullName || ""),
      hand: matchup.pitchHand?.code,
      ip: String(s?.inningsPitched ?? "0.0"),
      k: num(s?.strikeOuts),
      pitches: num(s?.numberOfPitches),
      era: pp?.seasonStats?.pitching?.era,
    };
  }

  const pitches: PitchEvent[] = (cur?.playEvents || [])
    .filter((e: Any) => e?.isPitch)
    .map((e: Any, i: number) => ({
      n: i + 1,
      type: String(e.details?.type?.description || "Pitch"),
      mph: e.pitchData?.startSpeed ? Math.round(e.pitchData.startSpeed * 10) / 10 : undefined,
      call: String(e.details?.call?.description || ""),
      kind: pitchKind(e),
    }));

  const allPlays: Any[] = ld.plays?.allPlays || [];
  const plays: PlayItem[] = allPlays
    .filter((p) => p?.result?.description)
    .slice(-14)
    .reverse()
    .map((p) => ({
      inning: num(p.about?.inning),
      half: String(p.about?.halfInning || ""),
      text: String(p.result.description),
      scoring: !!p.about?.isScoringPlay,
    }));

  const off = ls.offense || {};
  return {
    gamePk: num(gd.game?.pk),
    final,
    statusText: String(gd.status?.detailedState || ""),
    away,
    home,
    runs: { away: num(ls.teams?.away?.runs), home: num(ls.teams?.home?.runs) },
    hits: { away: num(ls.teams?.away?.hits), home: num(ls.teams?.home?.hits) },
    errors: { away: num(ls.teams?.away?.errors), home: num(ls.teams?.home?.errors) },
    innings: (ls.innings || []).map((i: Any) => ({ num: num(i.num), away: i.away?.runs, home: i.home?.runs })),
    inningLabel: final ? "Final" : String(ls.currentInningOrdinal || ""),
    isTop: ls.inningState ? String(ls.inningState).toLowerCase().startsWith("top") : !!ls.isTopInning,
    outs: num(ls.outs),
    balls: num(ls.balls),
    strikes: num(ls.strikes),
    bases: { first: !!off.first, second: !!off.second, third: !!off.third },
    batter,
    pitcher,
    pitches,
    metsSide,
    batting: { away: batterLines(box.away), home: batterLines(box.home) },
    pitching: { away: pitcherLines(box.away), home: pitcherLines(box.home) },
    plays,
  };
};

/* ---------- fetching ---------- */

const getJson = async (url: string, signal: AbortSignal) => {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`MLB ${res.status}`);
  return res.json();
};

interface ScheduleGame {
  gamePk: number;
  gameDate: string;
  gameType?: string;
  status: { abstractGameState: string };
  teams: { away: { team: Any }; home: { team: Any } };
}

const loadSchedule = async (signal: AbortSignal): Promise<ScheduleGame[]> => {
  const now = new Date();
  const start = etDay(new Date(now.getTime() - 86_400_000));
  const end = etDay(new Date(now.getTime() + 75 * 86_400_000));
  const url = `${API}/v1/schedule?sportId=1&teamId=${METS_ID}&startDate=${start}&endDate=${end}&gameType=S,R,F,D,L,W&hydrate=team`;
  const data = await getJson(url, signal);
  const games: ScheduleGame[] = [];
  for (const d of data?.dates || []) for (const g of d.games || []) games.push(g);
  return games.sort((a, b) => new Date(a.gameDate).getTime() - new Date(b.gameDate).getTime());
};

const nextFrom = (g: ScheduleGame): NextGame => {
  const home = g.teams.home.team?.id === METS_ID;
  const opp = home ? g.teams.away.team : g.teams.home.team;
  return { date: new Date(g.gameDate), opponent: String(opp?.teamName || opp?.name || "TBD"), home, spring: g.gameType === "S" };
};

/**
 * Picks what the stream pages should show:
 * live game, a game that just ended, a game later today, the next game, or offseason.
 */
export function useMetsLiveGame(enabled = true): LiveGameResult {
  const [result, setResult] = useState<LiveGameResult>({ state: "loading", game: null, next: null });
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    const ctl = new AbortController();

    const tick = async () => {
      let delay = 60_000;
      try {
        if (document.visibilityState === "hidden") {
          delay = 30_000;
        } else {
          const games = await loadSchedule(ctl.signal);
          const now = Date.now();
          const live = games.find((g) => g.status.abstractGameState === "Live");
          const justEnded = [...games]
            .reverse()
            .find((g) => g.status.abstractGameState === "Final" && now - new Date(g.gameDate).getTime() < 7 * 3_600_000);
          const upcoming = games.find((g) => g.status.abstractGameState === "Preview" && new Date(g.gameDate).getTime() > now - 3_600_000);
          const next = upcoming ? nextFrom(upcoming) : null;
          const target = live || justEnded;

          if (target) {
            const feed = await getJson(`${API}/v1.1/game/${target.gamePk}/feed/live`, ctl.signal);
            const view = buildView(feed);
            if (!stopped && view) {
              setResult({ state: live ? "live" : "final", game: view, next });
              delay = live ? 10_000 : 60_000;
            }
          } else if (!stopped) {
            let state: LiveState = "offseason";
            if (next) {
              const hours = (next.date.getTime() - now) / 3_600_000;
              state = hours <= 6 ? "pregame" : hours <= 24 * 21 ? "offair" : "offseason";
            }
            setResult({ state, game: null, next });
          }
        }
      } catch (e) {
        if ((e as Error)?.name === "AbortError") return;
        // keep whatever we had; try again later
        setResult((r) => (r.state === "loading" ? { state: "offseason", game: null, next: null } : r));
      }
      if (!stopped) timer.current = window.setTimeout(tick, delay);
    };

    tick();
    return () => {
      stopped = true;
      ctl.abort();
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [enabled]);

  return result;
}
