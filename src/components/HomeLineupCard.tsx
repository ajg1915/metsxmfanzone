import { useAutoLineupFetch } from "@/hooks/useAutoLineupFetch";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Clock, MapPin, Video, TrendingUp, Calendar, RefreshCw, User, Zap, ArrowRight, Activity, Sparkles, Lock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import logoImage from "@/assets/metsxmfanzone-logo.png";
import { getTodayET } from "@/utils/dateUtils";
import PlayerStatsDialog from "@/components/PlayerStatsDialog";

const extractPlayerId = (imageUrl?: string): number | undefined => {
  const match = imageUrl?.match(/\/people\/(\d+)\//);
  return match ? parseInt(match[1]) : undefined;
};

const getSpringFallback = (opponent: string): string => {
  return "";
};

// MLB team name → official team ID (for logo assets)
const MLB_TEAM_IDS: Record<string, number> = {
  "diamondbacks": 109, "braves": 144, "orioles": 110, "red sox": 111,
  "cubs": 112, "white sox": 145, "reds": 113, "guardians": 114,
  "rockies": 115, "tigers": 116, "astros": 117, "royals": 118,
  "angels": 108, "dodgers": 119, "marlins": 146, "brewers": 158,
  "twins": 142, "yankees": 147, "mets": 121, "athletics": 133,
  "phillies": 143, "pirates": 134, "padres": 135, "giants": 137,
  "mariners": 136, "cardinals": 138, "rays": 139, "rangers": 140,
  "blue jays": 141, "nationals": 120,
};

const getTeamLogo = (name?: string): string | undefined => {
  if (!name) return undefined;
  const key = name.toLowerCase().trim();
  for (const [team, id] of Object.entries(MLB_TEAM_IDS)) {
    if (key.includes(team)) return `https://www.mlbstatic.com/team-logos/${id}.svg`;
  }
  return undefined;
};

// Format a YYYY-MM-DD game date safely in Eastern Time (avoids UTC off-by-one).
const formatGameDateET = (ymd: string): string => {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  // noon UTC keeps the same calendar day in ET regardless of DST
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(dt);
};

interface LineupPlayer {
  position: number;
  name: string;
  fieldPosition: string;
  imageUrl?: string;
}
interface StartingPitcher {
  name: string;
  hand: string;
  era: string;
  strikeouts: string;
}
interface HomeLineupCardProps {
  className?: string;
  onLineupLoaded?: (gameDate?: string) => void;
}

interface UpcomingGame {
  date: string;
  opponent: string;
  isHome: boolean;
  time: string;
  probablePitcher?: {
    id?: number;
    name: string;
    hand: string;
  };
}

export default function HomeLineupCard({ className, onLineupLoaded }: HomeLineupCardProps) {
  const { user } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<LineupPlayer | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useAutoLineupFetch(() => {
    queryClient.invalidateQueries({ queryKey: ["today-lineup-card"] });
    queryClient.invalidateQueries({ queryKey: ["todays-predictions"] });
  });

  const handleRefreshLineup = async () => {
    setIsRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-mets-lineup");
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["today-lineup-card"] });
      toast({
        title: "Lineup Updated",
        description: data.playersInLineup > 0
          ? `Found ${data.playersInLineup} players in lineup`
          : data.message || "No lineup available yet",
      });
    } catch (err) {
      console.error("Error refreshing lineup:", err);
      toast({
        title: "Refresh Failed",
        description: "Could not fetch lineup data. Try again later.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const { data: lineupCard, isFetched: lineupFetched } = useQuery({
    queryKey: ["today-lineup-card"],
    queryFn: async () => {
      const todayET = getTodayET();
      const { data, error } = await supabase
        .from("lineup_cards")
        .select("*")
        .gte("game_date", `${todayET}T00:00:00+00:00`)
        .order("game_date", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Fetch Anthony's Predictions for today
  const { data: predictions } = useQuery({
    queryKey: ["todays-predictions"],
    queryFn: async () => {
      const todayStr = getTodayET();
      const { data, error } = await supabase
        .from("daily_player_predictions")
        .select("*")
        .eq("prediction_date", todayStr)
        .order("confidence", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
    staleTime: 3 * 60 * 1000,
  });

  const hasPredictions = predictions && predictions.length > 0;

  const { data: upcomingGames } = useQuery({
    queryKey: ["mlb-mets-upcoming-games"],
    queryFn: async (): Promise<UpcomingGame[]> => {
      const today = new Date();
      const startDate = today.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
      const endDate = new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
      const response = await fetch(
        `https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=121&startDate=${startDate}&endDate=${endDate}&gameType=R&hydrate=probablePitcher,team`
      );
      const data = await response.json();
      if (!data.dates || data.dates.length === 0) return [];
      const games: UpcomingGame[] = [];
      for (const dateEntry of data.dates) {
        for (const game of dateEntry.games) {
          const isHome = game.teams.home.team.id === 121;
          const opponent = isHome ? game.teams.away.team.name : game.teams.home.team.name;
          const metsPitcher = isHome ? game.teams.home.probablePitcher : game.teams.away.probablePitcher;
          const gameDateTime = new Date(game.gameDate);
          const timeStr = gameDateTime.toLocaleTimeString("en-US", {
            hour: "numeric", minute: "2-digit", hour12: true, timeZone: "America/New_York",
          });
          games.push({
            date: dateEntry.date,
            opponent: opponent.replace("New York ", "").replace("Los Angeles ", "").replace("San Francisco ", "").replace("San Diego ", ""),
            isHome,
            time: timeStr,
            probablePitcher: metsPitcher
              ? { id: metsPitcher.id, name: metsPitcher.fullName, hand: metsPitcher.pitchHand?.code === "R" ? "RHP" : metsPitcher.pitchHand?.code === "L" ? "LHP" : "" }
              : undefined,
          });
        }
      }
      return games.slice(0, 5);
    },
    staleTime: 3 * 60 * 1000,
    refetchInterval: 3 * 60 * 1000,
  });

  const { data: standings } = useQuery({
    queryKey: ["mlb-nl-east-standings-2026"],
    queryFn: async () => {
      const response = await fetch("https://statsapi.mlb.com/api/v1/standings?leagueId=104&season=2026&standingsTypes=regularSeason");
      const data = await response.json();
      const nlEast = data.records?.find((r: any) => r.division?.id === 204);
      if (!nlEast) return [];
      return nlEast.teamRecords.map((team: any) => ({
        team_name: team.team.name.replace("New York ", "").replace("Atlanta ", "").replace("Philadelphia ", "").replace("Miami ", "").replace("Washington ", ""),
        wins: team.wins,
        losses: team.losses,
        games_back: team.gamesBack === "-" ? "-" : team.gamesBack,
        position: parseInt(team.divisionRank),
      }));
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  const { data: teamLeaders } = useQuery({
    queryKey: ["mlb-mets-leaders-2026"],
    queryFn: async () => {
      const currentSeason = 2026;
      const fallbackSeason = 2025;
      const fetchLeaderCategory = async (category: string) => {
        const buildUrl = (season: number) =>
          `https://statsapi.mlb.com/api/v1/teams/121/leaders?leaderCategories=${category}&season=${season}&limit=1`;
        const primaryRes = await fetch(buildUrl(currentSeason));
        const response = primaryRes.ok ? primaryRes : await fetch(buildUrl(fallbackSeason));
        if (!response.ok) return null;
        const data = await response.json();
        const leaders = data.teamLeaders?.[0]?.leaders;
        if (leaders && leaders.length > 0) {
          return { name: leaders[0].person.fullName, value: leaders[0].value };
        }
        return null;
      };
      const [AVG, HR, RBI, ERA, W, SO] = await Promise.all([
        fetchLeaderCategory("battingAverage"),
        fetchLeaderCategory("homeRuns"),
        fetchLeaderCategory("runsBattedIn"),
        fetchLeaderCategory("earnedRunAverage"),
        fetchLeaderCategory("wins"),
        fetchLeaderCategory("strikeouts"),
      ]);
      return { AVG, HR, RBI, ERA, W, SO };
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  const lineup = lineupCard?.lineup_data as unknown as LineupPlayer[] | undefined;
  const hasLineup = lineup && Array.isArray(lineup) && lineup.length > 0;
  const pitcher = lineupCard?.starting_pitcher as unknown as StartingPitcher | null;
  const metsStanding = standings?.find((s: any) => s.team_name === "Mets");

  useEffect(() => {
    if (onLineupLoaded && lineupFetched) {
      onLineupLoaded(lineupCard?.game_date);
    }
  }, [lineupCard, onLineupLoaded, lineupFetched]);

  return (
    <>
    <section className="py-6 sm:py-12 lg:py-16 relative overflow-hidden">
      {/* Layered ambient background */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <div className="absolute inset-0" style={{
          background: "radial-gradient(ellipse 70% 50% at 20% 0%, hsl(var(--primary) / 0.10), transparent 60%), radial-gradient(ellipse 60% 50% at 100% 100%, hsl(var(--secondary) / 0.08), transparent 60%)",
        }} />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      </div>

      <div className="container mx-auto px-2 sm:px-6 lg:px-8 max-w-7xl relative z-10">
        {/* Premium Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="relative mb-4 sm:mb-8 rounded-3xl overflow-hidden border border-primary/20 bg-gradient-to-br from-[#001f5b] via-[#002d72] to-[#001233] shadow-2xl"
        >
          {/* Decorative accents */}
          <div className="absolute -top-16 -right-16 w-56 h-56 bg-primary/25 rounded-full blur-3xl" aria-hidden />
          <div className="absolute -bottom-20 -left-10 w-64 h-64 bg-orange-500/20 rounded-full blur-3xl" aria-hidden />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

          <div className="relative flex items-center justify-between gap-3 p-3 sm:p-5">
            <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
              <div className="relative shrink-0">
                <div className="absolute inset-0 bg-primary/50 blur-2xl opacity-70" aria-hidden />
                <div className="relative w-11 h-11 sm:w-16 sm:h-16 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl ring-1 ring-primary/40">
                  <img src={logoImage} alt="MetsXMFanZone" className="w-full h-full object-cover" />
                </div>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="relative flex h-1.5 w-1.5 sm:h-2 sm:w-2 shrink-0">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-70 animate-ping" />
                    <span className="relative inline-flex rounded-full h-full w-full bg-orange-400" />
                  </span>
                  <p className="text-[8px] sm:text-[10px] uppercase tracking-[0.25em] text-orange-300 font-black">Live · 2026 Season</p>
                </div>
                <h2 className="text-lg sm:text-3xl lg:text-4xl font-black tracking-tight text-white leading-none uppercase truncate">
                  Mets <span className="text-orange-400">Game Center</span>
                </h2>
                <p className="hidden sm:block text-[11px] uppercase tracking-[0.18em] text-white/60 font-semibold mt-1.5">Lineup · Standings · Matchup</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefreshLineup}
                disabled={isRefreshing}
                className="text-white/90 hover:text-white hover:bg-white/10 h-8 sm:h-10 px-2 sm:px-3 text-[10px] sm:text-xs rounded-xl border border-white/15 backdrop-blur-md bg-white/5"
              >
                <RefreshCw className={`w-3 h-3 sm:w-3.5 sm:h-3.5 sm:mr-1.5 text-orange-400 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
              <Link to="/video-gallery" className="flex items-center gap-1.5 text-white transition-all text-[10px] sm:text-xs font-black uppercase tracking-wider bg-gradient-to-r from-orange-500 to-orange-600 hover:brightness-110 px-3 sm:px-4 py-1.5 sm:py-2.5 rounded-xl shadow-lg shadow-orange-500/30 h-8 sm:h-10 border border-orange-400/40">
                <Video className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span className="hidden sm:inline">Highlights</span>
                <span className="sm:hidden">Video</span>
              </Link>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-5">
          {/* Main Lineup Card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="lg:col-span-2 rounded-2xl overflow-hidden border border-border/30 backdrop-blur-xl bg-card/60 shadow-xl"
          >
            {/* Top Bar — Matchup Scoreboard */}
            <div className="relative overflow-hidden border-b border-white/5">
              {/* Layered background */}
              <div className="absolute inset-0 bg-[linear-gradient(115deg,#001233_0%,#002d72_45%,#001f5b_100%)]" />
              <div className="absolute inset-0 opacity-[0.07] mix-blend-overlay" style={{
                backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
                backgroundSize: "18px 18px",
              }} aria-hidden />
              <div className="absolute -right-20 -top-24 w-72 h-72 bg-orange-500/25 rounded-full blur-3xl" aria-hidden />
              <div className="absolute -left-16 -bottom-24 w-72 h-72 bg-primary/40 rounded-full blur-3xl" aria-hidden />
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-400/60 to-transparent" />

              <div className="relative p-4 sm:p-6 text-white">
                {/* Eyebrow row */}
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <div className="flex items-center gap-2">
                    <div className="h-[3px] w-6 sm:w-8 rounded-full bg-orange-400" />
                    <p className="text-[9px] sm:text-[10px] uppercase tracking-[0.28em] font-black text-orange-300">Today's Matchup</p>
                  </div>
                  {lineupCard && (
                    <div className="flex items-center gap-1.5 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.15em] bg-white/10 border border-white/15 backdrop-blur-md rounded-full px-2.5 sm:px-3 py-1">
                      <Clock className="w-3 h-3 text-orange-400" />
                      <span>{format(new Date(lineupCard.game_date), "EEE MMM d")}</span>
                      <span className="text-white/40">·</span>
                      <span className="text-orange-300">{lineupCard.game_time}</span>
                    </div>
                  )}
                </div>

                {/* Scoreboard row: NY  VS  OPP */}
                <div className="flex items-center justify-between gap-3 sm:gap-6">
                  {/* Mets side */}
                  <div className="flex items-center gap-2.5 sm:gap-4 min-w-0 flex-1">
                    <div className="relative shrink-0">
                      <div className="absolute inset-0 bg-orange-500/40 blur-xl" aria-hidden />
                      <div className="relative w-14 h-14 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-white/20 to-white/5 backdrop-blur-md flex items-center justify-center border-2 border-white/25 shadow-2xl p-1.5 sm:p-2">
                        <img src="https://www.mlbstatic.com/team-logos/121.svg" alt="Mets" className="w-full h-full object-contain drop-shadow-lg" />
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] sm:text-[10px] uppercase tracking-[0.2em] font-bold text-white/60">Home</p>
                      <p className="font-black text-lg sm:text-2xl leading-none uppercase tracking-tight text-white">Mets</p>
                      <p className="text-[9px] sm:text-[11px] font-bold text-orange-300/90 mt-1 uppercase tracking-wider">
                        {metsStanding ? `${metsStanding.wins}–${metsStanding.losses}` : "2026 Season"}
                      </p>
                    </div>
                  </div>

                  {/* VS divider */}
                  <div className="flex flex-col items-center shrink-0">
                    <div className="w-px h-6 sm:h-8 bg-gradient-to-b from-transparent to-white/30" />
                    <div className="relative my-1 sm:my-1.5">
                      <div className="absolute inset-0 bg-orange-500/40 blur-md" aria-hidden />
                      <span className="relative text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-white bg-black/30 border border-orange-400/40 rounded-full px-2.5 sm:px-3 py-0.5 sm:py-1 backdrop-blur-md">VS</span>
                    </div>
                    <div className="w-px h-6 sm:h-8 bg-gradient-to-t from-transparent to-white/30" />
                  </div>

                  {/* Opponent side */}
                  <div className="flex items-center gap-2.5 sm:gap-4 min-w-0 flex-1 justify-end text-right">
                    <div className="min-w-0">
                      <p className="text-[9px] sm:text-[10px] uppercase tracking-[0.2em] font-bold text-white/60">Away</p>
                      <p className="font-black text-lg sm:text-2xl leading-none uppercase tracking-tight text-white truncate">
                        {lineupCard ? lineupCard.opponent : "TBD"}
                      </p>
                      <p className="text-[9px] sm:text-[11px] font-bold text-white/50 mt-1 uppercase tracking-wider">Visitors</p>
                    </div>
                    <div className="relative shrink-0">
                      <div className="absolute inset-0 bg-white/15 blur-xl" aria-hidden />
                      <div className="relative w-14 h-14 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-white/15 to-white/5 backdrop-blur-md flex items-center justify-center border-2 border-white/15 shadow-2xl p-1.5 sm:p-2">
                        {getTeamLogo(lineupCard?.opponent) ? (
                          <img src={getTeamLogo(lineupCard?.opponent)} alt={lineupCard?.opponent || "Opponent"} className="w-full h-full object-contain drop-shadow" />
                        ) : (
                          <span className="text-xl sm:text-3xl font-black tracking-tighter text-white/80 drop-shadow">
                            {lineupCard ? lineupCard.opponent.slice(0, 3).toUpperCase() : "—"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action row */}
                <div className="flex items-center justify-between gap-2 mt-4 sm:mt-5 pt-3 sm:pt-4 border-t border-white/10">
                  <div className="flex items-center gap-1.5 text-[9px] sm:text-[10px] uppercase tracking-[0.18em] font-bold text-white/60">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-70 animate-ping" />
                      <span className="relative inline-flex rounded-full h-full w-full bg-emerald-400" />
                    </span>
                    Lineup Ready
                  </div>
                  <Link to="/mets-roster" className="flex items-center gap-1.5 text-[10px] sm:text-xs font-black uppercase tracking-wider bg-white/10 hover:bg-white/20 backdrop-blur-md px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl transition-all border border-white/20 text-white shrink-0">
                    Full Roster <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  </Link>
                </div>
              </div>
            </div>

            <div className="p-2 sm:p-4 lg:p-6">
              {hasLineup ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-4 lg:gap-6">
                  {/* Batting Order */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-3">
                      <div className="w-1 h-4 rounded-full bg-primary" />
                      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">Batting Order</p>
                    </div>
                    <div className="space-y-1 lg:space-y-2">
                      {lineup.slice(0, 9).map((player) => (
                        <button
                          key={player.position}
                          type="button"
                          onClick={() => setSelectedPlayer(player)}
                          className="w-full flex items-center gap-2 sm:gap-2.5 lg:gap-4 py-1.5 sm:py-2 lg:py-2.5 px-2 sm:px-2.5 lg:px-3 rounded-xl bg-muted/20 hover:bg-primary/10 active:bg-primary/15 transition-all group border border-border/10 hover:border-primary/30 text-left cursor-pointer"
                        >
                          <span className="text-[10px] sm:text-xs lg:text-lg font-black text-primary w-3 sm:w-4 lg:w-7 text-center shrink-0" style={{ fontVariantNumeric: "tabular-nums" }}>
                            {player.position}
                          </span>
                          {player.imageUrl ? (
                            <img src={player.imageUrl} alt={player.name} className="w-9 h-9 sm:w-10 sm:h-10 lg:w-11 lg:h-11 rounded-full object-cover border-2 border-border/30 group-hover:border-primary/60 transition-colors shrink-0 bg-muted/40" />
                          ) : (
                            <div className="w-9 h-9 sm:w-10 sm:h-10 lg:w-11 lg:h-11 rounded-full bg-muted/40 border-2 border-border/30 shrink-0 flex items-center justify-center text-[10px] font-black text-muted-foreground">
                              {player.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-[11px] sm:text-xs lg:text-sm truncate lg:whitespace-normal lg:truncate-none group-hover:text-foreground transition-colors leading-tight">{player.name}</p>
                            <p className="text-[9px] lg:text-[10px] text-muted-foreground/70 font-semibold uppercase tracking-wider mt-0.5">{player.fieldPosition}</p>
                          </div>
                          <span className="text-[8px] sm:text-[9px] lg:text-[10px] text-muted-foreground font-mono font-black bg-muted/40 group-hover:bg-primary group-hover:text-primary-foreground transition-all px-1 sm:px-1.5 lg:px-2 py-0.5 lg:py-1 rounded-md border border-border/20 shrink-0">
                            {player.fieldPosition}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-4">
                    {/* Starting Pitcher */}
                    {pitcher && (
                      <div>
                        <div className="flex items-center gap-1.5 mb-3">
                          <div className="w-1 h-4 rounded-full bg-primary" />
                          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">Starting Pitcher</p>
                        </div>
                        <div className="relative rounded-xl p-3 lg:p-4 border border-primary/15 bg-gradient-to-br from-primary/8 to-primary/3 overflow-hidden">
                          <div className="absolute top-0 right-0 w-20 h-20 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                          <p className="font-black text-sm lg:text-base relative">{pitcher.name}</p>
                          <div className="flex items-center gap-2 mt-2 relative">
                            <span className="text-[10px] lg:text-xs bg-primary/15 text-primary px-2 py-0.5 rounded-md font-bold">
                              {pitcher.hand}
                            </span>
                            <span className="text-[10px] lg:text-xs text-muted-foreground font-mono">{pitcher.era} ERA</span>
                            <span className="text-[10px] lg:text-xs text-muted-foreground font-mono">{pitcher.strikeouts} K</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Anthony's Predictions */}
                    {hasPredictions && (
                      <div className="relative">
                        <div className="flex items-center gap-1.5 mb-3">
                          <div className="w-1 h-4 rounded-full bg-secondary" />
                          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-secondary" />
                            Anthony's Predictions
                          </p>
                        </div>
                        {!user ? (
                          <div className="relative">
                            <div className="space-y-1.5 blur-sm pointer-events-none select-none">
                              {predictions!.slice(0, 3).map((pred: any) => (
                                <div key={pred.id} className="flex items-center gap-2 p-2 rounded-xl bg-secondary/5 border border-secondary/15">
                                  <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-[11px] truncate">{pred.player_name}</p>
                                    <p className="text-[9px] text-muted-foreground truncate">{pred.description}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/60 backdrop-blur-[2px] rounded-xl">
                              <Lock className="w-6 h-6 text-secondary mb-1.5" />
                              <p className="text-[11px] font-bold text-foreground">Sign in to unlock</p>
                              <Link to="/auth" className="text-[10px] text-secondary hover:text-secondary/80 font-semibold mt-1 transition-colors">
                                Log In →
                              </Link>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            {predictions!.slice(0, 3).map((pred: any) => (
                              <div key={pred.id} className="flex items-center gap-2 p-2 rounded-xl bg-secondary/5 border border-secondary/15 hover:border-secondary/30 transition-all">
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-[11px] truncate">{pred.player_name}</p>
                                  <p className="text-[9px] text-muted-foreground truncate">{pred.description}</p>
                                </div>
                                {pred.confidence && (
                                  <span className="text-[9px] font-bold text-secondary bg-secondary/10 px-1.5 py-0.5 rounded-md shrink-0">
                                    {pred.confidence}%
                                  </span>
                                )}
                              </div>
                            ))}
                            <Link to="/mets-lineup-card" className="flex items-center justify-center gap-1 text-[10px] text-secondary hover:text-secondary/80 font-bold pt-1 transition-colors">
                              View All Predictions <ArrowRight className="w-3 h-3" />
                            </Link>
                          </div>
                        )}
                      </div>
                    )}

                    <div>
                      <div className="flex items-center gap-1.5 mb-3">
                        <div className="w-1 h-4 rounded-full bg-primary" />
                        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">2026 Season Stats</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { value: metsStanding?.wins || "-", label: "Wins", accent: "text-primary" },
                          { value: metsStanding?.losses || "-", label: "Losses", accent: "text-foreground" },
                        ].map((stat) => (
                          <div key={stat.label} className="relative rounded-xl bg-gradient-to-br from-muted/30 to-muted/10 border border-border/30 p-2.5 lg:p-4 text-center overflow-hidden group hover:border-primary/30 transition-all">
                            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-60" />
                            <p className={`text-xl lg:text-3xl font-black leading-none tracking-tight ${stat.accent}`} style={{ fontVariantNumeric: "tabular-nums" }}>{stat.value}</p>
                            <p className="text-[9px] lg:text-[10px] text-muted-foreground font-bold uppercase tracking-[0.1em] mt-1.5 whitespace-nowrap">{stat.label}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Probable Pitchers - moved under season stats */}
                    {upcomingGames && upcomingGames.length > 0 && (
                      <div>
                        <div className="flex items-center gap-1.5 mb-3">
                          <div className="w-1 h-4 rounded-full bg-destructive" />
                          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">Probable Pitchers</p>
                        </div>
                        <div className="space-y-1.5">
                          {upcomingGames.slice(0, 3).map((game, idx) => (
                            <div key={idx} className="flex items-center gap-2.5 p-2 rounded-xl bg-muted/20 border border-border/10 hover:border-primary/15 transition-all">
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-xs truncate">
                                  {game.isHome ? "vs" : "@"} {game.opponent}
                                </p>
                                <p className="text-[9px] text-muted-foreground font-medium">
                                  {formatGameDateET(game.date)} • {game.time}
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                {game.probablePitcher ? (
                                  <div className="flex items-center gap-1.5 bg-primary/10 rounded-lg px-1.5 py-1 border border-primary/15 max-w-[170px]">
                                    {game.probablePitcher.id && (
                                      <img
                                        src={`https://midfield.mlbstatic.com/v1/people/${game.probablePitcher.id}/spots/60`}
                                        alt={game.probablePitcher.name}
                                        loading="lazy"
                                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                                        className="w-7 h-7 rounded-full object-cover border border-primary/30 bg-muted shrink-0"
                                      />
                                    )}
                                    <div className="min-w-0 text-left">
                                      <p className="text-[10px] font-bold text-primary truncate">
                                        {game.probablePitcher.name}
                                      </p>
                                      <p className="text-[8px] text-muted-foreground font-mono">{game.probablePitcher.hand || "—"}</p>
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-muted-foreground/50 italic">TBA</span>
                                )}
                              </div>
                            </div>
                          ))}
                          <Link to="/mets-scores" className="flex items-center justify-center gap-1 text-[10px] text-primary hover:text-primary/80 font-bold pt-1 transition-colors">
                            View All Games <ArrowRight className="w-3 h-3" />
                          </Link>
                        </div>
                      </div>
                    )}

                    {lineupCard?.notes && (
                      <p className="text-[10px] text-muted-foreground italic border-l-2 border-primary/30 pl-2.5">
                        {lineupCard.notes}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-4 lg:gap-6">
                  {/* Lineup TBA */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-3">
                      <div className="w-1 h-4 rounded-full bg-primary" />
                      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">Batting Order</p>
                    </div>
                    <div className="space-y-1">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((pos) => (
                        <div key={pos} className="flex items-center gap-2 py-1.5 px-2.5 rounded-xl bg-muted/15 border border-border/5">
                          <span className="text-[10px] font-black text-primary/40 w-4 text-center">{pos}</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-xs text-muted-foreground/40 italic">TBA</p>
                          </div>
                          <span className="text-[9px] text-muted-foreground/30 font-mono">--</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right Column - TBA State */}
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center gap-1.5 mb-3">
                        <div className="w-1 h-4 rounded-full bg-primary" />
                        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">Starting Pitcher</p>
                      </div>
                      <div className="rounded-xl p-3 lg:p-4 border border-primary/10 bg-gradient-to-br from-primary/5 to-transparent">
                        <p className="font-bold text-sm text-muted-foreground/50 italic">TBA</p>
                        <p className="text-[10px] text-muted-foreground/40 mt-1">
                          Lineup typically released 1-2 hours before game time
                        </p>
                      </div>
                    </div>

                    {/* 2026 Season Stats */}
                    <div>
                      <div className="flex items-center gap-1.5 mb-3">
                        <div className="w-1 h-4 rounded-full bg-primary" />
                        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">2026 Season Stats</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { value: metsStanding?.wins || "-", label: "Wins" },
                          { value: metsStanding?.losses || "-", label: "Losses" },
                        ].map((stat) => (
                          <div key={stat.label} className="rounded-xl bg-muted/20 border border-border/20 p-2.5 text-center">
                            <p className="text-lg font-black text-primary leading-none">{stat.value}</p>
                            <p className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider mt-1">{stat.label}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Probable Pitchers - under season stats in TBA state too */}
                    {upcomingGames && upcomingGames.length > 0 && (
                      <div>
                        <div className="flex items-center gap-1.5 mb-3">
                          <div className="w-1 h-4 rounded-full bg-destructive" />
                          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">Probable Pitchers</p>
                        </div>
                        <div className="space-y-1.5">
                          {upcomingGames.slice(0, 3).map((game, idx) => (
                            <div key={idx} className="flex items-center gap-2.5 p-2 rounded-xl bg-muted/20 border border-border/10 hover:border-primary/15 transition-all">
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-xs truncate">
                                  {game.isHome ? "vs" : "@"} {game.opponent}
                                </p>
                                <p className="text-[9px] text-muted-foreground font-medium">
                                  {formatGameDateET(game.date)} • {game.time}
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                {game.probablePitcher ? (
                                  <div className="flex items-center gap-1.5 bg-primary/10 rounded-lg px-1.5 py-1 border border-primary/15 max-w-[170px]">
                                    {game.probablePitcher.id && (
                                      <img
                                        src={`https://midfield.mlbstatic.com/v1/people/${game.probablePitcher.id}/spots/60`}
                                        alt={game.probablePitcher.name}
                                        loading="lazy"
                                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                                        className="w-7 h-7 rounded-full object-cover border border-primary/30 bg-muted shrink-0"
                                      />
                                    )}
                                    <div className="min-w-0 text-left">
                                      <p className="text-[10px] font-bold text-primary truncate">
                                        {game.probablePitcher.name}
                                      </p>
                                      <p className="text-[8px] text-muted-foreground font-mono">{game.probablePitcher.hand || "—"}</p>
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-muted-foreground/50 italic">TBA</span>
                                )}
                              </div>
                            </div>
                          ))}
                          <Link to="/mets-scores" className="flex items-center justify-center gap-1 text-[10px] text-primary hover:text-primary/80 font-bold pt-1 transition-colors">
                            View All Games <ArrowRight className="w-3 h-3" />
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>

        </div>
      </div>
    </section>
    {selectedPlayer && (
      <PlayerStatsDialog
        open={!!selectedPlayer}
        onOpenChange={(o) => !o && setSelectedPlayer(null)}
        playerId={extractPlayerId(selectedPlayer.imageUrl)}
        playerName={selectedPlayer.name}
        fieldPosition={selectedPlayer.fieldPosition}
        imageUrl={selectedPlayer.imageUrl}
        battingPosition={selectedPlayer.position}
      />
    )}
    </>
  );
}
