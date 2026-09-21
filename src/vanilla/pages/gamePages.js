import { auth } from "../core/auth.js";
import { backend } from "../core/backend.js";
import { setPageMetadata } from "../core/metadata.js";
import { escapeHtml, safeUrl } from "../core/sanitize.js";
import { bindShell, renderShell, statusPanel } from "../ui/shell.js";
import { attachPlayer } from "./watch.js";
import { OPPONENT_REGISTRY, metsData2026, getOpponent } from "../data/matchups.js";

const METS_ID = 121;
const STATS_API = "https://statsapi.mlb.com/api/v1";
const headshot = (id, size = 213) =>
  `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_${size},q_auto:best/v1/people/${id}/headshot/67/current`;

const fetchJson = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Request failed");
  return response.json();
};

const todayEt = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
const etDate = (value, options) =>
  value ? new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", ...options }).format(new Date(value)) : "";

const gate = (pathname, message = "A MetsXMFanZone membership is required to view this page.") =>
  statusPanel("Members only", message, { href: `/plans?required=true&next=${encodeURIComponent(pathname)}`, label: "See membership plans" });

const signInGate = (pathname) =>
  statusPanel("Sign in required", "Sign in to your MetsXMFanZone account to continue.", { href: `/auth?next=${encodeURIComponent(pathname)}`, label: "Sign in" });

/* ================= Mets Roster ================= */

export const renderRoster = async (root, pathname = "/mets-roster") => {
  setPageMetadata({
    title: "2026 New York Mets Roster - Full 40-Man Roster",
    description: "View the complete 2026 New York Mets 40-man roster with real-time updates from MLB. See all pitchers, catchers, infielders, and outfielders.",
    path: pathname,
    image: "/share/mets-roster.jpg",
  });

  root.innerHTML = renderShell({ content: statusPanel("Roster", "Loading the 40-man roster…"), currentPath: pathname });
  bindShell(root);

  let roster = [];
  try {
    const data = await fetchJson(`${STATS_API}/teams/${METS_ID}/roster?rosterType=40Man`);
    roster = await Promise.all(
      (data.roster || []).map(async (entry) => {
        try {
          const details = await fetchJson(`${STATS_API}/people/${entry.person.id}`);
          const info = details.people?.[0] || {};
          return {
            id: entry.person.id,
            fullName: entry.person.fullName,
            jerseyNumber: entry.jerseyNumber || "—",
            position: entry.position,
            status: entry.status,
            batSide: info.batSide,
            pitchHand: info.pitchHand,
            birthDate: info.birthDate,
            height: info.height,
            weight: info.weight,
            birthCity: info.birthCity,
            birthCountry: info.birthCountry,
          };
        } catch {
          return { id: entry.person.id, fullName: entry.person.fullName, jerseyNumber: entry.jerseyNumber || "—", position: entry.position, status: entry.status };
        }
      }),
    );
  } catch {
    root.innerHTML = renderShell({ content: statusPanel("Roster", "Failed to load roster. Please try again.", { href: pathname, label: "Try again" }), currentPath: pathname });
    bindShell(root);
    return;
  }

  const age = (birthDate) => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let years = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) years -= 1;
    return years;
  };

  const playerCard = (player) => `
    <article class="story-card roster-card" data-name="${escapeHtml(player.fullName.toLowerCase())}" data-jersey="${escapeHtml(String(player.jerseyNumber))}" data-type="${escapeHtml((player.position?.type || "").toLowerCase())}">
      <a href="/player/${player.id}" class="roster-card-link">
        <img src="${headshot(player.id)}" alt="${escapeHtml(player.fullName)}" loading="lazy" width="80" height="80" onerror="this.style.visibility='hidden'">
        <div class="story-copy">
          <span class="eyebrow">#${escapeHtml(String(player.jerseyNumber))} · ${escapeHtml(player.position?.abbreviation || player.position?.name || "")}</span>
          <h2>${escapeHtml(player.fullName)}</h2>
          <p>
            ${player.status?.code && player.status.code !== "A" ? `${escapeHtml(player.status.description)} · ` : ""}
            ${player.birthDate ? `Age ${age(player.birthDate)} · ` : ""}
            ${player.height && player.weight ? `${escapeHtml(player.height)}, ${escapeHtml(String(player.weight))} lbs` : ""}
          </p>
        </div>
      </a>
    </article>`;

  const content = `
    <section class="content-width page-heading">
      <p class="eyebrow">Full 40-Man Roster · Live from MLB Stats API</p>
      <h1>2026 Mets Roster</h1>
      <p>${roster.length} players · updated ${escapeHtml(new Date().toLocaleTimeString())}</p>
    </section>
    <section class="content-width">
      <div class="search-field">
        <label for="roster-search">Search by name or jersey number</label>
        <input id="roster-search" type="search" placeholder="e.g. Lindor or 12">
      </div>
      <div class="quick-links" id="roster-tabs" style="margin: 14px 0;">
        ${["all", "pitcher", "catcher", "infielder", "outfielder"].map((type) => `<a href="#" data-type="${type}" ${type === "all" ? 'aria-current="page"' : ""}>${type === "all" ? "All" : `${type.charAt(0).toUpperCase()}${type.slice(1)}s`}</a>`).join("")}
      </div>
    </section>
    <section class="content-width article-grid" id="roster-grid">
      ${roster.map(playerCard).join("") || '<p class="empty-message">No roster data available.</p>'}
    </section>`;

  root.innerHTML = renderShell({ content, currentPath: pathname });
  bindShell(root);

  const grid = root.querySelector("#roster-grid");
  const searchInput = root.querySelector("#roster-search");
  const tabs = [...root.querySelectorAll("#roster-tabs a")];
  let activeType = "all";

  const applyFilters = () => {
    const term = (searchInput?.value || "").trim().toLowerCase();
    grid.querySelectorAll(".roster-card").forEach((card) => {
      const matchesTerm = !term || card.dataset.name.includes(term) || card.dataset.jersey.includes(term);
      const matchesType = activeType === "all" || card.dataset.type === activeType;
      card.style.display = matchesTerm && matchesType ? "" : "none";
    });
  };

  searchInput?.addEventListener("input", applyFilters);
  tabs.forEach((tab) => {
    tab.addEventListener("click", (event) => {
      event.preventDefault();
      activeType = tab.dataset.type;
      tabs.forEach((item) => item.removeAttribute("aria-current"));
      tab.setAttribute("aria-current", "page");
      applyFilters();
    });
  });
};

