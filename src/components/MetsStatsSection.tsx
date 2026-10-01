import { useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";
import metsLogo from "@/assets/metsxmfanzone-logo.png";

interface Leader {
  rank: number;
  value: string;
  person: { id: number; fullName: string };
}

interface Category {
  key: string;
  label: string;
  leaders: Leader[];
}

const CATEGORIES: { key: string; label: string }[] = [
  { key: "homeRuns", label: "Home Runs" },
  { key: "battingAverage", label: "Batting Avg" },
  { key: "runsBattedIn", label: "RBI" },
  { key: "hits", label: "Hits" },
  { key: "runs", label: "Runs" },
  { key: "earnedRunAverage", label: "ERA" },
];

const MetsStatsSection = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaders = async () => {
      try {
        const url = `https://statsapi.mlb.com/api/v1/teams/121/leaders?leaderCategories=${CATEGORIES.map(
          (c) => c.key
        ).join(",")}&season=2026&leaderGameTypes=R&limit=3`;
        const res = await fetch(url);
        const data = await res.json();
        const mapped: Category[] = CATEGORIES.map((c) => {
          const found = data.teamLeaders?.find(
            (t: any) => t.leaderCategory === c.key
          );
          return {
            key: c.key,
            label: c.label,
            leaders: (found?.leaders || []).slice(0, 3).map((l: any) => ({
              rank: l.rank,
              value: l.value,
              person: l.person,
            })),
          };
        });
        setCategories(mapped);
      } catch (e) {
        console.error("Failed to load Mets leaders", e);
      } finally {
        setLoading(false);
      }
    };
    fetchLeaders();
  }, []);

  const num = (v: string) => Number(String(v).replace(/^\./, "0."));

  return (
    <section aria-labelledby="mets-leaders-title" className="py-6 sm:py-8">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <p className="mb-1 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.18em] text-primary">
              <span className="h-0.5 w-4 bg-primary" /> 2026 Regular Season
            </p>
            <h2 id="mets-leaders-title" className="flex items-center gap-2.5 text-[25px] font-bold uppercase leading-none tracking-wide text-foreground sm:text-3xl">
              <img src={metsLogo} alt="" className="h-7 w-7 object-contain" loading="lazy" />
              Mets Team Leaders
            </h2>
          </div>
          <span className="hidden text-xs text-muted-foreground sm:block">Live from MLB Stats</span>
        </div>

        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 scrollbar-hide sm:mx-0 sm:px-0 md:grid md:snap-none md:grid-cols-2 md:overflow-visible lg:grid-cols-3">
          {loading
            ? CATEGORIES.map((c) => <div key={c.key} className="h-[250px] w-[82vw] max-w-[340px] shrink-0 animate-pulse rounded-2xl bg-card/60 md:w-auto md:max-w-none" />)
            : categories.map((cat) => {
                const [top, ...rest] = cat.leaders;
                const max = Math.max(...cat.leaders.map((l) => num(l.value)).filter((n) => !Number.isNaN(n)), 0);
                const lowerIsBetter = cat.key === "earnedRunAverage";
                return (
                  <article
                    key={cat.key}
                    className="relative w-[82vw] max-w-[340px] shrink-0 snap-start overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-[#0a2a52] via-card to-card p-4 md:w-auto md:max-w-none"
                  >
                    <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-primary/20 blur-2xl" aria-hidden="true" />
                    <div className="relative mb-3 flex items-center justify-between">
                      <h3 className="font-display text-xl font-bold uppercase leading-none tracking-wide text-foreground">{cat.label}</h3>
                      <TrendingUp className="h-4 w-4 text-primary/70" aria-hidden="true" />
                    </div>

                    {!top ? (
                      <p className="py-10 text-center text-sm text-muted-foreground">No data yet</p>
                    ) : (
                      <>
                        <div className="relative flex items-center gap-3">
                          <img
                            src={`https://midfield.mlbstatic.com/v1/people/${top.person.id}/spots/120`}
                            alt={top.person.fullName}
                            loading="lazy"
                            className="h-16 w-16 shrink-0 rounded-full border-2 border-primary bg-muted object-cover"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
                            }}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-primary">Team leader</p>
                            <p className="truncate text-[17px] font-bold leading-tight text-foreground">{top.person.fullName}</p>
                          </div>
                          <span className="font-display text-[44px] font-bold leading-none text-primary" style={{ fontVariantNumeric: "tabular-nums" }}>
                            {top.value}
                          </span>
                        </div>

                        <ul className="relative mt-4 space-y-3">
                          {rest.map((l, idx) => {
                            const n = num(l.value);
                            const pct = lowerIsBetter ? 0 : max > 0 && !Number.isNaN(n) ? Math.max(8, (n / max) * 100) : 0;
                            return (
                              <li key={`${l.person.id}-${idx}`} className="flex items-center gap-3">
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-bold text-muted-foreground">{l.rank}</span>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-baseline justify-between gap-2">
                                    <span className="truncate text-[14px] font-semibold text-foreground/90">{l.person.fullName}</span>
                                    <span className="text-[15px] font-bold text-foreground" style={{ fontVariantNumeric: "tabular-nums" }}>{l.value}</span>
                                  </div>
                                  {pct > 0 && (
                                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted/50" role="presentation">
                                      <div className="h-full rounded-full bg-primary/70" style={{ width: `${pct}%` }} />
                                    </div>
                                  )}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </>
                    )}
                  </article>
                );
              })}
        </div>
      </div>
    </section>
  );
};

export default MetsStatsSection;
