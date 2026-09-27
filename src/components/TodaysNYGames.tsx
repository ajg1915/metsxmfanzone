import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Tv, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

// Home page scoreboard: today's games for the Jets, Giants, Knicks, Nets,
// Rangers and Islanders, all sports together. Rolls over to the next day's
// games automatically. Data: `ny_sports_games` (synced from ESPN's free feed).

type Game = {
  event_id: string;
  team_key: string;
  league: "NFL" | "NBA" | "NHL";
  team_name: string;
  team_abbr: string;
  opponent_name: string | null;
  opponent_logo: string | null;
  is_home: boolean;
  start_time: string;
  tv: string | null;
  season_type: number;
  state: "pre" | "in" | "post" | null;
  status_detail: string | null;
  team_score: string | null;
  opponent_score: string | null;
  result: "W" | "L" | "T" | null;
};

const ET = "America/New_York";
const etDate = (d: Date | string) => new Intl.DateTimeFormat("en-CA", { timeZone: ET }).format(new Date(d));
const etTime = (iso: string) =>
  new Intl.DateTimeFormat("en-US", { timeZone: ET, hour: "numeric", minute: "2-digit" }).format(new Date(iso)) + " ET";
const etDayLabel = (iso: string) =>
  new Intl.DateTimeFormat("en-US", { timeZone: ET, weekday: "long", month: "short", day: "numeric" }).format(new Date(iso));

// ESPN's PNG logo for the NY team itself (opponent logos come with each game)
const nyLogo = (g: Game) => `https://a.espncdn.com/i/teamlogos/${g.league.toLowerCase()}/500/${g.team_abbr.toLowerCase()}.png`;
const shortName = (full: string | null) => (full ? full.split(" ").slice(-1)[0] : "TBD");
// "Trail Blazers", "Maple Leafs", "Red Wings", "Golden Knights" etc. keep two words
const TWO_WORD = /(Trail Blazers|Maple Leafs|Red Wings|Blue Jackets|Golden Knights|Red Sox|White Sox)$/;
const teamShort = (full: string | null) => (full && TWO_WORD.test(full) ? full.match(TWO_WORD)![1] : shortName(full));

const LEAGUE_COLOR: Record<string, string> = { NFL: "bg-[#013369]", NBA: "bg-[#C9082A]", NHL: "bg-zinc-700" };

function Logo({ src, alt }: { src: string | null; alt: string }) {
  if (!src) return <div className="h-12 w-12" />;
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className="h-12 w-12 object-contain drop-shadow"
      onError={(e) => {
        (e.target as HTMLImageElement).style.visibility = "hidden";
      }}
    />
  );
}

