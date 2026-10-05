// Official team logo PNGs (ESPN's logo CDN) for every NFL, NBA and NHL team,
// used by emails to show the matchup. Abbreviations match ESPN's.

export type League = 'NFL' | 'NBA' | 'NHL'
export type Team = { league: League; name: string; short: string; abbr: string }

const nfl: [string, string, string][] = [
  ['Arizona Cardinals', 'Cardinals', 'ari'], ['Atlanta Falcons', 'Falcons', 'atl'],
  ['Baltimore Ravens', 'Ravens', 'bal'], ['Buffalo Bills', 'Bills', 'buf'],
  ['Carolina Panthers', 'Panthers', 'car'], ['Chicago Bears', 'Bears', 'chi'],
  ['Cincinnati Bengals', 'Bengals', 'cin'], ['Cleveland Browns', 'Browns', 'cle'],
  ['Dallas Cowboys', 'Cowboys', 'dal'], ['Denver Broncos', 'Broncos', 'den'],
  ['Detroit Lions', 'Lions', 'det'], ['Green Bay Packers', 'Packers', 'gb'],
  ['Houston Texans', 'Texans', 'hou'], ['Indianapolis Colts', 'Colts', 'ind'],
  ['Jacksonville Jaguars', 'Jaguars', 'jax'], ['Kansas City Chiefs', 'Chiefs', 'kc'],
  ['Las Vegas Raiders', 'Raiders', 'lv'], ['Los Angeles Chargers', 'Chargers', 'lac'],
  ['Los Angeles Rams', 'Rams', 'lar'], ['Miami Dolphins', 'Dolphins', 'mia'],
  ['Minnesota Vikings', 'Vikings', 'min'], ['New England Patriots', 'Patriots', 'ne'],
  ['New Orleans Saints', 'Saints', 'no'], ['New York Giants', 'Giants', 'nyg'],
  ['New York Jets', 'Jets', 'nyj'], ['Philadelphia Eagles', 'Eagles', 'phi'],
  ['Pittsburgh Steelers', 'Steelers', 'pit'], ['San Francisco 49ers', '49ers', 'sf'],
  ['Seattle Seahawks', 'Seahawks', 'sea'], ['Tampa Bay Buccaneers', 'Buccaneers', 'tb'],
  ['Tennessee Titans', 'Titans', 'ten'], ['Washington Commanders', 'Commanders', 'wsh'],
]

const nba: [string, string, string][] = [
  ['Atlanta Hawks', 'Hawks', 'atl'], ['Boston Celtics', 'Celtics', 'bos'],
  ['Brooklyn Nets', 'Nets', 'bkn'], ['Charlotte Hornets', 'Hornets', 'cha'],
  ['Chicago Bulls', 'Bulls', 'chi'], ['Cleveland Cavaliers', 'Cavaliers', 'cle'],
  ['Dallas Mavericks', 'Mavericks', 'dal'], ['Denver Nuggets', 'Nuggets', 'den'],
  ['Detroit Pistons', 'Pistons', 'det'], ['Golden State Warriors', 'Warriors', 'gs'],
  ['Houston Rockets', 'Rockets', 'hou'], ['Indiana Pacers', 'Pacers', 'ind'],
  ['LA Clippers', 'Clippers', 'lac'], ['Los Angeles Lakers', 'Lakers', 'lal'],
  ['Memphis Grizzlies', 'Grizzlies', 'mem'], ['Miami Heat', 'Heat', 'mia'],
  ['Milwaukee Bucks', 'Bucks', 'mil'], ['Minnesota Timberwolves', 'Timberwolves', 'min'],
  ['New Orleans Pelicans', 'Pelicans', 'no'], ['New York Knicks', 'Knicks', 'ny'],
  ['Oklahoma City Thunder', 'Thunder', 'okc'], ['Orlando Magic', 'Magic', 'orl'],
  ['Philadelphia 76ers', '76ers', 'phi'], ['Phoenix Suns', 'Suns', 'phx'],
  ['Portland Trail Blazers', 'Trail Blazers', 'por'], ['Sacramento Kings', 'Kings', 'sac'],
  ['San Antonio Spurs', 'Spurs', 'sa'], ['Toronto Raptors', 'Raptors', 'tor'],
  ['Utah Jazz', 'Jazz', 'utah'], ['Washington Wizards', 'Wizards', 'wsh'],
]

