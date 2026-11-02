import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Play } from "lucide-react";
import logo from "@/assets/metsxmfanzone-logo.png";

// Home page: Spring Training and Mets Tracker, built like the other home rows
// (title row + side-scrolling cards). Data: MLB's and ESPN's public feeds.
// Nothing here reads or writes Supabase.

const METS = 121;
const SEASON = 2027;
const ET = "America/New_York";
const FALLBACK_OPENER = "2027-02-19T18:10:00Z"; // Fri Feb 19, 2027 vs Marlins (Mets announcement)

const teamLogo = (id: number) => `https://www.mlbstatic.com/team-logos/${id}.svg`;
const headshot = (id: number) =>
  `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_360,q_auto:best/v1/people/${id}/headshot/67/current`;
const fmt = (iso: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { timeZone: ET, ...o }).format(new Date(iso));
const dayLabel = (iso: string) => fmt(`${iso.slice(0, 10)}T12:00:00Z`, { month: "short", day: "numeric" });
const ymd = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: ET }).format(d);

type Game = { id: number; date: string; isHome: boolean; opponent: string; oppId: number; timeTBD: boolean };
type Tx = { id: number; date: string; typeCode: string; typeDesc: string; playerId?: number; player: string; fromId?: number; toId?: number; description: string; photoUrl?: string };

const isTrade = (t: Tx) => t.typeCode === "TR" || /trade/i.test(t.typeDesc);
const isWaiver = (t: Tx) => !isTrade(t) && (/waiv|designated for assignment|outright|release|cut\b/i.test(t.typeDesc) || ["DFA", "CLW", "OUT", "OR", "REL", "RL"].includes(t.typeCode));
const isSigning = (t: Tx) => !isTrade(t) && !isWaiver(t) && (/signed|extension|re-signed/i.test(t.typeDesc) || ["SGN", "SFA", "SE"].includes(t.typeCode));