/* ================= Player Stats ================= */

export const renderPlayerStats = async (root, playerId) => {
  const pathname = `/player/${playerId}`;
  root.innerHTML = renderShell({ content: statusPanel("Player", "Loading player stats…"), currentPath: pathname });
  bindShell(root);

  let info = null;
  let career = {};
  let seasons = [];
  try {
    const data = await fetchJson(
      `${STATS_API}/people/${playerId}?hydrate=stats(group=[hitting,pitching,fielding],type=[career,yearByYear])`,
    );
    info = data.people?.[0];
    if (!info) throw new Error("not found");

    (info.stats || []).forEach((block) => {
      const group = block.group?.displayName;
      const type = block.type?.displayName;
      const splits = block.splits || [];
      if (type === "career" && splits[0]?.stat) career[group] = splits[0].stat;
      if (type === "yearByYear") {
        splits.forEach((split) => {
          seasons.push({ season: split.season, team: split.team?.name || "", group, stat: split.stat });
        });
      }
    });
  } catch {
    root.innerHTML = renderShell({
      content: statusPanel("Player", "Failed to load player stats. Please try again.", { href: "/mets-roster", label: "Return to roster" }),
      currentPath: pathname,
    });
    bindShell(root);
    return;
  }

  setPageMetadata({
    title: `${info.fullName} Career Stats`,
    description: `View ${info.fullName}'s career statistics, including hitting, pitching, and fielding stats on MetsXMFanZone.`,
    path: pathname,
    image: headshot(info.id, 600),
    imageAlt: `${info.fullName} — New York Mets`,
  });

  const isPitcher = info.primaryPosition?.type?.toLowerCase() === "pitcher";
  const statBox = (label, value) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(String(value ?? "—"))}</dd></div>`;

  const seasonRows = seasons
    .filter((s) => (isPitcher ? s.group === "Pitching" : s.group === "Hitting"))
    .sort((a, b) => Number(b.season) - Number(a.season))
    .map((s) => `
      <li class="game-row">
        <span class="game-date">${escapeHtml(s.season)} · ${escapeHtml(s.team)}</span>
        <span class="game-teams">${
          isPitcher
            ? `${escapeHtml(String(s.stat.wins ?? 0))}-${escapeHtml(String(s.stat.losses ?? 0))} · ERA ${escapeHtml(String(s.stat.era ?? "-"))}`
            : `${escapeHtml(String(s.stat.hits ?? 0))} H · ${escapeHtml(String(s.stat.homeRuns ?? 0))} HR · ${escapeHtml(String(s.stat.rbi ?? 0))} RBI`
        }</span>
        <span class="game-score">${escapeHtml(isPitcher ? String(s.stat.strikeOuts ?? 0) + " K" : String(s.stat.avg ?? "-"))}</span>
      </li>`)
    .join("");

  const content = `
    <section class="content-width page-heading">
      <a class="back-link" href="/mets-roster">← Back to Roster</a>
      <div class="card-panel" style="flex-direction: row; display: flex; gap: 20px; align-items: center; text-align: left;">
        <img src="${headshot(info.id, 300)}" alt="${escapeHtml(info.fullName)}" width="120" height="120" style="border-radius: 999px; object-fit: cover;">
        <div>
          <p class="eyebrow">${escapeHtml(info.primaryPosition?.name || "")} · #${escapeHtml(info.primaryNumber || "—")}</p>
          <h1>${escapeHtml(info.fullName)}</h1>
          <p class="stream-meta">
            Age ${escapeHtml(String(info.currentAge ?? "—"))} · ${escapeHtml(info.height || "")}, ${escapeHtml(String(info.weight || ""))} lbs ·
            ${escapeHtml(info.birthCity || "")}${info.birthCountry ? `, ${escapeHtml(info.birthCountry)}` : ""}
          </p>
          <p class="stream-meta">
            Bats: <strong>${escapeHtml(info.batSide?.description || "—")}</strong> ·
            Throws: <strong>${escapeHtml(info.pitchHand?.description || "—")}</strong>
            ${info.mlbDebutDate ? ` · MLB Debut: <strong>${escapeHtml(etDate(info.mlbDebutDate, { month: "long", day: "numeric", year: "numeric" }))}</strong>` : ""}
          </p>
        </div>
      </div>
    </section>
    <section class="content-width home-section">
      ${
        career.Hitting
          ? `<div class="card-panel"><h2>Career Hitting</h2><dl class="detail-list">
              ${statBox("Games", career.Hitting.gamesPlayed)}${statBox("AB", career.Hitting.atBats)}${statBox("Hits", career.Hitting.hits)}
              ${statBox("HR", career.Hitting.homeRuns)}${statBox("RBI", career.Hitting.rbi)}${statBox("AVG", career.Hitting.avg)}
              ${statBox("OBP", career.Hitting.obp)}${statBox("OPS", career.Hitting.ops)}</dl></div>`
          : ""
      }
      ${
        career.Pitching && isPitcher
          ? `<div class="card-panel"><h2>Career Pitching</h2><dl class="detail-list">
              ${statBox("W-L", `${career.Pitching.wins ?? 0}-${career.Pitching.losses ?? 0}`)}${statBox("ERA", career.Pitching.era)}
              ${statBox("IP", career.Pitching.inningsPitched)}${statBox("K", career.Pitching.strikeOuts)}
              ${statBox("BB", career.Pitching.baseOnBalls)}${statBox("WHIP", career.Pitching.whip)}
              ${statBox("Saves", career.Pitching.saves)}</dl></div>`
          : ""
      }
      ${
        career.Fielding
          ? `<div class="card-panel"><h2>Career Fielding</h2><dl class="detail-list">
              ${statBox("PO", career.Fielding.putOuts)}${statBox("A", career.Fielding.assists)}${statBox("E", career.Fielding.errors)}
              ${statBox("FLD%", career.Fielding.fielding)}</dl></div>`
          : ""
      }
    </section>
    <section class="content-width home-section">
      <h2 class="section-title">Season by Season</h2>
      <ul class="game-list">${seasonRows || '<p class="empty-message">No season stats available.</p>'}</ul>
    </section>`;

  root.innerHTML = renderShell({ content, currentPath: pathname });
  bindShell(root);
};

/* ================= Mets History ================= */

const historicalMoments = [
  { year: "1969", title: "The Miracle Mets", description: "The Mets shocked the world by winning their first World Series, defeating the heavily favored Baltimore Orioles 4-1.", category: "championship" },
  { year: "1986", title: "World Champions Again", description: "Led by Dwight Gooden, Darryl Strawberry, and Gary Carter, the Mets captured their second World Series title against the Boston Red Sox.", category: "championship" },
  { year: "1962", title: "The Birth of the Mets", description: "The New York Mets played their first game on April 11, 1962, at the Polo Grounds. They finished 40-120, but a new era had begun.", category: "milestone" },
  { year: "1973", title: "Ya Gotta Believe!", description: "Tug McGraw's famous rallying cry propelled the Mets from last place in August to the National League pennant.", category: "memorable" },
  { year: "1999", title: "The Grand Slam Single", description: "Robin Ventura hit a walk-off grand slam against the Braves in NLCS Game 5, one of baseball's most iconic moments.", category: "memorable" },
  { year: "2000", title: "Subway Series", description: "The Mets faced the Yankees in the first Subway Series since 1956. Though they fell 4-1, the city was electric.", category: "memorable" },
  { year: "2006", title: "Endy's Catch", description: "Endy Chavez made one of the greatest catches in postseason history, robbing Scott Rolen of a home run in NLCS Game 7.", category: "memorable" },
  { year: "2015", title: "Return to Glory", description: "The young Mets reached the World Series for the first time in 15 years, powered by their dominant rotation.", category: "championship" },
  { year: "1985", title: "Tom Seaver Returns", description: "Tom Terrific won his 300th career game as a Met, a triumphant milestone for the franchise's greatest pitcher.", category: "player" },
  { year: "2012", title: "R.A. Dickey's Cy Young", description: "The knuckleballer became the first Met to win the Cy Young Award since Dwight Gooden in 1985.", category: "player" },
  { year: "2018", title: "Jacob deGrom's Dominance", description: "deGrom won the first of back-to-back Cy Young Awards with a historic 1.70 ERA.", category: "player" },
  { year: "2024", title: "OMG - The Grimace Era", description: "The Mets went on an improbable run, becoming one of baseball's most beloved storylines of the season.", category: "memorable" },
];

const legendaryPlayers = [
  { name: "Tom Seaver", years: "1967-77, 83", number: "41", position: "Pitcher", accolade: "Hall of Fame" },
  { name: "Mike Piazza", years: "1998-2005", number: "31", position: "Catcher", accolade: "Hall of Fame" },
  { name: "Dwight Gooden", years: "1984-94", number: "16", position: "Pitcher", accolade: "Cy Young 1985" },
  { name: "Darryl Strawberry", years: "1983-90", number: "18", position: "Outfield", accolade: "8x All-Star" },
  { name: "Keith Hernandez", years: "1983-89", number: "17", position: "First Base", accolade: "Gold Glove" },
  { name: "David Wright", years: "2004-18", number: "5", position: "Third Base", accolade: "Captain" },
  { name: "Jacob deGrom", years: "2014-22", number: "48", position: "Pitcher", accolade: "2x Cy Young" },
  { name: "Jose Reyes", years: "2003-11, 16-18", number: "7", position: "Shortstop", accolade: "Batting Champ" },
];

export const renderHistory = async (root, pathname = "/mets-history") => {
  setPageMetadata({
    title: "Mets History - Blast from the Past | MetsXMFanZone",
    description: "Relive the greatest moments in New York Mets history. From the Miracle Mets of 1969 to modern legends, explore the rich heritage of the Amazin's.",
    path: pathname,
  });

  const categories = ["all", "championship", "memorable", "player", "milestone"];
  const momentCard = (moment) => `
    <article class="story-card" data-category="${escapeHtml(moment.category)}">
      <div class="story-copy">
        <span class="eyebrow">${escapeHtml(moment.year)} · ${escapeHtml(moment.category)}</span>
        <h2>${escapeHtml(moment.title)}</h2>
        <p>${escapeHtml(moment.description)}</p>
      </div>
    </article>`;

  const legendCard = (player) => `
    <article class="story-card">
      <div class="story-copy">
        <span class="eyebrow">#${escapeHtml(player.number)} · ${escapeHtml(player.position)}</span>
        <h2>${escapeHtml(player.name)}</h2>
        <p>${escapeHtml(player.years)} · ${escapeHtml(player.accolade)}</p>
      </div>
    </article>`;

  const content = `
    <section class="content-width page-heading">
      <p class="eyebrow">Blast from the Mets Past</p>
      <h1>Mets History</h1>
      <p>Relive the legendary moments, iconic players, and unforgettable memories that made the Amazin's.</p>
    </section>
    <section class="content-width home-section">
      <div class="quick-links" style="margin-bottom: 12px;">
        <span>1969 &amp; 1986 World Champions</span> · <span>5 NL Pennants</span> · <span>Founded 1962</span>
      </div>
      <div class="quick-links" id="history-filters">
        ${categories.map((cat) => `<a href="#" data-category="${cat}" ${cat === "all" ? 'aria-current="page"' : ""}>${cat === "all" ? "All Moments" : cat.charAt(0).toUpperCase() + cat.slice(1)}</a>`).join("")}
      </div>
    </section>
    <section class="content-width article-grid" id="history-grid">
      ${historicalMoments.map(momentCard).join("")}
    </section>
    <section class="content-width home-section">
      <h2 class="section-title">Legends</h2>
      <div class="article-grid">${legendaryPlayers.map(legendCard).join("")}</div>
    </section>
    <section class="content-width home-section">
      <h2 class="section-title">Did You Know? 🤔</h2>
      <ul class="game-list">
        <li class="game-row"><span class="game-teams">Tom Seaver's number 41 was the first number retired by the Mets organization.</span></li>
        <li class="game-row"><span class="game-teams">The 1962 Mets hold the record for most losses in a single season with 120.</span></li>
        <li class="game-row"><span class="game-teams">Mr. Met was the first live-action, costumed mascot in MLB history.</span></li>
      </ul>
    </section>`;

  root.innerHTML = renderShell({ content, currentPath: pathname });
  bindShell(root);

  const grid = root.querySelector("#history-grid");
  const filters = [...root.querySelectorAll("#history-filters a")];
  filters.forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const category = link.dataset.category;
      filters.forEach((item) => item.removeAttribute("aria-current"));
      link.setAttribute("aria-current", "page");
      grid.querySelectorAll(".story-card").forEach((card) => {
        card.style.display = category === "all" || card.dataset.category === category ? "" : "none";
      });
    });
  });
};

/* ================= Mets Gamecast ================= */

export const renderGamecast = async (root, pathname = "/mets-gamecast") => {
  setPageMetadata({
    title: "MetsXMFanZone Gamecast - Live Game Updates",
    description: "Follow New York Mets games live with real-time scores, play-by-play, box scores, and live commentary.",
    path: pathname,
  });

  root.innerHTML = renderShell({ content: statusPanel("Gamecast", "Loading today's game…"), currentPath: pathname });
  bindShell(root);

  const today = todayEt();
  let game = null;
  let otherGames = [];
  let plays = [];

  try {
    const [metsData, allData] = await Promise.all([
      fetchJson(`${STATS_API}/schedule?sportId=1&teamId=${METS_ID}&date=${today}&hydrate=linescore,team,venue`),
      fetchJson(`${STATS_API}/schedule?sportId=1&date=${today}&hydrate=team,linescore`),
    ]);
    otherGames = (allData.dates?.[0]?.games || []).filter((g) => g.teams.away.team.id !== METS_ID && g.teams.home.team.id !== METS_ID);
    game = metsData.dates?.[0]?.games?.[0] || null;

    if (game && game.status?.abstractGameState !== "Preview") {
      const live = await fetchJson(`https://statsapi.mlb.com/api/v1.1/game/${game.gamePk}/feed/live`);
      plays = (live.liveData?.plays?.allPlays || [])
        .filter((p) => p.about?.isComplete)
        .slice(-15)
        .reverse()
        .map((p) => ({
          inning: p.about?.inning,
          half: p.about?.halfInning,
          description: p.result?.description || "",
          scoring: p.about?.isScoringPlay,
        }));
    }
  } catch {
    game = null;
  }

  const tickerRow = (g) => `
    <li class="game-row">
      <span class="game-teams">${escapeHtml(g.teams.away.team.name)} @ ${escapeHtml(g.teams.home.team.name)}</span>
      <span class="game-score">${escapeHtml(String(g.teams.away.score ?? "-"))} – ${escapeHtml(String(g.teams.home.score ?? "-"))}</span>
      <span class="game-date">${escapeHtml(g.status?.detailedState || "")}</span>
    </li>`;

  const linescoreTable = (g) => {
    const innings = g.linescore?.innings || [];
    if (!innings.length) return "";
    return `
      <table style="width:100%; border-collapse: collapse; margin-top: 12px; font-size: .85rem;">
        <thead><tr>${innings.map((inn) => `<th style="padding:6px;border-bottom:1px solid var(--border);">${inn.num}</th>`).join("")}<th style="padding:6px;border-bottom:1px solid var(--border);">R</th></tr></thead>
        <tbody>
          <tr><td colspan="${innings.length + 1}" style="padding:4px 6px; color: var(--muted);">Away</td></tr>
          <tr>${innings.map((inn) => `<td style="padding:6px;text-align:center;">${inn.away?.runs ?? "-"}</td>`).join("")}<td style="padding:6px;text-align:center;font-weight:700;">${g.teams.away.score ?? 0}</td></tr>
          <tr><td colspan="${innings.length + 1}" style="padding:4px 6px; color: var(--muted);">Home</td></tr>
          <tr>${innings.map((inn) => `<td style="padding:6px;text-align:center;">${inn.home?.runs ?? "-"}</td>`).join("")}<td style="padding:6px;text-align:center;font-weight:700;">${g.teams.home.score ?? 0}</td></tr>
        </tbody>
      </table>`;
  };

  const content = `
    <section class="content-width page-heading">
      <p class="eyebrow">Game Center ${game?.status?.abstractGameState === "Live" ? "· 🔴 LIVE" : ""}</p>
      <h1>Mets Gamecast</h1>
      <p>${escapeHtml(etDate(new Date().toISOString(), { weekday: "long", month: "long", day: "numeric" }))}</p>
    </section>
    ${
      game
        ? `<section class="content-width card-panel">
            <h2>${escapeHtml(game.teams.away.team.name)} @ ${escapeHtml(game.teams.home.team.name)}</h2>
            <p class="stream-meta">${escapeHtml(game.status?.detailedState || "")} · ${escapeHtml(game.venue?.name || "")}</p>
            <p style="font-size: 1.6rem; font-weight: 800;">${escapeHtml(String(game.teams.away.score ?? 0))} – ${escapeHtml(String(game.teams.home.score ?? 0))}</p>
            ${linescoreTable(game)}
          </section>`
        : `<section class="content-width">${statusPanel("Gamecast", "No Mets game is scheduled today.")}</section>`
    }
    ${
      plays.length
        ? `<section class="content-width home-section">
            <h2 class="section-title">Recent Plays</h2>
            <ul class="game-list">
              ${plays
                .map(
                  (play) => `<li class="game-row ${play.scoring ? "is-final" : ""}">
                    <span class="game-date">${escapeHtml(play.half)} ${escapeHtml(String(play.inning))}</span>
                    <span class="game-teams">${escapeHtml(play.description)}</span>
                  </li>`,
                )
                .join("")}
            </ul>
          </section>`
        : ""
    }
    <section class="content-width home-section">
      <h2 class="section-title">Around the League</h2>
      <ul class="game-list">${otherGames.map(tickerRow).join("") || '<p class="empty-message">No other games today.</p>'}</ul>
    </section>`;

  root.innerHTML = renderShell({ content, currentPath: pathname });
  bindShell(root);
};

