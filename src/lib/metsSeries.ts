// The Mets regular-season schedule, grouped into series (a run of games against one opponent).
// Read straight from MLB's schedule feed in the browser.

export const METS_TEAM_ID = 121;

export interface MetsGame {
  gamePk: number;
  date: string; // ISO start time
  isHome: boolean;
  opponent: string;
  venue: string;
  timeTBD: boolean;
}

export interface MetsSeries {
  key: string;
  opponent: string;
  isHome: boolean;
  games: MetsGame[];
}

export async function fetchMetsRegularSeason(season: number): Promise<MetsGame[]> {
  const res = await fetch(
    `https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=${METS_TEAM_ID}&season=${season}&gameType=R&startDate=${season}-03-01&endDate=${season}-10-31&hydrate=team,venue`,
  );
  if (!res.ok) throw new Error(`MLB schedule is unavailable right now (${res.status})`);
  const json = await res.json();
  const list: MetsGame[] = [];
  for (const day of json.dates ?? []) {
    for (const g of day.games ?? []) {
      const isHome = g.teams.home.team.id === METS_TEAM_ID;
      const opp = isHome ? g.teams.away : g.teams.home;
      list.push({
        gamePk: g.gamePk,
        date: g.gameDate,
        isHome,
        opponent: opp.team.name,
        venue: g.venue?.name ?? "",
        timeTBD: g.status?.startTimeTBD === true,
      });
    }
  }
  return list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

const SERIES_GAP_MS = 60 * 60 * 1000 * 60; // more than 2.5 days between games = a new series

// Gap between two game start times (ms) above which they are different series.
export const seriesGapMs = SERIES_GAP_MS;

export function groupIntoSeries(games: MetsGame[]): MetsSeries[] {
  const out: MetsSeries[] = [];
  for (const g of games) {
    const last = out[out.length - 1];
    const prev = last?.games[last.games.length - 1];
    const sameRun =
      last &&
      prev &&
      last.opponent === g.opponent &&
      last.isHome === g.isHome &&
      new Date(g.date).getTime() - new Date(prev.date).getTime() <= SERIES_GAP_MS;
    if (sameRun) last.games.push(g);
    else out.push({ key: `${g.opponent}-${g.date}`, opponent: g.opponent, isHome: g.isHome, games: [g] });
  }
  return out;
}

const shortDate = (iso: string) => {
  const d = new Date(new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York" }));
  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`;
};

// "Mets vs Braves 4/2/27" or "Mets @ Braves 4/2/27": the title format the site's series grouping already reads.
export const gameTitle = (g: MetsGame) => `Mets ${g.isHome ? "vs" : "@"} ${g.opponent} ${shortDate(g.date)}`;
