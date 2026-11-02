import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Play } from "lucide-react";
import logo from "@/assets/metsxmfanzone-logo.png";
import { METS_RADAR, type RadarStatus } from "@/data/metsRadar";

// Home page: Spring Training and Mets Tracker, built like the other home rows
// (title row + side-scrolling cards). Data: MLB's public feeds + src/data/metsRadar.ts.
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
type Tx = { id: number; date: string; typeCode: string; typeDesc: string; playerId?: number; player: string; fromId?: number; toId?: number; description: string };

const isTrade = (t: Tx) => t.typeCode === "TR" || /trade/i.test(t.typeDesc);
const isSigning = (t: Tx) => !isTrade(t) && (/signed|extension/i.test(t.typeDesc) || ["SGN", "SFA", "SE"].includes(t.typeCode));

const STATUS: Record<RadarStatus, { text: string; cls: string }> = {
  in_talks: { text: "In talks", cls: "bg-red-600" },
  linked: { text: "Linked", cls: "bg-amber-600" },
  long_shot: { text: "Long shot", cls: "bg-slate-600" },
};

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

function useTransactions() {
  return useQuery({
    queryKey: ["home-mets-transactions"],
    staleTime: 15 * 60_000,
    queryFn: async (): Promise<Tx[]> => {
      const end = new Date();
      const start = new Date(end.getTime() - 150 * 86_400_000);
      const res = await fetch(`https://statsapi.mlb.com/api/v1/transactions?teamId=${METS}&startDate=${ymd(start)}&endDate=${ymd(end)}`);
      if (!res.ok) throw new Error("transactions");
      const json = await res.json();
      return (json.transactions ?? [])
        .map((x: any): Tx => ({ id: x.id, date: x.effectiveDate || x.date, typeCode: x.typeCode ?? "", typeDesc: x.typeDesc ?? "", playerId: x.person?.id, player: x.person?.fullName ?? "", fromId: x.fromTeam?.id, toId: x.toTeam?.id, description: x.description ?? "" }))
        .sort((a: Tx, b: Tx) => +new Date(b.date) - +new Date(a.date));
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
      <Title right={<Link to="/spring-training-live" className="flex min-h-[44px] items-center gap-1 text-sm font-semibold text-primary hover:text-primary/80">Watch live <ChevronRight className="h-4 w-4" /></Link>}>Spring Training</Title>
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
  const [tab, setTab] = useState<"trades" | "signings" | "radar">("trades");
  const { data: txs = [], isLoading, isError } = useTransactions();
  const items = tab === "trades" ? txs.filter(isTrade).slice(0, 10) : tab === "signings" ? txs.filter(isSigning).slice(0, 10) : [];

  const tabs = (
    <div className="flex gap-1.5" role="tablist" aria-label="Free Agency">
      {([["trades", "Trades"], ["signings", "Signings"], ["radar", "Radar"]] as const).map(([v, l]) => (
        <button key={v} type="button" role="tab" aria-selected={tab === v} onClick={() => setTab(v)}
          className={`min-h-[40px] rounded-lg border border-[#ff5a1f] px-3.5 font-display text-sm font-bold uppercase tracking-wider transition-colors sm:px-4 sm:text-base ${tab === v ? "bg-[#ff5a1f] text-white" : "text-foreground hover:bg-[#ff5a1f]/15"}`}>{l}</button>
      ))}
    </div>
  );

  const Photo = ({ id, name }: { id?: number; name: string }) => (
    <span className="relative flex h-28 w-28 items-end justify-center overflow-hidden rounded-full border-2 border-white/20 bg-[#0b3e75]">
      {id ? <img src={headshot(id)} alt={name} loading="lazy" className="h-full w-full object-cover" /> : <img src={logo} alt="" className="m-auto h-16 w-16 object-contain" />}
    </span>
  );

  return (
    <section className="relative py-6 sm:py-8" aria-label="Mets Tracker">
      <Title right={tabs}><abbr title="Free Agency" className="no-underline sm:hidden">FA</abbr><span className="hidden sm:inline">Free Agency</span></Title>
      <div className={rowCls} style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
        {tab !== "radar" && isLoading && [0, 1, 2].map((i) => <div key={i} className={`${cardW} h-[250px] animate-pulse rounded-lg bg-card/70`} />)}
        {tab !== "radar" && isError && <div className={`${cardW} rounded-lg border border-border/50 bg-card/70 p-4 text-sm text-muted-foreground`}>MLB's transactions feed is not answering right now.</div>}
        {tab !== "radar" && !isLoading && !isError && items.length === 0 && <div className={`${cardW} rounded-lg border border-border/50 bg-card/70 p-4 text-sm text-muted-foreground`}>No Mets {tab} in the last five months.</div>}
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
                <Photo id={t.playerId} name={t.player} />
                {t.toId ? <Logo id={t.toId} className="h-10 w-10" /> : null}
              </div>
              <p className="text-center font-display text-xl font-bold uppercase leading-tight tracking-wide text-white">{t.player || t.typeDesc}</p>
              <p className="line-clamp-3 min-h-[3.4rem] text-center text-[13px] leading-snug text-white/70">{t.description}</p>
            </div>
          </article>
        ))}
        {tab === "radar" && METS_RADAR.length === 0 && <div className={`${cardW} rounded-lg border border-border/50 bg-card/70 p-4 text-sm text-muted-foreground`}>No active rumors on the Radar right now. Check back as the offseason heats up.</div>}
        {tab === "radar" && METS_RADAR.map((r) => (
          <article key={r.player} className={`${cardW} relative overflow-hidden rounded-lg border border-border/50`} style={{ backgroundImage: "linear-gradient(160deg,#3a1a0a,#07111d 90%)" }}>
            <img src={logo} alt="" aria-hidden className="absolute -right-6 -top-6 h-32 w-32 object-contain opacity-10" />
            <div className="relative flex flex-col items-center gap-3 px-4 pb-4 pt-4">
              <div className="flex w-full items-center justify-between">
                <span className={`rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-white ${STATUS[r.status].cls}`}>{STATUS[r.status].text}</span>
                <span className="text-xs font-bold uppercase tracking-wider text-white/70">{r.position}</span>
              </div>
              <div className="flex items-center gap-3"><Photo id={r.mlbId} name={r.player} />{r.teamId ? <Logo id={r.teamId} className="h-10 w-10" /> : null}</div>
              <p className="text-center font-display text-xl font-bold uppercase leading-tight tracking-wide text-white">{r.player}</p>
              <p className="line-clamp-2 text-center text-[13px] text-white/70">{r.why}</p>
              <div className="h-2 w-full rounded-full bg-white/15" role="img" aria-label={`Rumor heat ${r.heat} of 5`}><div className="h-2 rounded-full bg-[#ff5a1f]" style={{ width: `${r.heat * 20}%` }} /></div>
              <p className="text-[11px] text-white/50">Source: {r.source}</p>
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