/* ================= Replay Games (paid) ================= */

export const renderReplayGames = async (root, pathname = "/replay-games") => {
  setPageMetadata({
    title: "Replay Games - Watch Past Mets Games | MetsXMFanZone",
    description: "Relive the best Mets moments. Watch full game replays, classic matchups, and memorable performances on demand.",
    path: pathname,
  });

  root.innerHTML = renderShell({ content: statusPanel("Replay Games", "Checking your membership…"), currentPath: pathname });
  bindShell(root);

  const state = await auth.ready();
  if (!state.user) {
    root.innerHTML = renderShell({ content: signInGate(pathname), currentPath: pathname });
    bindShell(root);
    return;
  }
  if (!state.isMember) {
    root.innerHTML = renderShell({ content: gate(pathname, "A premium membership is required to watch full game replays."), currentPath: pathname });
    bindShell(root);
    return;
  }

  const { data } = await backend
    .from("replay_games")
    .select("id,title,thumbnail_url,embed_url,game_date,description")
    .order("game_date", { ascending: false });

  const games = data || [];
  const card = (game) => `
    <article class="stream-card">
      <a href="#" data-embed="${safeUrl(game.embed_url || "", "")}" data-title="${escapeHtml(game.title || "")}">
        <img src="${safeUrl(game.thumbnail_url || "/share/replay-games.jpg", "/share/replay-games.jpg")}" alt="${escapeHtml(game.title || "Replay")}" loading="lazy">
        <span class="stream-badge">${game.game_date ? escapeHtml(etDate(game.game_date, { month: "short", day: "numeric", year: "numeric" })) : "Replay"}</span>
        <h3>${escapeHtml(game.title || "Mets Replay")}</h3>
      </a>
    </article>`;

  const content = `
    <section class="content-width page-heading">
      <p class="eyebrow">On Demand · Premium</p>
      <h1>Replay Games</h1>
      <p>Relive the best Mets moments with full game replays and classic matchups.</p>
    </section>
    <section class="content-width" id="replay-player" hidden>
      <iframe id="replay-frame" title="Replay" style="width:100%; aspect-ratio:16/9; border:0; border-radius:12px;" allowfullscreen></iframe>
      <h2 id="replay-title" style="margin-top:10px;"></h2>
    </section>
    <section class="content-width home-section">
      <div class="article-grid">${games.map(card).join("") || '<p class="empty-message">No replay games published yet.</p>'}</div>
    </section>`;

  root.innerHTML = renderShell({ content, currentPath: pathname });
  bindShell(root);

  const panel = root.querySelector("#replay-player");
  const frame = root.querySelector("#replay-frame");
  const title = root.querySelector("#replay-title");
  root.querySelectorAll("[data-embed]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      if (!link.dataset.embed) return;
      frame.src = link.dataset.embed;
      title.textContent = link.dataset.title || "";
      panel.hidden = false;
      panel.scrollIntoView({ behavior: "smooth" });
    });
  });
};

