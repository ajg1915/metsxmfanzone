import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, MapPin, Play, Radar as RadarIcon, Sun } from "lucide-react";
import { METS_RADAR, type RadarStatus } from "@/data/metsRadar";

// Home page: Spring Training (countdown + next games) next to the Mets Tracker
// (trades, signings, radar). All data comes from MLB's public feeds or src/data/metsRadar.ts,
// nothing here reads or writes Supabase.

const METS_TEAM_ID = 121;
const SEASON = 2027;
const ET = "America/New_York";
const FALLBACK_OPENER = "2027-02-19T18:10:00Z"; // Fri Feb 19, 2027 vs Marlins (Mets announcement)

const fmt = (iso: string, o: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-US", { timeZone: ET, ...o }).format(new Date(iso));
const dayLabel = (iso: string) => fmt(`${iso.slice(0, 10)}T12:00:00Z`, { month: "short", day: "numeric" });
const ymd = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: ET }).format(d);

type Game = { id: number; date: string; isHome: boolean; opponent: string; timeTBD: boolean };
type Tx = { id: number; date: string; typeCode: string; typeDesc: string; player: string; description: string };

const isTrade = (t: Tx) => t.typeCode === "TR" || /trade/i.test(t.typeDesc);
const isSigning = (t: Tx) => !isTrade(t) && (/signed|extension/i.test(t.typeDesc) || ["SGN", "SFA", "SE"].includes(t.typeCode));

const STATUS: Record<RadarStatus, { text: string; cls: string }> = {
  in_talks: { text: "In talks", cls: "bg-red-600 text-white" },
  linked: { text: "Linked", cls: "bg-amber-600 text-white" },
  long_shot: { text: "Long shot", cls: "bg-slate-600 text-white" },
};