function useSpringGames() {
  return useQuery({
    queryKey: ["home-spring-games", SEASON],
    staleTime: 30 * 60_000,
    queryFn: async (): Promise<Game[]> => {
      const res = await fetch(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=${METS}&season=${SEASON}&gameType=S&startDate=${SEASON}-02-01&endDate=${SEASON}-04-05&hydrate=team`);
      if (!res.ok) throw new Error("schedule");
      const json = await res.json();
      const out: Game[] = [];
      for (const day of json.dates ?? []) {
        for (const g of day.games ?? []) {
          const isHome = g.teams.home.team.id === METS;
          const opp = (isHome ? g.teams.away : g.teams.home).team;
          out.push({ id: g.gamePk, date: g.gameDate, isHome, opponent: opp.name, oppId: opp.id, timeTBD: g.status?.startTimeTBD === true });
        }
      }
      return out.sort((a, b) => +new Date(a.date) - +new Date(b.date));
    },
  });
}

const ESPN_METS = "21";
const norm = (n: string) => n.toLowerCase().replace(/[^a-z]/g, "");

const toTx = (x: any): Tx => ({ id: x.id, date: x.effectiveDate || x.date, typeCode: x.typeCode ?? "", typeDesc: x.typeDesc ?? "", playerId: x.person?.id, player: x.person?.fullName ?? "", fromId: x.fromTeam?.id, toId: x.toTeam?.id, description: x.description ?? "" });

async function fetchMlbTransactions(): Promise<Tx[]> {
  const end = new Date(Date.now() + 86_400_000);
  const start = new Date(end.getTime() - 270 * 86_400_000);
  const recentStart = new Date(end.getTime() - 21 * 86_400_000);
  // MLB's "teamId" filter leaves out many Mets moves (waiver claims, outrights, IL activations), so for the last
  // three weeks read the league-wide list and keep every move that names the Mets. The team list covers the older months.
  const [team, recent] = await Promise.allSettled([
    fetch(`https://statsapi.mlb.com/api/v1/transactions?teamId=${METS}&startDate=${ymd(start)}&endDate=${ymd(end)}`).then((r) => { if (!r.ok) throw new Error("mlb team"); return r.json(); }),
    fetch(`https://statsapi.mlb.com/api/v1/transactions?startDate=${ymd(recentStart)}&endDate=${ymd(end)}`).then((r) => { if (!r.ok) throw new Error("mlb league"); return r.json(); }),
  ]);
  if (team.status === "rejected" && recent.status === "rejected") throw new Error("mlb transactions");
  const rows: any[] = [
    ...(team.status === "fulfilled" ? team.value.transactions ?? [] : []),
    ...(recent.status === "fulfilled" ? (recent.value.transactions ?? []).filter((x: any) => /New York Mets/.test(x.description ?? "") || x.fromTeam?.id === METS || x.toTeam?.id === METS || x.team?.id === METS) : []),
  ];
  const seen = new Set<number>();
  return rows.filter((x) => (seen.has(x.id) ? false : (seen.add(x.id), true))).map(toTx);
}

/** ESPN's feed is one text blurb per team per day ("Recalled X from Y. Placed Z on the 15-day IL."), with no player or
 *  move type fields. Split each blurb into single moves and work out the player and kind from the wording. */
const POS = "(?:RHP|LHP|C|1B|2B|3B|SS|LF|CF|RF|OF|DH|INF|P|UT)";
const NAME = "([A-Z][A-Za-zÀ-ÿ.'’-]+(?:\\s+(?:Jr\\.|Sr\\.|II|III|[A-Z][A-Za-zÀ-ÿ.'’-]+)){1,2})";
function moveKind(sentence: string): string {
  if (/\btraded\b|\bacquired\b/i.test(sentence)) return "Trade";
  if (/claimed/i.test(sentence)) return "Claimed Off Waivers";
  if (/designated .* for assignment/i.test(sentence)) return "Designated for Assignment";
  if (/outright/i.test(sentence)) return "Outrighted";
  if (/released/i.test(sentence)) return "Released";
  if (/\bwaive/i.test(sentence)) return "Waived";
  if (/agreed to|signed|re-signed|extension/i.test(sentence)) return /extension/i.test(sentence) ? "Extension" : "Signed";
  if (/optioned/i.test(sentence)) return "Optioned";
  if (/recalled/i.test(sentence)) return "Recalled";
  if (/selected/i.test(sentence)) return "Selected";
  if (/injured list|\bIL\b|reinstated/i.test(sentence)) return /reinstated/i.test(sentence) ? "Reinstated" : "Injured List";
  return "Roster Move";
}

async function fetchEspnTransactions(): Promise<Tx[]> {
  const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/transactions?limit=300`);
  if (!res.ok) throw new Error("espn transactions");
  const json = await res.json();
  const list: any[] = json.transactions ?? json.items ?? [];
  const out: Tx[] = [];
  for (const x of list) {
    if (String(x.team?.id ?? "") !== ESPN_METS || !x.date) continue;
    const sentences = String(x.description ?? "").split(/\.\s+(?=[A-Z])/).map((t) => t.trim().replace(/\.$/, "")).filter(Boolean);
    sentences.forEach((sentence, i) => {
      const m = sentence.match(new RegExp(`\\b${POS}\\s+${NAME}`));
      if (!m) return;
      const typeDesc = moveKind(sentence);
      out.push({
        id: Math.abs(hashStr(`${x.date}|${i}|${sentence}`)),
        date: x.date,
        typeCode: typeDesc === "Trade" ? "TR" : "",
        typeDesc,
        player: m[1],
        description: `${sentence}.`,
      });
    });
  }
  return out;
}

function hashStr(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }

/** The live 40-man roster, so every move on the tracker can say whether the player is on the team today. */
function useRoster40() {
  return useQuery({
    queryKey: ["home-mets-40man"],
    staleTime: 5 * 60_000,
    refetchInterval: 10 * 60_000,
    queryFn: async () => {
      const res = await fetch(`https://statsapi.mlb.com/api/v1/teams/${METS}/roster?rosterType=40Man`);
      if (!res.ok) throw new Error("roster");
      const json = await res.json();
      const ids = new Set<number>(); const names = new Set<string>();
      for (const r of json.roster ?? []) { ids.add(r.person?.id); names.add(norm(r.person?.fullName ?? "")); }
      return { ids, names };
    },
  });
}