/* ================= TV Dashboard ================= */

export const renderTVDashboard = async (root, pathname = "/tv") => {
  setPageMetadata({
    title: "MetsXMFanZone TV | Live, Highlights & Replays",
    description: "The MetsXMFanZone TV hub: live channels, highlights, and full game replays in one place.",
    path: pathname,
  });

  root.innerHTML = renderShell({ content: statusPanel("TV", "Loading channels…"), currentPath: pathname });
  bindShell(root);

  const [{ data: live }, { data: highlights }, { data: replays }] = await Promise.all([
    backend.from("live_streams").select("id,title,thumbnail_url,status").eq("published", true).eq("status", "live").order("created_at", { ascending: false }).limit(12),
    backend.from("videos").select("id,title,thumbnail_url,video_url").eq("published", true).eq("video_type", "highlight").order("published_at", { ascending: false }).limit(12),
    backend.from("replay_games").select("id,title,thumbnail_url,game_date").order("game_date", { ascending: false }).limit(12),
  ]);

  const rail = (items, empty, hrefFn) => `
    <ul class="stream-rail">
      ${
        (items || [])
          .map(
            (item) => `<li class="stream-card">
              <a href="${hrefFn(item)}">
                <img src="${safeUrl(item.thumbnail_url || "/share/video-gallery.jpg", "/share/video-gallery.jpg")}" alt="${escapeHtml(item.title || "")}" loading="lazy">
                <h3>${escapeHtml(item.title || "")}</h3>
              </a>
            </li>`,
          )
          .join("") || `<p class="empty-message">${empty}</p>`
      }
    </ul>`;

  const content = `
    <section class="content-width page-heading">
      <p class="eyebrow">MetsXMFanZone</p>
      <h1>TV</h1>
      <p>Live channels, highlights, and full game replays in one place.</p>
    </section>
    <section class="content-width home-section">
      <h2 class="section-title">Live Now</h2>
      ${rail(live, "Nothing is live right now.", () => "/metsxmfanzone")}
    </section>
    <section class="content-width home-section">
      <h2 class="section-title">Highlights</h2>
      ${rail(highlights, "No highlights published yet.", () => "/video-gallery")}
    </section>
    <section class="content-width home-section">
      <h2 class="section-title">Replays</h2>
      ${rail(replays, "No replays published yet.", () => "/replay-games")}
    </section>`;

  root.innerHTML = renderShell({ content, currentPath: pathname });
  bindShell(root);
};

