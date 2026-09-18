import { backend } from "../core/backend.js";
import { setPageMetadata } from "../core/metadata.js";
import { escapeHtml } from "../core/sanitize.js";
import { bindShell, renderShell, statusPanel } from "../ui/shell.js";

const METS_ID = 121;
const SEASON = 2026;
const STATS_API = "https://statsapi.mlb.com/api/v1";

const etDate = (value, options) =>
  value
    ? new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", ...options }).format(new Date(value))
    : "";

const fetchJson = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Schedule is unavailable right now.");
  return response.json();
};

const gameRow = (game) => {
  const home = game.teams?.home;
  const away = game.teams?.away;
  const metsHome = home?.team?.id === METS_ID;
  const opponent = metsHome ? away?.team?.name : home?.team?.name;
  const state = game.status?.abstractGameState;
  const final = state === "Final";
  const score = final || state === "Live"
    ? `${metsHome ? home?.score ?? 0 : away?.score ?? 0} – ${metsHome ? away?.score ?? 0 : home?.score ?? 0}`
    : etDate(game.gameDate, { hour: "numeric", minute: "2-digit" }) + " ET";

  return `
    <li class="game-row">
      <span class="game-date">${escapeHtml(etDate(game.gameDate, { weekday: "short", month: "short", day: "numeric" }))}</span>
      <span class="game-teams">${metsHome ? "vs" : "@"} ${escapeHtml(opponent || "TBD")}</span>
      <span class="game-score ${final ? "is-final" : ""}">${escapeHtml(score)}</span>
    </li>`;
};

const loadSchedule = async (startDate, endDate) => {
  const data = await fetchJson(
    `${STATS_API}/schedule?sportId=1&teamId=${METS_ID}&gameType=R&season=${SEASON}&startDate=${startDate}&endDate=${endDate}`,
  );
  return (data.dates || []).flatMap((date) => date.games || []);
};

const todayEt = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());

export const renderSchedule = async (root, pathname = "/mets-schedule-2026") => {
  setPageMetadata({
    title: "Mets 2026 Schedule | MetsXMFanZone",
    description: "The full New York Mets 2026 regular season schedule with dates, opponents, and start times in Eastern Time.",
    path: pathname,
  });

  root.innerHTML = renderShell({ content: statusPanel("Schedule", "Loading the 2026 schedule…"), currentPath: pathname });
  bindShell(root);

  let games = [];
  try {
    games = await loadSchedule(`${SEASON}-03-01`, `${SEASON}-10-05`);
  } catch {
    root.innerHTML = renderShell({
      content: statusPanel("Schedule", "The schedule is temporarily unavailable.", { href: pathname, label: "Try again" }),
      currentPath: pathname,
    });
    bindShell(root);
    return;
  }

  const today = todayEt();
  const upcoming = games.filter((game) => game.officialDate >= today);
  const past = games.filter((game) => game.officialDate < today).reverse();

  const content = `
    <section class="content-width page-heading">
      <p class="eyebrow">2026 Regular Season</p>
      <h1>Mets Schedule</h1>
      <p>All times Eastern.</p>
    </section>
    <section class="content-width home-section">
      <h2 class="section-title">Upcoming</h2>
      <ul class="game-list">${upcoming.map(gameRow).join("") || '<p class="empty-message">No upcoming games listed.</p>'}</ul>
    </section>
    <section class="content-width home-section">
      <h2 class="section-title">Results</h2>
      <ul class="game-list">${past.map(gameRow).join("") || '<p class="empty-message">No completed games yet.</p>'}</ul>
    </section>`;

  root.innerHTML = renderShell({ content, currentPath: pathname });
  bindShell(root);
};

export const renderScores = async (root, pathname = "/mets-scores") => {
  const nlWide = pathname === "/nl-scores";
  setPageMetadata({
    title: nlWide ? "National League Scores | MetsXMFanZone" : "Mets Scores | MetsXMFanZone",
    description: nlWide
      ? "Today's National League scores and results."
      : "Today's New York Mets score, recent results, and division standings.",
    path: pathname,
  });

  root.innerHTML = renderShell({ content: statusPanel("Scores", "Loading scores…"), currentPath: pathname });
  bindShell(root);

  const today = todayEt();
  let games = [];
  try {
    const data = await fetchJson(
      nlWide
        ? `${STATS_API}/schedule?sportId=1&date=${today}&gameType=R`
        : `${STATS_API}/schedule?sportId=1&teamId=${METS_ID}&date=${today}&gameType=R`,
    );
    games = (data.dates || []).flatMap((date) => date.games || []);
  } catch {
    games = [];
  }

  const { data: standings } = await backend
    .from("team_standings")
    .select("team_name,division,wins,losses,games_back,position")
    .order("position", { ascending: true });

  const scoreRow = (game) => {
    const home = game.teams?.home;
    const away = game.teams?.away;
    return `
      <li class="game-row">
        <span class="game-teams">${escapeHtml(away?.team?.name || "")} @ ${escapeHtml(home?.team?.name || "")}</span>
        <span class="game-score">${escapeHtml(String(away?.score ?? "-"))} – ${escapeHtml(String(home?.score ?? "-"))}</span>
        <span class="game-date">${escapeHtml(game.status?.detailedState || "")}</span>
      </li>`;
  };

  const content = `
    <section class="content-width page-heading">
      <p class="eyebrow">${escapeHtml(etDate(new Date().toISOString(), { weekday: "long", month: "long", day: "numeric" }))}</p>
      <h1>${nlWide ? "National League Scores" : "Mets Scores"}</h1>
    </section>
    <section class="content-width home-section">
      <ul class="game-list">${games.map(scoreRow).join("") || '<p class="empty-message">No games scheduled today.</p>'}</ul>
    </section>
    ${
      (standings || []).length
        ? `<section class="content-width home-section">
             <h2 class="section-title">Standings</h2>
             <ul class="game-list">
               ${(standings || [])
                 .map(
                   (team) => `<li class="game-row">
                     <span class="game-teams">${escapeHtml(team.team_name || "")}</span>
                     <span class="game-score">${escapeHtml(String(team.wins ?? 0))}-${escapeHtml(String(team.losses ?? 0))}</span>
                     <span class="game-date">${escapeHtml(String(team.games_back ?? ""))}</span>
                   </li>`,
                 )
                 .join("")}
             </ul>
           </section>`
        : ""
    }`;

  root.innerHTML = renderShell({ content, currentPath: pathname });
  bindShell(root);
};