function useTransactions() {
  return useQuery({
    queryKey: ["home-mets-transactions"],
    staleTime: 5 * 60_000,
    refetchInterval: 10 * 60_000, // keep the tracker fresh while the page stays open
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<Tx[]> => {
      // Both feeds at once. If one is down or slow to post a move, the other still fills the tracker.
      const [mlb, espn] = await Promise.allSettled([fetchMlbTransactions(), fetchEspnTransactions()]);
      if (mlb.status === "rejected" && espn.status === "rejected") throw new Error("transactions");
      const a = mlb.status === "fulfilled" ? mlb.value : [];
      const b = espn.status === "fulfilled" ? espn.value : [];
      // Same player, same kind of move, within a day or two = the same move. Keep the MLB copy (it has MLB photos and team logos).
      const kind = (t: Tx) => (isTrade(t) ? "t" : isWaiver(t) ? "w" : isSigning(t) ? "s" : "o");
      const dupe = (t: Tx) => a.some((m) => norm(m.player) === norm(t.player) && kind(m) === kind(t) && (kind(m) !== "o" || m.typeDesc.toLowerCase() === t.typeDesc.toLowerCase()) && Math.abs(+new Date(m.date) - +new Date(t.date)) < 3 * 86_400_000);
      const cutoff = Date.now() - 270 * 86_400_000;
      return [...a, ...b.filter((t) => t.player && !dupe(t) && +new Date(t.date) > cutoff)]
        .sort((x, y) => +new Date(y.date) - +new Date(x.date));
    },
  });
}

const rowCls = "scrollbar-hide flex gap-3 overflow-x-auto px-4 pb-4 sm:px-6 md:gap-4 lg:px-8 max-md:snap-x max-md:snap-mandatory max-md:scroll-px-4";
const cardW = "w-[calc(100vw-4.5rem)] max-w-[340px] flex-shrink-0 snap-start md:w-[320px] md:max-w-none lg:w-[340px]";

const Logo = ({ id, className = "h-14 w-14" }: { id: number; className?: string }) => (
  <span className={`flex items-center justify-center rounded-full bg-white/10 p-2 ${className}`}>
    <img src={teamLogo(id)} alt="" loading="lazy" className="h-full w-full object-contain" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
  </span>
);