/* ================= TV Broadcast Schedule ================= */

export const renderBroadcastSchedule = async (root, pathname = "/broadcast-schedule") => {
  setPageMetadata({
    title: "TV Broadcast Schedule | MetsXMFanZone",
    description: "View the complete broadcast schedule for New York Mets games, including networks and start times.",
    path: pathname,
  });

  root.innerHTML = renderShell({ content: statusPanel("Broadcast Schedule", "Loading the broadcast schedule…"), currentPath: pathname });
  bindShell(root);

  const today = todayEt();
  let games = [];
  try {
    const data = await fetchJson(
      `${STATS_API}/schedule?sportId=1&teamId=${METS_ID}&startDate=${today}&endDate=${today}&hydrate=broadcasts,venue`,
    );
    games = (data.dates || []).flatMap((date) => date.games || []);
  } catch {
    games = [];
  }

  const { data: shows } = await backend.from("tv_schedules").select("network,show_title,description,time_slot,is_live").order("time_slot", { ascending: true });

  const gameRow = (game) => {
    const networks = (game.broadcasts || []).map((b) => b.name).filter(Boolean).join(", ");
    return `
      <li class="game-row">
        <span class="game-date">${escapeHtml(etDate(game.gameDate, { hour: "numeric", minute: "2-digit" }))} ET</span>
        <span class="game-teams">${escapeHtml(game.teams?.away?.team?.name || "")} @ ${escapeHtml(game.teams?.home?.team?.name || "")}</span>
        <span class="game-score">${escapeHtml(networks || "TBD")}</span>
      </li>`;
  };

  const showRow = (show) => `
    <li class="game-row ${show.is_live ? "is-final" : ""}">
      <span class="game-date">${escapeHtml(show.time_slot || "")}</span>
      <span class="game-teams">${escapeHtml(show.network || "")} · ${escapeHtml(show.show_title || "")}</span>
      <span class="game-score">${show.is_live ? "LIVE" : ""}</span>
    </li>`;

  const content = `
    <section class="content-width page-heading">
      <p class="eyebrow">${escapeHtml(etDate(new Date().toISOString(), { weekday: "long", month: "long", day: "numeric" }))}</p>
      <h1>TV Broadcast Schedule</h1>
    </section>
    <section class="content-width home-section">
      <h2 class="section-title">Today's Mets Broadcasts</h2>
      <ul class="game-list">${games.map(gameRow).join("") || '<p class="empty-message">No Mets games scheduled today.</p>'}</ul>
    </section>
    <section class="content-width home-section">
      <h2 class="section-title">Network Lineup</h2>
      <ul class="game-list">${(shows || []).map(showRow).join("") || '<p class="empty-message">No network schedule published yet.</p>'}</ul>
    </section>`;

  root.innerHTML = renderShell({ content, currentPath: pathname });
  bindShell(root);
};

