import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Clock, MapPin, Video, TrendingUp, Calendar, Trophy, RefreshCw, User, Zap, ArrowRight, Activity, Sparkles, Lock } from "lucide-react";
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
          className="flex items-center justify-between mb-4 sm:mb-8 pb-3 sm:pb-5 border-b border-border/40"
        >
          <div className="flex items-center gap-2.5 sm:gap-4">
            <div className="relative shrink-0">
              <div className="absolute inset-0 bg-primary/40 blur-xl opacity-60" aria-hidden />
              <div className="relative w-10 h-10 sm:w-14 sm:h-14 rounded-2xl overflow-hidden border border-primary/30 shadow-2xl ring-1 ring-white/5">
                <img src={logoImage} alt="MetsXMFanZone" className="w-full h-full object-cover" />
              </div>
            </div>
            <div>
              <h2 className="text-base sm:text-2xl lg:text-3xl font-black tracking-tight text-foreground leading-none uppercase">
                Mets <span className="text-primary">Game Center</span>
              </h2>
              <div className="flex items-center gap-1.5 sm:gap-2 mt-1 sm:mt-1.5">
                <span className="relative flex h-1.5 w-1.5 sm:h-2 sm:w-2 shrink-0">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-60 animate-ping" />
                  <span className="relative inline-flex rounded-full h-full w-full bg-primary" />
                </span>
                <p className="text-[8px] sm:text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold">Live Stats &middot; Lineup &middot; 2026 Season</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefreshLineup}
              disabled={isRefreshing}
              className="text-foreground/80 hover:text-primary hover:bg-primary/10 h-8 sm:h-9 px-2 sm:px-3 text-[10px] sm:text-xs rounded-xl border border-border/40 backdrop-blur-md bg-card/40"
            >
              <RefreshCw className={`w-3 h-3 sm:w-3.5 sm:h-3.5 mr-0.5 sm:mr-1 text-primary ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Link to="/video-gallery" className="flex items-center gap-1.5 text-primary-foreground transition-all text-[10px] sm:text-xs font-bold bg-gradient-to-r from-primary to-primary/80 hover:brightness-110 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl shadow-lg shadow-primary/20 h-8 sm:h-9">
              <Video className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span className="hidden sm:inline">Watch Highlights</span>
              <span className="sm:hidden">Videos</span>
            </Link>
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
            {/* Top Bar — Matchup */}
            <div className="relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/95 to-primary/70" />
              <div className="absolute -right-10 -top-10 w-48 h-48 bg-white/15 rounded-full blur-3xl" aria-hidden />
              <div className="absolute right-1/3 inset-y-0 w-32 bg-white/10 -skew-x-12 translate-x-1/2" aria-hidden />
              <div className="relative p-4 sm:p-5 text-primary-foreground">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                    <div className="w-11 h-11 sm:w-14 sm:h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/30 shadow-xl shrink-0">
                      <span className="text-sm sm:text-lg font-black tracking-tight">NY</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] sm:text-[10px] uppercase tracking-[0.2em] font-bold opacity-80">Today's Matchup</p>
                      <p className="font-black text-base sm:text-xl tracking-tight uppercase truncate">
                        {lineupCard ? `vs ${lineupCard.opponent}` : "Lineup Pending"}
                      </p>
                      {lineupCard && (
                        <p className="text-[10px] sm:text-xs opacity-90 flex items-center gap-1.5 mt-0.5 font-semibold">
                          <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                          {format(new Date(lineupCard.game_date), "EEE, MMM d")} • {lineupCard.game_time}
                        </p>
                      )}
                    </div>
                  </div>
                  <Link to="/mets-roster" className="flex items-center gap-1.5 text-[10px] sm:text-xs font-bold bg-black/25 hover:bg-black/40 backdrop-blur-md px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl transition-all border border-white/20 uppercase tracking-wider shrink-0">
                    Roster <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
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
                        <div key={player.position} className="flex items-center gap-1.5 sm:gap-2 lg:gap-4 py-1 sm:py-1.5 lg:py-2.5 px-2 sm:px-2.5 lg:px-3 rounded-xl bg-muted/20 hover:bg-primary/10 transition-all group border border-border/10 hover:border-primary/30">
                          <span className="text-[10px] sm:text-xs lg:text-lg font-black text-primary w-3 sm:w-4 lg:w-7 text-center shrink-0" style={{ fontVariantNumeric: "tabular-nums" }}>
                            {player.position}
                          </span>
                          {player.imageUrl && (
                            <img src={player.imageUrl} alt={player.name} className="hidden lg:block w-11 h-11 rounded-full object-cover border-2 border-border/30 group-hover:border-primary/60 transition-colors shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-[11px] sm:text-xs lg:text-sm truncate lg:whitespace-normal lg:truncate-none group-hover:text-foreground transition-colors leading-tight">{player.name}</p>
                            <p className="hidden lg:block text-[10px] text-muted-foreground/70 font-semibold uppercase tracking-wider mt-0.5">{player.fieldPosition}</p>
                          </div>
                          <span className="text-[8px] sm:text-[9px] lg:text-[10px] text-muted-foreground font-mono font-black bg-muted/40 group-hover:bg-primary group-hover:text-primary-foreground transition-all px-1 sm:px-1.5 lg:px-2 py-0.5 lg:py-1 rounded-md border border-border/20 shrink-0">
                            {player.fieldPosition}
                          </span>
                        </div>
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
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { value: metsStanding?.wins || "-", label: "Wins", accent: "text-primary" },
                          { value: metsStanding?.losses || "-", label: "Losses", accent: "text-foreground" },
                          { value: metsStanding?.position ? `${metsStanding.position}${metsStanding.position === 1 ? "st" : metsStanding.position === 2 ? "nd" : metsStanding.position === 3 ? "rd" : "th"}` : "-", label: "NL East", accent: "text-secondary" },
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
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { value: metsStanding?.wins || "-", label: "Wins" },
                          { value: metsStanding?.losses || "-", label: "Losses" },
                          { value: metsStanding?.position ? `${metsStanding.position}${metsStanding.position === 1 ? "st" : metsStanding.position === 2 ? "nd" : metsStanding.position === 3 ? "rd" : "th"}` : "-", label: "NL East" },
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

          {/* Right Column - Standings & Leaders */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-3 sm:gap-4"
          >

            {/* NL East Standings */}
            <div className="rounded-2xl overflow-hidden border border-border/30 backdrop-blur-xl bg-card/60 shadow-lg">
              <div className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/90 to-primary/70" />
                <div className="relative p-3 text-primary-foreground flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4" />
                    <span className="font-black text-sm">NL East Standings</span>
                  </div>
                  <Link to="/nl-scores" className="text-[10px] bg-white/15 hover:bg-white/25 px-2 py-0.5 rounded-md transition-colors font-semibold">
                    NL Scores
                  </Link>
                </div>
              </div>
              <div className="p-3">
                {standings && standings.length > 0 ? (
                  <div className="space-y-1">
                    {standings.map((team: any) => {
                      const isMets = team.team_name === "Mets";
                      return (
                        <div key={team.team_name} className={`relative flex items-center gap-2 p-2 pl-3 rounded-xl text-xs transition-all overflow-hidden ${
                          isMets
                            ? "bg-gradient-to-r from-primary/20 via-primary/10 to-transparent border border-primary/30 shadow-md shadow-primary/10"
                            : "bg-muted/10 hover:bg-muted/20 border border-transparent"
                        }`}>
                          {isMets && <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-primary shadow-[0_0_8px_hsl(var(--primary))]" aria-hidden />}
                          <span className={`font-black w-4 text-center text-[10px] ${isMets ? "text-primary" : "text-muted-foreground/50"}`}>{team.position}</span>
                          <span className={`flex-1 font-bold uppercase tracking-tight ${isMets ? "text-primary" : ""}`}>{team.team_name}</span>
                          <span className="w-7 text-center font-mono font-black text-[10px]" style={{ fontVariantNumeric: "tabular-nums" }}>{team.wins}</span>
                          <span className="w-7 text-center font-mono font-bold text-[10px] text-muted-foreground" style={{ fontVariantNumeric: "tabular-nums" }}>{team.losses}</span>
                          <span className={`w-7 text-center font-mono text-[10px] ${isMets ? "text-primary font-black" : "text-muted-foreground"}`} style={{ fontVariantNumeric: "tabular-nums" }}>{team.games_back}</span>
                        </div>
                      );
                    })}
                    <div className="flex items-center gap-2 pt-1.5 text-[9px] text-muted-foreground/50 border-t border-border/20 mt-1.5 font-semibold uppercase tracking-wider">
                      <span className="w-4" />
                      <span className="flex-1">Team</span>
                      <span className="w-7 text-center">W</span>
                      <span className="w-7 text-center">L</span>
                      <span className="w-7 text-center">GB</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-3">Season not started</p>
                )}
              </div>
            </div>

            {/* Team Leaders */}
            <div className="rounded-2xl overflow-hidden border border-border/30 backdrop-blur-xl bg-card/60 shadow-lg">
              <div className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/90 to-primary/70" />
                <div className="relative p-2.5 sm:p-3 text-primary-foreground flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="font-black text-xs sm:text-sm">Team Leaders</span>
                  </div>
                  <span className="text-[8px] sm:text-[9px] bg-white/15 px-1.5 sm:px-2 py-0.5 rounded-md font-bold">2026</span>
                </div>
              </div>
              <div className="p-2 sm:p-3">
                {/* Hitting Leaders */}
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2 text-center">
                  {teamLeaders?.AVG && (
                    <div className="rounded-xl bg-muted/15 p-1.5 sm:p-2 border border-border/10">
                      <p className="text-[7px] sm:text-[8px] text-muted-foreground uppercase font-bold tracking-wider">AVG</p>
                      <p className="font-black text-[11px] sm:text-sm text-primary leading-tight">{teamLeaders.AVG.value}</p>
                      <p className="text-[7px] sm:text-[9px] truncate text-muted-foreground">{teamLeaders.AVG.name.split(" ").pop()}</p>
                    </div>
                  )}
                  {teamLeaders?.HR && (
                    <div className="rounded-xl bg-muted/15 p-1.5 sm:p-2 border border-border/10">
                      <p className="text-[7px] sm:text-[8px] text-muted-foreground uppercase font-bold tracking-wider">HR</p>
                      <p className="font-black text-[11px] sm:text-sm text-primary leading-tight">{teamLeaders.HR.value}</p>
                      <p className="text-[7px] sm:text-[9px] truncate text-muted-foreground">{teamLeaders.HR.name.split(" ").pop()}</p>
                    </div>
                  )}
                  {teamLeaders?.RBI && (
                    <div className="rounded-xl bg-muted/15 p-1.5 sm:p-2 border border-border/10">
                      <p className="text-[7px] sm:text-[8px] text-muted-foreground uppercase font-bold tracking-wider">RBI</p>
                      <p className="font-black text-[11px] sm:text-sm text-primary leading-tight">{teamLeaders.RBI.value}</p>
                      <p className="text-[7px] sm:text-[9px] truncate text-muted-foreground">{teamLeaders.RBI.name.split(" ").pop()}</p>
                    </div>
                  )}
                </div>
                {/* Pitching Leaders */}
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2 text-center mt-1.5 sm:mt-2 pt-1.5 sm:pt-2 border-t border-border/15">
                  {teamLeaders?.ERA && (
                    <div className="rounded-xl bg-muted/15 p-1.5 sm:p-2 border border-border/10">
                      <p className="text-[7px] sm:text-[8px] text-muted-foreground uppercase font-bold tracking-wider">ERA</p>
                      <p className="font-black text-[11px] sm:text-sm text-primary leading-tight">{teamLeaders.ERA.value}</p>
                      <p className="text-[7px] sm:text-[9px] truncate text-muted-foreground">{teamLeaders.ERA.name.split(" ").pop()}</p>
                    </div>
                  )}
                  {teamLeaders?.W && (
                    <div className="rounded-xl bg-muted/15 p-1.5 sm:p-2 border border-border/10">
                      <p className="text-[7px] sm:text-[8px] text-muted-foreground uppercase font-bold tracking-wider">W</p>
                      <p className="font-black text-[11px] sm:text-sm text-primary leading-tight">{teamLeaders.W.value}</p>
                      <p className="text-[7px] sm:text-[9px] truncate text-muted-foreground">{teamLeaders.W.name.split(" ").pop()}</p>
                    </div>
                  )}
                  {teamLeaders?.SO && (
                    <div className="rounded-xl bg-muted/15 p-1.5 sm:p-2 border border-border/10">
                      <p className="text-[7px] sm:text-[8px] text-muted-foreground uppercase font-bold tracking-wider">K</p>
                      <p className="font-black text-[11px] sm:text-sm text-primary leading-tight">{teamLeaders.SO.value}</p>
                      <p className="text-[7px] sm:text-[9px] truncate text-muted-foreground">{teamLeaders.SO.name.split(" ").pop()}</p>
                    </div>
                  )}
                </div>
                {!teamLeaders?.AVG && !teamLeaders?.HR && (
                  <p className="text-xs text-muted-foreground text-center py-3">Season stats coming soon</p>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
