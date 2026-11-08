import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/metsxmfanzone-logo.png";
import { oppLogo, palette } from "@/components/lineup/LineupCardArt";
import {
  fetchMlbLineup,
  todayET,
  useLineupDesign,
  DEFAULT_LINEUP_DESIGN,
  type LineupGameInfo,
  type LineupPitcher,
  type LineupPlayerRow,
  type MlbLineupResult,
} from "@/lib/lineupDesign";

// Sample lineup, only used when the page is opened with ?lineup-test=1 (nobody else sees it).
const TEST_GAME: LineupGameInfo = { opponent: "Braves", isHome: true, dateLabel: "Sun Nov 8", timeLabel: "7:10 PM" };
const TEST_LINEUP: LineupPlayerRow[] = [
  { position: 1, name: "Francisco Lindor", fieldPosition: "SS" },
  { position: 2, name: "Juan Soto", fieldPosition: "RF" },
  { position: 3, name: "Pete Alonso", fieldPosition: "1B" },
  { position: 4, name: "Brett Baty", fieldPosition: "3B" },
  { position: 5, name: "Mark Vientos", fieldPosition: "DH" },
  { position: 6, name: "Jeff McNeil", fieldPosition: "2B" },
  { position: 7, name: "Starling Marte", fieldPosition: "LF" },
  { position: 8, name: "Francisco Alvarez", fieldPosition: "C" },
  { position: 9, name: "Tyrone Taylor", fieldPosition: "CF" },
];
const TEST_PITCHER: LineupPitcher = { name: "Kodai Senga", hand: "RHP" };