/* ================= GameDay Live (Radio Network, paid) ================= */

export const renderGameDayLive = async (root, pathname = "/gameday-live") => {
  root.innerHTML = renderShell({ content: statusPanel("Radio Network", "Loading…"), currentPath: pathname });
  bindShell(root);

  const state = await auth.ready();
  if (!state.user) {
    setPageMetadata({
      title: "MetsXMFanZone Radio Network | Premium Voice Rooms & Live Shows",
      description: "Live voice rooms, scheduled podcast shows, and the social hub for MetsXMFanZone premium members.",
      path: pathname,
    });
    root.innerHTML = renderShell({ content: signInGate(pathname), currentPath: pathname });
    bindShell(root);
    return;
  }
  if (!state.isMember) {
    setPageMetadata({
      title: "MetsXMFanZone Radio Network | Premium Members Only",
      description: "The Radio Network is for premium members. Voice rooms, live shows, and more.",
      path: pathname,
    });
    root.innerHTML = renderShell({ content: gate(pathname, "The Radio Network is available to premium members."), currentPath: pathname });
    bindShell(root);
    return;
  }

  setPageMetadata({
    title: "MetsXMFanZone Radio Network | Live Voice Rooms & Podcast Shows",
    description: "Live voice rooms, scheduled podcast shows, and the social hub for the MetsXMFanZone Radio Network.",
    path: pathname,
  });

  const { data: shows } = await backend
    .from("podcast_live_streams")
    .select("id,title,scheduled_start,status")
    .order("scheduled_start", { ascending: true })
    .limit(10)
    .then((res) => res, () => ({ data: [] }));

  const content = `
    <section class="content-width page-heading">
      <p class="eyebrow">MetsXMFanZone</p>
      <h1>Radio Network</h1>
      <p>Live voice rooms, scheduled podcast shows, and the social hub for true Mets fans.</p>
    </section>
    <section class="content-width home-section">
      <h2 class="section-title">Scheduled Shows</h2>
      <ul class="game-list">
        ${
          (shows || [])
            .map(
              (show) => `<li class="game-row ${show.status === "live" ? "is-final" : ""}">
                <span class="game-teams">${escapeHtml(show.title || "Show")}</span>
                <span class="game-date">${show.status === "live" ? "LIVE" : escapeHtml(etDate(show.scheduled_start, { weekday: "short", hour: "numeric", minute: "2-digit" }))}</span>
              </li>`,
            )
            .join("") || '<p class="empty-message">No shows scheduled right now.</p>'
        }
      </ul>
    </section>
    <section class="content-width home-section">
      <h2 class="section-title">Join the Conversation</h2>
      <p>Voice rooms and the community feed are available from the <a href="/community">Community</a> tab.</p>
    </section>`;

  root.innerHTML = renderShell({ content, currentPath: pathname });
  bindShell(root);
};