function useSpringGames() {
  return useQuery({
    queryKey: ["home-spring-games", SEASON],
    staleTime: 30 * 60_000,
    queryFn: async (): Promise<Game[]> => {
      const res = await fetch(
        `https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=${METS_TEAM_ID}&season=${SEASON}&gameType=S&startDate=${SEASON}-02-01&endDate=${SEASON}-04-05&hydrate=team`
      );
      if (!res.ok) throw new Error("schedule");
      const json = await res.json();
      const out: Game[] = [];
      for (const day of json.dates ?? []) {
        for (const g of day.games ?? []) {
          const isHome = g.teams.home.team.id === METS_TEAM_ID;
          out.push({ id: g.gamePk, date: g.gameDate, isHome, opponent: (isHome ? g.teams.away : g.teams.home).team.name, timeTBD: g.status?.startTimeTBD === true });
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
      const res = await fetch(`https://statsapi.mlb.com/api/v1/transactions?teamId=${METS_TEAM_ID}&startDate=${ymd(start)}&endDate=${ymd(end)}`);
      if (!res.ok) throw new Error("transactions");
      const json = await res.json();
      return (json.transactions ?? [])
        .map((x: any): Tx => ({ id: x.id, date: x.effectiveDate || x.date, typeCode: x.typeCode ?? "", typeDesc: x.typeDesc ?? "", player: x.person?.fullName ?? "", description: x.description ?? "" }))
        .sort((a: Tx, b: Tx) => +new Date(b.date) - +new Date(a.date));
    },
  });
}

const Header = ({ icon: Icon, title, to }: { icon: typeof Sun; title: string; to: string }) => (
  <div className="mb-4 flex items-center justify-between">
    <div className="flex items-center gap-2">
      <Icon className="h-5 w-5 text-primary sm:h-6 sm:w-6" />
      <h2 className="text-[25px] font-bold uppercase leading-none tracking-wide text-foreground sm:text-2xl md:text-3xl">{title}</h2>
    </div>
    <Link to={to} className="flex min-h-[44px] items-center gap-1 text-sm font-semibold text-primary transition-colors hover:text-primary/80">
      See all <ChevronRight className="h-4 w-4" />
    </Link>
  </div>
);

function SpringCard() {
  const { data: games = [] } = useSpringGames();
  const now = Date.now();
  const upcoming = games.filter((g) => +new Date(g.date) > now - 6 * 3_600_000);
  const first = games[0];
  const target = +new Date(first?.date ?? FALLBACK_OPENER);
  const days = Math.max(0, Math.ceil((target - now) / 86_400_000));
  const next = upcoming.slice(0, 3);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-border/50 bg-card/80">
      <div className="p-5 sm:p-6" style={{ backgroundImage: "linear-gradient(135deg, rgba(11,62,117,0.6), rgba(7,17,29,0) 75%)" }}>
        <p className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#ff5a1f]"><Sun className="h-3.5 w-3.5" /> Grapefruit League</p>
        <div className="mt-2 flex items-end gap-3" role="timer" aria-label={`${days} days until the first Spring Training game`}>
          <span className="font-display text-6xl font-bold leading-none text-foreground sm:text-7xl">{days}</span>
          <span className="pb-1.5 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{days === 1 ? "day" : "days"} until<br />the first game</span>
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4 shrink-0" />
          {first ? `${fmt(first.date, { weekday: "short", month: "short", day: "numeric" })} ${first.isHome ? "vs" : "at"} ${first.opponent}` : "Fri, Feb 19 vs Miami Marlins"} · Clover Park
        </p>
      </div>
      <ul className="flex-1 divide-y divide-border/40 border-t border-border/40">
        {next.length === 0 && <li className="px-5 py-4 text-sm text-muted-foreground sm:px-6">The full schedule shows here as soon as MLB posts it.</li>}
        {next.map((g) => (
          <li key={g.id} className="flex items-center gap-3 px-5 py-3 sm:px-6">
            <span className="w-14 shrink-0 font-display text-lg font-bold uppercase leading-none text-foreground">{fmt(g.date, { month: "short", day: "numeric" })}</span>
            <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-foreground">{g.isHome ? "vs" : "at"} {g.opponent}</span>
            <span className="shrink-0 text-xs text-muted-foreground">{g.timeTBD ? "Time TBA" : `${fmt(g.date, { hour: "numeric", minute: "2-digit" })} ET`}</span>
          </li>
        ))}
      </ul>
      <div className="grid grid-cols-2 gap-2 border-t border-border/40 p-4 sm:p-5">
        <Link to="/spring-training-live" className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#ff5a1f] font-display text-base font-bold uppercase tracking-wider text-white hover:opacity-90"><Play className="h-4 w-4 fill-white" /> Watch live</Link>
        <Link to="/spring-training" className="flex h-11 items-center justify-center rounded-xl border border-border/60 font-display text-base font-bold uppercase tracking-wider text-foreground hover:border-[#ff5a1f]/60">Schedule</Link>
      </div>
    </div>
  );
}

function TrackerCard() {
  const [tab, setTab] = useState<"trades" | "signings" | "radar">("trades");
  const { data: txs = [], isLoading, isError } = useTransactions();
  const trades = txs.filter(isTrade).slice(0, 4);
  const signings = txs.filter(isSigning).slice(0, 4);
  const radar = METS_RADAR.slice(0, 4);

  const Row = ({ t }: { t: Tx }) => (
    <li className="flex gap-3 px-5 py-3 sm:px-6">
      <span className="w-14 shrink-0 text-xs font-bold uppercase leading-5 tracking-wider text-muted-foreground">{dayLabel(t.date)}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-lg font-bold uppercase leading-tight tracking-wide text-foreground">{t.player || t.typeDesc}</p>
        <p className="line-clamp-2 text-[13px] leading-snug text-muted-foreground">{t.description}</p>
      </div>
    </li>
  );
  const empty = (msg: string) => <li className="px-5 py-5 text-sm text-muted-foreground sm:px-6">{msg}</li>;
  const feedMsg = isLoading ? "Loading…" : isError ? "MLB's transactions feed is not answering right now." : null;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-border/50 bg-card/80">
      <div className="p-5 pb-3 sm:p-6 sm:pb-3" style={{ backgroundImage: "linear-gradient(135deg, rgba(255,90,31,0.18), rgba(7,17,29,0) 70%)" }}>
        <p className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#ff5a1f]"><RadarIcon className="h-3.5 w-3.5" /> New</p>
        <p className="mt-1 font-display text-3xl font-bold uppercase leading-none tracking-wide text-foreground sm:text-4xl">Every move, one place</p>
        <div className="mt-4 flex gap-1.5" role="tablist" aria-label="Mets Tracker">
          {([["trades", "Trades"], ["signings", "Signings"], ["radar", "Radar"]] as const).map(([v, l]) => (
            <button key={v} type="button" role="tab" aria-selected={tab === v} onClick={() => setTab(v)}
              className={`min-h-[40px] rounded-lg border border-[#ff5a1f] px-4 font-display text-base font-bold uppercase tracking-wider transition-colors ${tab === v ? "bg-[#ff5a1f] text-white" : "text-foreground hover:bg-[#ff5a1f]/15"}`}>{l}</button>
          ))}
        </div>
      </div>
      <ul className="flex-1 divide-y divide-border/40 border-t border-border/40">
        {tab === "trades" && (feedMsg ? empty(feedMsg) : trades.length ? trades.map((t) => <Row key={t.id} t={t} />) : empty("No Mets trades in the last five months."))}
        {tab === "signings" && (feedMsg ? empty(feedMsg) : signings.length ? signings.map((t) => <Row key={t.id} t={t} />) : empty("No Mets signings in the last five months."))}
        {tab === "radar" && (radar.length ? radar.map((r) => (
          <li key={r.player} className="flex items-center gap-3 px-5 py-3 sm:px-6">
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-lg font-bold uppercase leading-tight tracking-wide text-foreground">{r.player} <span className="text-xs font-semibold text-muted-foreground">· {r.position}</span></p>
              <p className="line-clamp-1 text-[13px] text-muted-foreground">{r.why}</p>
            </div>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider ${STATUS[r.status].cls}`}>{STATUS[r.status].text}</span>
          </li>
        )) : empty("No active rumors on the Radar right now."))}
      </ul>
      <div className="border-t border-border/40 p-4 sm:p-5">
        <Link to="/mets-tracker" className="flex h-11 items-center justify-center rounded-xl border border-border/60 font-display text-base font-bold uppercase tracking-wider text-foreground hover:border-[#ff5a1f]/60">Open the full tracker</Link>
      </div>
    </div>
  );
}

export default function HomeSpringTrackerSection() {
  return (
    <section className="relative py-6 sm:py-8" aria-label="Spring Training and Mets Tracker">
      <div className="container mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col"><Header icon={Sun} title="Spring Training" to="/spring-training" /><div className="flex-1"><SpringCard /></div></div>
          <div className="flex flex-col"><Header icon={RadarIcon} title="Mets Tracker" to="/mets-tracker" /><div className="flex-1"><TrackerCard /></div></div>
        </div>
      </div>
    </section>
  );
}