/** Home page lineup, laid out left to right like the other home sections. Hidden until it is turned on in Admin > Lineup Card. */
export default function HomeLineupRow() {
  const test = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("lineup-test");
  const { data: fetched } = useLineupDesign();
  const design = test ? { ...(fetched ?? DEFAULT_LINEUP_DESIGN), enabled: true } : fetched;
  const override = design?.override && design.override.date === todayET() ? design.override : null;

  const { data: mlb } = useQuery<MlbLineupResult>({
    queryKey: ["lineup-card-mlb", todayET()],
    queryFn: () => fetchMlbLineup(),
    enabled: !!design?.enabled && !override && !test,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  });

  const scroller = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  if (!design?.enabled) return null;
  const game = test ? TEST_GAME : override ? override.game : mlb?.game ?? null;
  const lineup = test ? TEST_LINEUP : override ? override.lineup : mlb?.lineup ?? [];
  const pitcher = test ? TEST_PITCHER : override ? override.pitcher : mlb?.pitcher ?? null;
  if (!game && lineup.length === 0) return null; // no game today

  const p = palette(design);
  const opp = game?.opponent || "TBD";
  const oppImg = oppLogo(opp);
  const cardBg = design.template === "classic" ? "#ffffff" : p.panel;
  const cardBorder = `1px solid ${p.line}`;
  const count = 1 + lineup.slice(0, 9).length + (design.showPitcher && pitcher ? 1 : 0);

  const scroll = (dir: "left" | "right") => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({ left: el.scrollLeft + (dir === "left" ? -1 : 1) * el.clientWidth * 0.8, behavior: "smooth" });
  };
  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const step = (el.firstElementChild as HTMLElement | null)?.offsetWidth ?? 150;
    setActive(Math.max(0, Math.min(count - 1, Math.round(el.scrollLeft / (step + 12)))));
  };

  return (
    <section className="py-3 sm:py-4" aria-label="Today's lineup">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
            <ClipboardList className="h-4 w-4 shrink-0 text-primary sm:h-6 sm:w-6" />
            <h2 className="truncate text-sm font-bold text-foreground sm:text-xl md:text-2xl">{design.title}</h2>
            {game && (
              <span className="ml-1 hidden shrink-0 text-xs font-medium text-muted-foreground sm:inline">
                {game.isHome ? "vs" : "at"} {opp} · {game.dateLabel} · {game.timeLabel}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="icon" onClick={() => scroll("left")} className="hidden h-8 w-8 rounded-full bg-secondary/50 md:inline-flex" aria-label="Scroll lineup left">
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button type="button" variant="ghost" size="icon" onClick={() => scroll("right")} className="hidden h-8 w-8 rounded-full bg-secondary/50 md:inline-flex" aria-label="Scroll lineup right">
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      <div
        ref={scroller}
        onScroll={onScroll}
        className="flex snap-x gap-3 overflow-x-auto scroll-px-4 px-4 pb-3 scrollbar-hide max-md:snap-mandatory sm:scroll-px-6 sm:px-6 md:gap-4 lg:scroll-px-8 lg:px-8"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {/* Matchup card */}
        <div
          className="relative flex w-[170px] shrink-0 snap-start flex-col justify-between overflow-hidden rounded-2xl p-3 sm:w-[190px]"
          style={{ background: p.bg, color: p.text, border: cardBorder }}
        >
          <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: design.accent }} />
          <div className="mt-1 flex items-center gap-2">
            <img src={logo} alt="" className="h-8 w-8 rounded-lg object-cover" />
            <p className="truncate text-[10px] font-extrabold uppercase leading-tight tracking-[0.18em]" style={{ color: design.accent }}>{design.subtitle}</p>
          </div>
          <div className="my-3 flex items-center justify-center gap-2">
            <img src="https://www.mlbstatic.com/team-logos/121.svg" alt="Mets" className="h-10 w-10 object-contain" />
            <span className="text-xs font-black uppercase" style={{ color: design.accent }}>{game ? (game.isHome ? "vs" : "at") : "vs"}</span>
            {oppImg ? <img src={oppImg} alt={opp} className="h-10 w-10 object-contain" /> : <span className="text-sm font-black uppercase">{opp}</span>}
          </div>
          <div className="text-center leading-tight">
            <p className="text-sm font-black uppercase">{opp}</p>
            {game && <p className="text-[11px] font-semibold" style={{ color: p.sub }}>{game.dateLabel} · {game.timeLabel}</p>}
          </div>
        </div>

        {lineup.length === 0 && (
          <div className="flex w-[240px] shrink-0 snap-start items-center justify-center rounded-2xl p-4 text-center text-sm font-semibold" style={{ background: cardBg, color: p.sub, border: cardBorder }}>
            Lineup coming soon. Check back about two hours before first pitch.
          </div>
        )}

        {lineup.slice(0, 9).map((r) => {
          const parts = r.name.split(" ");
          const last = parts.length > 1 ? parts.slice(1).join(" ") : r.name;
          const first = parts.length > 1 ? parts[0] : "";
          return (
            <div
              key={r.position}
              className="relative flex w-[132px] shrink-0 snap-start flex-col items-center rounded-2xl px-2 pb-3 pt-4 text-center sm:w-[148px]"
              style={{ background: cardBg, color: design.template === "classic" ? p.text : "#fff", border: cardBorder }}
            >
              <span className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-xs font-black" style={{ background: design.accent, color: p.onAccent }}>
                {r.position}
              </span>
              {design.showPhotos &&
                (r.imageUrl ? (
                  <img src={r.imageUrl} alt={r.name} loading="lazy" className="h-[72px] w-[72px] rounded-full object-cover sm:h-20 sm:w-20" style={{ background: p.row }} />
                ) : (
                  <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full text-lg font-black sm:h-20 sm:w-20" style={{ background: p.row, color: p.sub }}>
                    {parts.map((n) => n[0]).join("").slice(0, 2)}
                  </span>
                ))}
              <p className="mt-2 w-full truncate text-[11px] font-semibold leading-none" style={{ color: p.sub }}>{first}</p>
              <p className="w-full truncate text-[15px] font-black uppercase leading-tight">{last}</p>
              <span className="mt-1.5 rounded-md px-2 py-0.5 text-[11px] font-black" style={{ background: design.accent, color: p.onAccent }}>{r.fieldPosition}</span>
            </div>
          );
        })}

        {design.showPitcher && pitcher && (
          <div className="flex w-[150px] shrink-0 snap-start flex-col items-center justify-center rounded-2xl px-3 py-4 text-center sm:w-[170px]" style={{ background: p.bg, color: p.text, border: cardBorder }}>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em]" style={{ color: design.accent }}>Starting pitcher</p>
            <p className="mt-2 text-base font-black uppercase leading-tight">{pitcher.name}</p>
            {pitcher.hand && <span className="mt-2 rounded-md px-2 py-0.5 text-xs font-black" style={{ background: design.accent, color: p.onAccent }}>{pitcher.hand}</span>}
          </div>
        )}
      </div>

      {/* Page dots (phones only) */}
      <div className="flex items-center justify-center gap-1.5 md:hidden" aria-hidden="true">
        {Array.from({ length: Math.min(count, 11) }).map((_, i) => (
          <span key={i} className={`h-1.5 rounded-full transition-all ${i === active ? "w-4 bg-primary" : "w-1.5 bg-muted-foreground/30"}`} />
        ))}
      </div>
    </section>
  );
}