/* ================= MetsXM Player (embeddable HLS player) ================= */

export const renderMetsXMPlayer = async (root, pathname = "/metsxm-player") => {
  setPageMetadata({
    title: "MetsXMFanZone Live Player",
    description: "Standalone MetsXMFanZone live stream player.",
    path: pathname,
    noindex: true,
  });

  const search = new URLSearchParams(window.location.search);
  let streamUrl = search.get("src");
  let title = "MetsXMFanZone Live";
  let description = "Watch the Mets game live!";

  if (!streamUrl) {
    const { data } = await backend
      .from("live_streams")
      .select("stream_url,title,description")
      .eq("published", true)
      .eq("status", "live")
      .order("scheduled_start", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.stream_url) {
      streamUrl = data.stream_url;
      title = data.title || title;
      description = data.description || description;
    }
  }

  const content = `
    <section class="content-width player-panel">
      <video id="metsxm-video" class="stream-player" controls autoplay muted playsinline></video>
      <h1>${escapeHtml(title)}</h1>
      <p class="stream-meta" id="metsxm-status">${streamUrl ? "Connecting…" : "No live stream is currently available."}</p>
      <p>${escapeHtml(description)}</p>
    </section>`;

  root.innerHTML = renderShell({ content, currentPath: pathname });
  bindShell(root);

  const video = root.querySelector("#metsxm-video");
  const statusEl = root.querySelector("#metsxm-status");
  if (streamUrl) {
    const detach = attachPlayer(video, streamUrl);
    video.addEventListener("playing", () => { statusEl.textContent = "LIVE NOW"; });
    video.addEventListener("error", () => { statusEl.textContent = "Playback error."; });
    window.addEventListener("popstate", detach, { once: true });
  }
};

/* ================= MSG Plus (paid live stream) ================= */

export const renderMSGPlus = async (root, pathname = "/msg-plus") => {
  setPageMetadata({
    title: "MSG Plus Live - Watch Mets Baseball Coverage | MetsXMFanZone",
    description: "Watch MSG Plus live Mets baseball coverage, pre-game and post-game shows on MetsXMFanZone.",
    path: pathname,
    type: "video.other",
  });

  root.innerHTML = renderShell({ content: statusPanel("MSG Plus", "Loading the stream…"), currentPath: pathname });
  bindShell(root);

  const state = await auth.ready();
  if (!state.isMember) {
    root.innerHTML = renderShell({ content: gate(pathname), currentPath: pathname });
    bindShell(root);
    return;
  }

  const { data } = await backend
    .from("live_streams")
    .select("id,title,description,stream_url,thumbnail_url,status,scheduled_start")
    .eq("published", true)
    .contains("assigned_pages", ["msg-plus"])
    .order("display_order", { ascending: true })
    .limit(10);

  const streams = data || [];
  const stream = streams.find((item) => item.status === "live") || streams[0] || null;

  const content = `
    <section class="content-width page-heading">
      <p class="eyebrow">NY Sports · HD Quality</p>
      <h1>MSG <span style="color: var(--orange);">Plus</span></h1>
      <p>Your alternate MSG feed — additional Mets and NY sports coverage, live and on-demand.</p>
    </section>
    <section class="content-width player-panel">
      ${
        stream
          ? `<video id="msgplus-video" class="stream-player" controls playsinline autoplay poster="${safeUrl(stream.thumbnail_url || "/share/msg-plus.jpg", "/share/msg-plus.jpg")}"></video>
             <h2>${escapeHtml(stream.title || "MSG Plus")}</h2>
             <p class="stream-meta">${stream.status === "live" ? "Live now" : "Scheduled"}</p>
             ${stream.description ? `<p>${escapeHtml(stream.description)}</p>` : ""}`
          : statusPanel("MSG Plus", "Nothing is streaming on MSG Plus right now.", { href: "/", label: "Back home" })
      }
    </section>`;

  root.innerHTML = renderShell({ content, currentPath: pathname });
  bindShell(root);

  if (stream) {
    const video = root.querySelector("#msgplus-video");
    const detach = attachPlayer(video, stream.stream_url);
    window.addEventListener("popstate", detach, { once: true });
  }
};

/* ================= Matchup pages ================= */