function GameCard({ g }: { g: Game }) {
  const live = g.state === "in";
  const final = g.state === "post";
  const showScore = (live || final) && g.team_score != null && g.opponent_score != null;

  return (
    <div
      className={cn(
        "w-[260px] shrink-0 snap-start rounded-xl border bg-card/80 p-4 backdrop-blur-sm transition-colors sm:w-auto",
        live ? "border-red-500/60" : "border-border/50 hover:border-primary/50",
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold text-white", LEAGUE_COLOR[g.league])}>{g.league}</span>
        {live ? (
          <Badge className="animate-pulse bg-red-600 text-[10px] text-white hover:bg-red-600">LIVE · {g.status_detail}</Badge>
        ) : final ? (
          <Badge variant="outline" className="text-[10px]">{g.status_detail ?? "Final"}</Badge>
        ) : (
          <span className="text-xs font-semibold text-foreground">{etTime(g.start_time)}</span>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 flex-col items-center text-center">
          <Logo src={nyLogo(g)} alt={g.team_name} />
          <span className="mt-1 line-clamp-1 text-sm font-bold">{teamShort(g.team_name)}</span>
          {showScore && (
            <span className={cn("text-2xl font-extrabold", g.result === "W" ? "text-green-500" : g.result === "L" ? "text-muted-foreground" : "text-foreground")}>
              {g.team_score}
            </span>
          )}
        </div>

        <span className="shrink-0 text-xs font-semibold uppercase text-muted-foreground">{g.is_home ? "vs" : "@"}</span>

        <div className="flex min-w-0 flex-1 flex-col items-center text-center">
          <Logo src={g.opponent_logo} alt={g.opponent_name ?? "Opponent"} />
          <span className="mt-1 line-clamp-1 text-sm font-bold">{teamShort(g.opponent_name)}</span>
          {showScore && (
            <span className={cn("text-2xl font-extrabold", g.result === "L" ? "text-foreground" : "text-muted-foreground")}>
              {g.opponent_score}
            </span>
          )}
        </div>
      </div>

      {g.tv && !final && (
        <div className="mt-3 flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
          <Tv className="h-3 w-3 shrink-0" />
          <span className="line-clamp-1">{g.tv}</span>
        </div>
      )}
      {g.season_type !== 2 && (
        <p className="mt-1 text-center text-[10px] text-muted-foreground">{g.season_type === 1 ? "Preseason" : "Playoffs"}</p>
      )}
    </div>
  );
}

export default function TodaysNYGames() {
  const navigate = useNavigate();
  const [games, setGames] = useState<Game[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let stopped = false;
    const load = async () => {
      const from = new Date(Date.now() - 14 * 3600_000).toISOString();
      const to = new Date(Date.now() + 10 * 86400_000).toISOString();
      const { data } = await (supabase as any)
        .from("ny_sports_games")
        .select("event_id, team_key, league, team_name, team_abbr, opponent_name, opponent_logo, is_home, start_time, tv, season_type, state, status_detail, team_score, opponent_score, result")
        .gte("start_time", from)
        .lte("start_time", to)
        .order("start_time", { ascending: true });
      if (!stopped) {
        setGames((data ?? []) as Game[]);
        setLoaded(true);
      }
    };
    load();
    // keep scores fresh while the page is open
    const t = window.setInterval(() => document.visibilityState === "visible" && load(), 5 * 60_000);
    return () => {
      stopped = true;
      window.clearInterval(t);
    };
  }, []);

  // Today's games (Eastern), or the next day that has games
  const { day, dayGames, isToday } = useMemo(() => {
    const today = etDate(new Date());
    const seen = new Set<string>();
    const unique = games.filter((g) => (seen.has(g.event_id) ? false : (seen.add(g.event_id), true)));
    const todays = unique.filter((g) => etDate(g.start_time) === today);
    if (todays.length) return { day: todays[0].start_time, dayGames: sortGames(todays), isToday: true };
    const next = unique.find((g) => etDate(g.start_time) > today);
    if (!next) return { day: null, dayGames: [] as Game[], isToday: false };
    const nextDay = etDate(next.start_time);
    return { day: next.start_time, dayGames: sortGames(unique.filter((g) => etDate(g.start_time) === nextDay)), isToday: false };
  }, [games]);

  if (!loaded || dayGames.length === 0) return null;

  return (
    <section className="relative py-6">
      <div className="container mx-auto max-w-7xl px-4">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-foreground md:text-2xl">{isToday ? "Today's NY Games" : "Next Up: NY Games"}</h2>
            <p className="text-xs text-muted-foreground sm:text-sm">
              {day ? etDayLabel(day) : ""} · Jets, Giants, Knicks, Nets, Rangers & Islanders
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 gap-1 text-primary"
            onClick={() => navigate("/mets-schedule-2026#ny-teams")}
          >
            Schedules <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3 xl:grid-cols-4">
          {dayGames.map((g) => (
            <GameCard key={g.event_id} g={g} />
          ))}
        </div>
      </div>
    </section>
  );
}

// Live first, then upcoming by start time, finished games last
function sortGames(list: Game[]) {
  const rank = (g: Game) => (g.state === "in" ? 0 : g.state === "post" ? 2 : 1);
  return [...list].sort((a, b) => rank(a) - rank(b) || new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
}
