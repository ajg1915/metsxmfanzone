import { useEffect, useMemo, useState } from "react";
import { Calendar, MapPin, Home, Plane, Tv, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

// Schedules for the other New York teams, kept fresh hourly in the
// `ny_sports_games` table (filled from ESPN's free schedule feed).

type TeamKey = "jets" | "giants" | "knicks" | "nets" | "rangers" | "islanders";

type NYGame = {
  event_id: string;
  team_key: TeamKey;
  league: "NFL" | "NBA" | "NHL";
  team_name: string;
  opponent_name: string | null;
  opponent_logo: string | null;
  is_home: boolean;
  start_time: string;
  venue: string | null;
  tv: string | null;
  season_type: number;
  state: "pre" | "in" | "post" | null;
  status_detail: string | null;
  team_score: string | null;
  opponent_score: string | null;
  result: "W" | "L" | "T" | null;
};

const TEAMS: { key: TeamKey; label: string; league: string; color: string }[] = [
  { key: "jets", label: "Jets", league: "NFL", color: "#125740" },
  { key: "giants", label: "Giants", league: "NFL", color: "#0B2265" },
  { key: "knicks", label: "Knicks", league: "NBA", color: "#F58426" },
  { key: "nets", label: "Nets", league: "NBA", color: "#A1A1AA" },
  { key: "rangers", label: "Rangers", league: "NHL", color: "#0038A8" },
  { key: "islanders", label: "Islanders", league: "NHL", color: "#F47D30" },
];

type View = "upcoming" | "results" | "season";

const ET = "America/New_York";
const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-US", { timeZone: ET, ...opts }).format(new Date(iso));
const dayLabel = (iso: string) => fmt(iso, { weekday: "short", month: "short", day: "numeric" });
const timeLabel = (iso: string) => fmt(iso, { hour: "numeric", minute: "2-digit", hour12: true }) + " ET";
const monthLabel = (iso: string) => fmt(iso, { month: "long", year: "numeric" });

const seasonLabel = (t: number) => (t === 1 ? "Preseason" : t === 3 ? "Playoffs" : "Regular Season");

function GameCard({ game, color }: { game: NYGame; color: string }) {
  const live = game.state === "in";
  const final = game.state === "post";
  const hasScore = game.team_score != null && game.opponent_score != null && (live || final);

  return (
    <Card className={cn("overflow-hidden border-l-4 transition-all duration-300 hover:shadow-lg", game.is_home && "bg-primary/5")} style={{ borderLeftColor: color }}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              <Badge variant={game.season_type === 2 ? "default" : "secondary"} className="shrink-0 text-[10px]">
                {seasonLabel(game.season_type)}
              </Badge>
              <Badge
                variant="outline"
                className={cn("text-[10px]", game.is_home ? "border-green-500 text-green-600" : "border-blue-500 text-blue-600")}
              >
                {game.is_home ? <><Home className="mr-1 h-3 w-3" />Home</> : <><Plane className="mr-1 h-3 w-3" />Away</>}
              </Badge>
              {live && (
                <Badge className="animate-pulse bg-red-600 text-[10px] text-white hover:bg-red-600">LIVE</Badge>
              )}
            </div>

            <div className="flex items-center gap-2">
              {game.opponent_logo && (
                <img
                  src={game.opponent_logo}
                  alt={game.opponent_name ?? "Opponent"}
                  className="h-8 w-8 shrink-0 object-contain"
                  loading="lazy"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              )}
              <div className="min-w-0">
                <p className="line-clamp-1 text-sm font-semibold">
                  {game.is_home ? "vs" : "@"} {game.opponent_name ?? "TBD"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {dayLabel(game.start_time)} • {live ? game.status_detail : timeLabel(game.start_time)}
                </p>
              </div>
            </div>

            {game.venue && (
              <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="line-clamp-1">{game.venue}</span>
              </div>
            )}
            {game.tv && !final && (
              <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <Tv className="h-3 w-3 shrink-0" />
                <span className="line-clamp-1">{game.tv}</span>
              </div>
            )}
          </div>

          {hasScore && (
            <div className="shrink-0 text-right">
              <div
                className={cn(
                  "text-lg font-bold",
                  game.result === "W" ? "text-green-600" : game.result === "L" ? "text-red-500" : "text-foreground",
                )}
              >
                {game.team_score} - {game.opponent_score}
              </div>
              <Badge variant="outline" className="text-[10px]">
                {final ? `${game.result ?? ""} ${game.status_detail ?? "Final"}`.trim() : game.status_detail}
              </Badge>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function NYTeamsSchedule() {
  const [games, setGames] = useState<NYGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [team, setTeam] = useState<TeamKey>("jets");
  const [view, setView] = useState<View>("upcoming");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await (supabase as any)
        .from("ny_sports_games")
        .select("event_id, team_key, league, team_name, opponent_name, opponent_logo, is_home, start_time, venue, tv, season_type, state, status_detail, team_score, opponent_score, result")
        .order("start_time", { ascending: true });
      if (cancelled) return;
      if (error) setError(true);
      else setGames((data ?? []) as NYGame[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!loading && window.location.hash === "#ny-teams") {
      requestAnimationFrame(() => document.getElementById("ny-teams")?.scrollIntoView({ behavior: "smooth" }));
    }
  }, [loading]);

  const teamInfo = TEAMS.find((t) => t.key === team)!;
  const teamGames = useMemo(() => games.filter((g) => g.team_key === team), [games, team]);

  const shown = useMemo(() => {
    if (view === "upcoming") return teamGames.filter((g) => g.state !== "post").slice(0, 12);
    if (view === "results") return teamGames.filter((g) => g.state === "post").reverse().slice(0, 12);
    return teamGames;
  }, [teamGames, view]);

  const grouped = useMemo(() => {
    if (view !== "season") return null;
    return shown.reduce<Record<string, NYGame[]>>((acc, g) => {
      const m = monthLabel(g.start_time);
      (acc[m] ??= []).push(g);
      return acc;
    }, {});
  }, [shown, view]);

  const record = useMemo(() => {
    const reg = teamGames.filter((g) => g.season_type === 2 && g.state === "post");
    const w = reg.filter((g) => g.result === "W").length;
    const l = reg.filter((g) => g.result === "L").length;
    return reg.length ? `${w}-${l}${reg.length - w - l ? `-${reg.length - w - l}` : ""}` : null;
  }, [teamGames]);

  return (
    <section id="ny-teams" className="mt-16 scroll-mt-20">
      <div className="mb-6 text-center">
        <h2 className="mb-2 text-xl font-bold sm:text-2xl md:text-3xl">New York Teams</h2>
        <p className="text-sm text-muted-foreground sm:text-base">Jets, Giants, Knicks, Nets, Rangers & Islanders schedules</p>
      </div>

      {/* Team picker — scrolls sideways on phones */}
      <div className="-mx-4 mb-4 overflow-x-auto px-4 pb-1">
        <div className="mx-auto flex w-max gap-2">
          {TEAMS.map((t) => (
            <Button
              key={t.key}
              size="sm"
              variant={team === t.key ? "default" : "outline"}
              onClick={() => setTeam(t.key)}
              className="h-9 gap-1.5 whitespace-nowrap"
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.color }} aria-hidden />
              {t.label}
              <span className="text-[10px] opacity-60">{t.league}</span>
            </Button>
          ))}
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-center gap-2">
        {([
          ["upcoming", "Upcoming"],
          ["results", "Results"],
          ["season", "Full Season"],
        ] as [View, string][]).map(([key, label]) => (
          <Button key={key} size="sm" variant={view === key ? "secondary" : "ghost"} onClick={() => setView(key)} className="h-8">
            {label}
          </Button>
        ))}
        {record && (
          <Badge variant="outline" className="ml-1 text-xs">
            {teamInfo.label} {record}
          </Badge>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Couldn't load the schedules right now. Try again in a bit.</p>
      ) : shown.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {view === "results" ? `No ${teamInfo.label} games played yet this season.` : `No upcoming ${teamInfo.label} games listed yet.`}
        </p>
      ) : grouped ? (
        <div className="space-y-8">
          {Object.entries(grouped).map(([month, monthGames]) => (
            <div key={month}>
              <h3 className="sticky top-16 z-10 mb-4 flex items-center gap-2 bg-background/95 py-2 text-lg font-bold backdrop-blur-sm sm:text-xl">
                <Calendar className="h-5 w-5 text-primary" />
                {month}
                <Badge variant="secondary" className="ml-2">{monthGames.length} games</Badge>
              </h3>
              <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
                {monthGames.map((g) => <GameCard key={g.event_id} game={g} color={teamInfo.color} />)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
          {shown.map((g) => <GameCard key={g.event_id} game={g} color={teamInfo.color} />)}
        </div>
      )}

      <p className="mt-6 text-center text-sm text-muted-foreground">
        * Schedules from ESPN, updated hourly. Times in Eastern. Subject to change.
      </p>
    </section>
  );
}