const Title = ({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) => (
  <div className="container mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 sm:gap-3">
        <img src={logo} alt="MetsXMFanZone" className="h-9 w-9 object-contain sm:h-10 sm:w-10" />
        <h2 className="text-[25px] font-bold uppercase leading-none tracking-wide text-foreground sm:text-2xl md:text-3xl">{children}</h2>
      </div>
      {right}
    </div>
  </div>
);

export function SpringTrainingSection() {
  const { data: games = [] } = useSpringGames();
  const now = Date.now();
  const upcoming = games.filter((g) => +new Date(g.date) > now - 6 * 3_600_000);
  const first = games[0];
  const days = Math.max(0, Math.ceil((+new Date(first?.date ?? FALLBACK_OPENER) - now) / 86_400_000));

  return (
    <section className="relative py-6 sm:py-8" aria-label="Spring Training">
      <Title right={<Link to="/spring-training-live" data-guide="spring-watch-live" className="flex min-h-[44px] items-center gap-1 text-sm font-semibold text-primary hover:text-primary/80">Watch live <ChevronRight className="h-4 w-4" /></Link>}>Spring Training</Title>
      <div className={rowCls} style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
        {/* Countdown card */}
        <div className={`${cardW} relative flex aspect-video min-h-[190px] flex-col justify-between overflow-hidden rounded-lg border border-border/50 p-4`} style={{ backgroundImage: "linear-gradient(135deg,#0b3e75,#07111d 85%)" }}>
          <img src={logo} alt="" aria-hidden className="absolute -right-6 -top-6 h-40 w-40 object-contain opacity-20" />
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#ff5a1f]">Grapefruit League · Port St. Lucie</p>
          <div role="timer" aria-label={`${days} days until the first Spring Training game`}>
            <span className="font-display text-7xl font-bold leading-none text-white">{days}</span>
            <span className="ml-2 text-sm font-semibold uppercase tracking-wider text-white/70">{days === 1 ? "day" : "days"} to the first game</span>
          </div>
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Logo id={METS} className="h-9 w-9" /> <span className="text-white/60">{first?.isHome === false ? "at" : "vs"}</span> <Logo id={first?.oppId ?? 146} className="h-9 w-9" />
            <span className="ml-1 truncate">{first ? fmt(first.date, { month: "short", day: "numeric" }) : "Feb 19"}</span>
          </div>
        </div>
        {upcoming.map((g) => (
          <Link key={g.id} to="/spring-training-live" className={`${cardW} group relative flex aspect-video min-h-[190px] flex-col justify-between overflow-hidden rounded-lg border border-border/50 p-4 transition-colors hover:border-primary/60`} style={{ backgroundImage: "linear-gradient(160deg,#0f2a4d,#07111d 90%)" }}>
            <img src={logo} alt="" aria-hidden className="absolute -bottom-8 -right-8 h-32 w-32 object-contain opacity-10" />
            <div className="flex items-center justify-between text-[11px] font-extrabold uppercase tracking-[0.16em] text-white/70">
              <span>{fmt(g.date, { weekday: "short" })} · {fmt(g.date, { month: "short", day: "numeric" })}</span>
              <span>{g.timeTBD ? "Time TBA" : `${fmt(g.date, { hour: "numeric", minute: "2-digit" })} ET`}</span>
            </div>
            <div className="flex items-center justify-center gap-4">
              <Logo id={g.isHome ? METS : g.oppId} className="h-16 w-16" />
              <span className="font-display text-2xl font-bold text-white/60">VS</span>
              <Logo id={g.isHome ? g.oppId : METS} className="h-16 w-16" />
            </div>
            <div className="flex items-center justify-between">
              <p className="truncate font-display text-lg font-bold uppercase tracking-wide text-white">{g.isHome ? "vs" : "at"} {g.opponent}</p>
              <span className="flex shrink-0 items-center gap-1 rounded-md bg-[#ff5a1f] px-3 py-1.5 font-display text-sm font-bold uppercase tracking-wider text-white"><Play className="h-3 w-3 fill-white" /> Watch</span>
            </div>
          </Link>
        ))}
        {upcoming.length === 0 && <div className={`${cardW} flex min-h-[190px] items-center rounded-lg border border-border/50 bg-card/70 p-4 text-sm text-muted-foreground`}>The full schedule appears here as soon as MLB posts it.</div>}
      </div>
    </section>
  );
}

export function MetsTrackerSection() {
  const [tab, setTab] = useState<"trades" | "signings" | "waivers" | "moves">("moves");
  const { data: txs = [], isLoading, isError } = useTransactions();
  const { data: roster } = useRoster40();
  // MLB's roster list can trail the moves by hours, so a player's newest move decides first (claimed away, outrighted,
  // released = off; claimed by the Mets = on). Anything else falls back to the live roster list.
  const latest = useMemo(() => { const m = new Map<string, Tx>(); for (const t of txs) { const k = norm(t.player); if (k && !m.has(k)) m.set(k, t); } return m; }, [txs]);
  const onRoster = (t: Tx): boolean | undefined => {
    const last = latest.get(norm(t.player));
    const d = last?.description ?? "";
    if (last) {
      if (/outright|released|waived/i.test(d) && /New York Mets (sent|released|placed)/i.test(d)) return false;
      if (/claimed .* off waivers from New York Mets/i.test(d) && !/^New York Mets/i.test(d)) return false;
      if (/^New York Mets (claimed|selected|purchased|acquired)/i.test(d) || /traded .* to New York Mets/i.test(d)) return true;
    }
    return roster ? (t.playerId ? roster.ids.has(t.playerId) : roster.names.has(norm(t.player))) : undefined;
  };
  const items = tab === "trades" ? txs.filter(isTrade).slice(0, 12) : tab === "signings" ? txs.filter(isSigning).slice(0, 12) : tab === "waivers" ? txs.filter(isWaiver).slice(0, 12) : tab === "moves" ? txs.slice(0, 25) : [];

  const tabs = (
    <div data-guide="fa-tabs" className="scrollbar-hide flex gap-1.5 overflow-x-auto px-4 pb-3 sm:px-6 lg:px-8" role="tablist" aria-label="Free Agency" style={{ scrollbarWidth: "none" }}>
      {([["moves", "All Moves"], ["trades", "Trades"], ["signings", "Signings"], ["waivers", "Waivers"]] as const).map(([v, l]) => (
        <button key={v} type="button" role="tab" aria-selected={tab === v} onClick={() => setTab(v)}
          className={`min-h-[40px] shrink-0 whitespace-nowrap rounded-lg border border-[#ff5a1f] px-3.5 font-display text-sm font-bold uppercase tracking-wider transition-colors sm:px-4 sm:text-base ${tab === v ? "bg-[#ff5a1f] text-white" : "text-foreground hover:bg-[#ff5a1f]/15"}`}>{l}</button>
      ))}
      <Link to="/mets-roster" className="flex min-h-[40px] shrink-0 items-center gap-1 whitespace-nowrap px-2 font-display text-sm font-bold uppercase tracking-wider text-primary hover:text-primary/80 sm:text-base">
        40-man roster <ChevronRight className="h-4 w-4" />
      </Link>
    </div>
  );

  const Photo = ({ id, name, url }: { id?: number; name: string; url?: string }) => (
    <span className="relative flex h-28 w-28 items-end justify-center overflow-hidden rounded-full border-2 border-white/20 bg-[#0b3e75]">
      {id || url ? <img src={url || headshot(id!)} alt={name} loading="lazy" className="h-full w-full object-cover" /> : <img src={logo} alt="" className="m-auto h-16 w-16 object-contain" />}
    </span>
  );

  return (
    <section data-guide="fa-row" className="relative py-6 sm:py-8" aria-label="Free Agency">
      <Title><abbr title="Free Agency" className="no-underline sm:hidden">FA</abbr><span className="hidden sm:inline">Free Agency</span></Title>
      {tabs}
      <div className={rowCls} style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
        {isLoading && [0, 1, 2].map((i) => <div key={i} className={`${cardW} h-[250px] animate-pulse rounded-lg bg-card/70`} />)}
        {isError && <div className={`${cardW} rounded-lg border border-border/50 bg-card/70 p-4 text-sm text-muted-foreground`}>MLB's transactions feed is not answering right now.</div>}
        {!isLoading && !isError && items.length === 0 && <div className={`${cardW} rounded-lg border border-border/50 bg-card/70 p-4 text-sm text-muted-foreground`}>No Mets {tab} in the last nine months.</div>}
        {items.map((t) => (
          <article key={t.id} className={`${cardW} relative overflow-hidden rounded-lg border border-border/50`} style={{ backgroundImage: "linear-gradient(160deg,#0f2a4d,#07111d 90%)" }}>
            <img src={logo} alt="" aria-hidden className="absolute -right-6 -top-6 h-32 w-32 object-contain opacity-10" />
            <div className="relative flex flex-col items-center gap-3 px-4 pb-3 pt-4">
              <div className="flex w-full items-center justify-between">
                <span className="rounded-full bg-[#ff5a1f] px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-white">{t.typeDesc}</span>
                <span className="text-xs font-bold uppercase tracking-wider text-white/70">{dayLabel(t.date)}</span>
              </div>
              <div className="flex items-center gap-3">
                {t.fromId && isTrade(t) ? <Logo id={t.fromId} className="h-10 w-10" /> : null}
                <Photo id={t.playerId} name={t.player} url={t.photoUrl} />
                {t.toId ? <Logo id={t.toId} className="h-10 w-10" /> : null}
              </div>
              <p className="text-center font-display text-xl font-bold uppercase leading-tight tracking-wide text-white">{t.player || t.typeDesc}</p>
              <p className="line-clamp-3 min-h-[3.4rem] text-center text-[13px] leading-snug text-white/70">{t.description}</p>
              {onRoster(t) !== undefined && (
                <span className={`rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider ${onRoster(t) ? "bg-emerald-600 text-white" : "bg-white/15 text-white/70"}`}>
                  {onRoster(t) ? "On the 40-man today" : "Not on the 40-man"}
                </span>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function HomeSpringTrackerSection() {
  return (
    <>
      <MetsTrackerSection />
      <div className="section-divider my-1" />
      <SpringTrainingSection />
    </>
  );
}