const nhl: [string, string, string][] = [
  ['Anaheim Ducks', 'Ducks', 'ana'], ['Boston Bruins', 'Bruins', 'bos'],
  ['Buffalo Sabres', 'Sabres', 'buf'], ['Calgary Flames', 'Flames', 'cgy'],
  ['Carolina Hurricanes', 'Hurricanes', 'car'], ['Chicago Blackhawks', 'Blackhawks', 'chi'],
  ['Colorado Avalanche', 'Avalanche', 'col'], ['Columbus Blue Jackets', 'Blue Jackets', 'cbj'],
  ['Dallas Stars', 'Stars', 'dal'], ['Detroit Red Wings', 'Red Wings', 'det'],
  ['Edmonton Oilers', 'Oilers', 'edm'], ['Florida Panthers', 'Panthers', 'fla'],
  ['Los Angeles Kings', 'Kings', 'la'], ['Minnesota Wild', 'Wild', 'min'],
  ['Montreal Canadiens', 'Canadiens', 'mtl'], ['Nashville Predators', 'Predators', 'nsh'],
  ['New Jersey Devils', 'Devils', 'nj'], ['New York Islanders', 'Islanders', 'nyi'],
  ['New York Rangers', 'Rangers', 'nyr'], ['Ottawa Senators', 'Senators', 'ott'],
  ['Philadelphia Flyers', 'Flyers', 'phi'], ['Pittsburgh Penguins', 'Penguins', 'pit'],
  ['San Jose Sharks', 'Sharks', 'sj'], ['Seattle Kraken', 'Kraken', 'sea'],
  ['St. Louis Blues', 'Blues', 'stl'], ['Tampa Bay Lightning', 'Lightning', 'tb'],
  ['Toronto Maple Leafs', 'Maple Leafs', 'tor'], ['Utah Mammoth', 'Mammoth', 'uta'],
  ['Vancouver Canucks', 'Canucks', 'van'], ['Vegas Golden Knights', 'Golden Knights', 'vgk'],
  ['Washington Capitals', 'Capitals', 'wsh'], ['Winnipeg Jets', 'Jets', 'wpg'],
]

const build = (league: League, rows: [string, string, string][]): Team[] =>
  rows.map(([name, short, abbr]) => ({ league, name, short, abbr }))

export const TEAMS: Team[] = [...build('NFL', nfl), ...build('NBA', nba), ...build('NHL', nhl)]

// Original source (ESPN). Copies live in our R2 bucket under team-logos/<league>/<abbr>.png.
export const espnLogo = (t: Pick<Team, 'league' | 'abbr'>) =>
  `https://a.espncdn.com/i/teamlogos/${t.league.toLowerCase()}/500/${t.abbr}.png`

export const r2LogoKey = (t: Pick<Team, 'league' | 'abbr'>) => `team-logos/${t.league.toLowerCase()}/${t.abbr}.png`

export const teamLogo = (t: Pick<Team, 'league' | 'abbr'>) => `https://media.metsxmfanzone.com/${r2LogoKey(t)}`

// The six NY teams, keyed by the page tag used on live_streams.assigned_pages.
export const NY_TEAM_BY_PAGE: Record<string, { league: League; abbr: string }> = {
  'ny-giants': { league: 'NFL', abbr: 'nyg' },
  'ny-jets': { league: 'NFL', abbr: 'nyj' },
  'ny-knicks': { league: 'NBA', abbr: 'ny' },
  'brooklyn-nets': { league: 'NBA', abbr: 'bkn' },
  'ny-rangers': { league: 'NHL', abbr: 'nyr' },
  'ny-islanders': { league: 'NHL', abbr: 'nyi' },
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Reads a game title like "New York Islanders @ Anaheim Ducks" and returns the
 * NY team, its opponent, and whether the NY team is at home. Only teams in the
 * NY team's own league are considered, so "Jets" or "Kings" can't cross leagues.
 */
export const parseMatchup = (title: string, nyPage: string) => {
  const ny = NY_TEAM_BY_PAGE[nyPage]
  if (!ny) return null
  const nyTeam = TEAMS.find((t) => t.league === ny.league && t.abbr === ny.abbr)!
  const text = ` ${title} `
  const at = (t: Team) => {
    for (const label of [t.name, t.short]) {
      const m = new RegExp(`(^|[^A-Za-z0-9])${escapeRe(label)}(?=[^A-Za-z0-9]|$)`, 'i').exec(text)
      if (m) return m.index
    }
    return -1
  }
  const nyPos = at(nyTeam)
  const opponents = TEAMS.filter((t) => t.league === ny.league && t !== nyTeam)
    .map((t) => ({ t, pos: at(t) }))
    .filter((x) => x.pos >= 0)
    // prefer the longest (most specific) name when two overlap
    .sort((a, b) => b.t.name.length - a.t.name.length)
  const opp = opponents[0]?.t ?? null
  // "A @ B" means A is away; "A vs B" means A is at home.
  const nyAway = /\s@\s|\sat\s/i.test(title) && opp ? nyPos >= 0 && nyPos < at(opp) : false
  return { nyTeam, opponent: opp, isHome: !nyAway }
}