const buildMatchupContent = (opponent) => {
  const playerCard = (player, teamColor) => `
    <div class="card-panel" style="text-align:center;">
      ${player.imageId ? `<img src="${headshot(player.imageId, 150)}" alt="${escapeHtml(player.name)}" width="70" height="70" style="border-radius:999px; object-fit:cover; margin: 0 auto;">` : ""}
      <h2 style="font-size:1rem;">${escapeHtml(player.name)}</h2>
      <p class="stream-meta">${escapeHtml(player.position)}${player.avg ? ` · ${escapeHtml(player.avg)} AVG` : ""}${player.era ? ` · ${escapeHtml(player.era)} ERA` : ""}</p>
      <p class="stream-meta">${player.hr !== undefined ? `${player.hr} HR · ${player.rbi} RBI` : ""}${player.wins !== undefined ? `${player.wins} W · ${player.strikeouts} K` : ""}</p>
    </div>`;

  return `
    <section class="content-width page-heading">
      <p class="eyebrow">2026 Season Matchup</p>
      <h1>Mets vs ${escapeHtml(opponent.name)}</h1>
      <p>${escapeHtml(opponent.rivalryNote)}</p>
    </section>
    <section class="content-width home-section">
      <div class="article-grid" style="grid-template-columns: repeat(2, minmax(0,1fr));">
        <div class="card-panel">
          <h2>${escapeHtml(metsData2026.name)}</h2>
          <p class="stream-meta">Record: ${escapeHtml(metsData2026.record)} · Spring: ${escapeHtml(metsData2026.springRecord)}</p>
        </div>
        <div class="card-panel">
          <h2>${escapeHtml(opponent.name)}</h2>
          <p class="stream-meta">Record: ${escapeHtml(opponent.record)} · Spring: ${escapeHtml(opponent.springRecord)}</p>
        </div>
      </div>
    </section>
    <section class="content-width home-section">
      <h2 class="section-title">Head-to-Head</h2>
      <ul class="game-list">
        <li class="game-row">
          <span class="game-teams">Mets ${opponent.headToHead.metsWins} – ${opponent.headToHead.opponentWins} ${escapeHtml(opponent.abbr)}</span>
        </li>
      </ul>
    </section>
    <section class="content-width home-section">
      <h2 class="section-title">Odds</h2>
      <ul class="game-list">
        <li class="game-row">
          <span class="game-date">Spread</span><span class="game-teams">${escapeHtml(opponent.bettingLines.spread)}</span>
          <span class="game-score">O/U ${escapeHtml(opponent.bettingLines.overUnder)}</span>
        </li>
        <li class="game-row">
          <span class="game-date">Moneyline</span>
          <span class="game-teams">Mets ${escapeHtml(opponent.bettingLines.moneyline.mets)} · ${escapeHtml(opponent.abbr)} ${escapeHtml(opponent.bettingLines.moneyline.opponent)}</span>
        </li>
      </ul>
    </section>
    <section class="content-width home-section">
      <h2 class="section-title">Mets Key Players</h2>
      <div class="article-grid">
        ${[...metsData2026.keyPlayers, ...metsData2026.keyPitchers].map((p) => playerCard(p)).join("")}
      </div>
    </section>
    <section class="content-width home-section">
      <h2 class="section-title">${escapeHtml(opponent.name)} Key Players</h2>
      <div class="article-grid">
        ${[...opponent.keyPlayers, ...opponent.keyPitchers].map((p) => playerCard(p)).join("")}
      </div>
    </section>`;
};

export const renderMatchup = async (root, slug) => {
  const opponent = getOpponent(slug || "");
  if (!opponent) {
    window.location.replace("/mets-schedule-2026");
    return;
  }

  const pathname = `/matchup/${opponent.slug}`;
  setPageMetadata({
    title: `Mets vs ${opponent.name} | MetsXMFanZone`,
    description: `${opponent.rivalryNote} See rosters, odds, and head-to-head history for Mets vs ${opponent.name}.`,
    path: pathname,
    image: "/share/mets-schedule-2026.jpg",
  });

  root.innerHTML = renderShell({ content: buildMatchupContent(opponent), currentPath: pathname });
  bindShell(root);
};

export const matchupSlugs = Object.keys(OPPONENT_REGISTRY);

/* ================= Route export ================= */

export const gameRoutes = [
  { path: "/mets-roster", render: (root) => renderRoster(root, "/mets-roster") },
  { path: "/player/:playerId", render: (root, ctx) => renderPlayerStats(root, ctx.params.playerId) },
  { path: "/mets-history", render: (root) => renderHistory(root, "/mets-history") },
  { path: "/mets-gamecast", render: (root) => renderGamecast(root, "/mets-gamecast") },
  { path: "/replay-games", render: (root) => renderReplayGames(root, "/replay-games") },
  { path: "/tv", render: (root) => renderTVDashboard(root, "/tv") },
  { path: "/broadcast-schedule", render: (root) => renderBroadcastSchedule(root, "/broadcast-schedule") },
  { path: "/gameday-live", render: (root) => renderGameDayLive(root, "/gameday-live") },
  { path: "/metsxm-player", render: (root) => renderMetsXMPlayer(root, "/metsxm-player") },
  { path: "/msg-plus", render: (root) => renderMSGPlus(root, "/msg-plus") },
  { path: "/matchup/astros", render: (root) => renderMatchup(root, "astros") },
  { path: "/matchup/braves", render: (root) => renderMatchup(root, "braves") },
  { path: "/matchup/cardinals", render: (root) => renderMatchup(root, "cardinals") },
  { path: "/matchup/nationals", render: (root) => renderMatchup(root, "nationals") },
  { path: "/matchup/redsox", render: (root) => renderMatchup(root, "redsox") },
  { path: "/matchup/yankees", render: (root) => renderMatchup(root, "yankees") },
  { path: "/matchup/bluejays", render: (root) => renderMatchup(root, "bluejays") },
  { path: "/matchup/:opponent", render: (root, ctx) => renderMatchup(root, ctx.params.opponent) },
];
