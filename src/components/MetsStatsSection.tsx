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

  return (
    <section className="py-6 sm:py-8 md:py-12 px-4">
      <div className="max-w-6xl mx-auto glass-card glow-blue rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8">
        <div className="text-center mb-5 sm:mb-6 md:mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <img src={metsLogo} alt="MetsXMFanZone" className="w-7 h-7 object-contain" loading="lazy" />
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground leading-tight">
              Mets Team Leaders
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            2026 Regular Season · Live from MLB Stats
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {CATEGORIES.map((c) => (
              <div
                key={c.key}
                className="bg-card/50 rounded-xl p-4 h-44 animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {categories.map((cat) => (
              <div
                key={cat.key}
                className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-4 hover:border-primary/40 transition-all"
              >
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-border/40">
                  <span className="text-xs sm:text-sm font-semibold uppercase tracking-wide text-primary">
                    {cat.label}
                  </span>
                  <TrendingUp className="w-4 h-4 text-primary/60" />
                </div>
                {cat.leaders.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">
                    No data yet
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {cat.leaders.map((l, idx) => (
                      <li
                        key={`${l.person.id}-${idx}`}
                        className="flex items-center gap-3"
                      >
                        <span
                          className={`w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-bold ${
                            idx === 0
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {l.rank}
                        </span>
                        <img
                          src={`https://midfield.mlbstatic.com/v1/people/${l.person.id}/spots/60`}
                          alt={l.person.fullName}
                          loading="lazy"
                          className="w-8 h-8 rounded-full bg-muted object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.visibility =
                              "hidden";
                          }}
                        />
                        <span className="flex-1 text-xs sm:text-sm text-foreground/90 truncate">
                          {l.person.fullName}
                        </span>
                        <span className="text-sm font-bold text-foreground">
                          {l.value}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default MetsStatsSection;
