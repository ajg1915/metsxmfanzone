import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, MapPin, Home, Plane, Loader2, RefreshCw, Swords } from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { parseISO } from "date-fns";

// Format a UTC ISO date string in Eastern Time so all Mets games display in
// stadium time regardless of the visitor's local timezone.
const ET_TZ = "America/New_York";
const formatET = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-US", { timeZone: ET_TZ, ...opts }).format(parseISO(iso));
const monthLabelET = (iso: string) =>
  formatET(iso, { month: "long", year: "numeric" });
const dayLabelET = (iso: string) =>
  formatET(iso, { weekday: "short", month: "short", day: "numeric" });
const timeLabelET = (iso: string) =>
  formatET(iso, { hour: "numeric", minute: "2-digit", hour12: true }) + " ET";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const MATCHUP_ROUTES: Record<string, string> = {
  'Houston Astros': '/matchup/astros',
  'Atlanta Braves': '/matchup/braves',
  'St. Louis Cardinals': '/matchup/cardinals',
  'Washington Nationals': '/matchup/nationals',
  'Boston Red Sox': '/matchup/redsox',
  'New York Yankees': '/matchup/yankees',
  'Toronto Blue Jays': '/matchup/bluejays',
};

interface Game {
  gameId: number;
  date: string;
  gameType: string;
  gameTypeLabel: string;
  status: string;
  isHome: boolean;
  opponent: string;
  venue: string;
  homeScore?: number;
  awayScore?: number;
  metsScore?: number;
  opponentScore?: number;
  seriesDescription?: string;
}

interface GroupedGames {
  [month: string]: Game[];
}

export default function MetsSchedule2026() {
  const navigate = useNavigate();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("all");

  useEffect(() => {
    fetchSchedule();
  }, []);

  const fetchSchedule = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('fetch-mets-schedule', {
        body: { year: 2026, gameTypes: ['R'] }
      });

      if (fnError) throw fnError;
      
      if (data?.success && data?.games) {
        setGames(data.games);
      } else {
        throw new Error(data?.error || 'Failed to fetch schedule');
      }
    } catch (err: any) {
      console.error('Error fetching schedule:', err);
      setError(err.message || 'Failed to load schedule');
    } finally {
      setLoading(false);
    }
  };

  const filterGames = (type: string) => {
    if (type === 'all') return games;
    if (type === 'spring') return games.filter(g => g.gameType === 'S');
    if (type === 'regular') return games.filter(g => g.gameType === 'R');
    if (type === 'home') return games.filter(g => g.isHome);
    if (type === 'away') return games.filter(g => !g.isHome);
    return games;
  };

  const groupGamesByMonth = (gamesList: Game[]): GroupedGames => {
    return gamesList.reduce((acc, game) => {
      const month = monthLabelET(game.date);
      if (!acc[month]) acc[month] = [];
      acc[month].push(game);
      return acc;
    }, {} as GroupedGames);
  };

  const filteredGames = filterGames(activeTab);
  const groupedGames = groupGamesByMonth(filteredGames);
  const springTrainingCount = games.filter(g => g.gameType === 'S').length;
  const regularSeasonCount = games.filter(g => g.gameType === 'R').length;

  const getTeamLogo = (teamName: string) => {
    const teamAbbrevs: { [key: string]: string } = {
      'New York Yankees': 'NYY', 'Boston Red Sox': 'BOS', 'Atlanta Braves': 'ATL',
      'Philadelphia Phillies': 'PHI', 'Miami Marlins': 'MIA', 'Washington Nationals': 'WSH',
      'Los Angeles Dodgers': 'LAD', 'San Diego Padres': 'SD', 'San Francisco Giants': 'SF',
      'Arizona Diamondbacks': 'ARI', 'Colorado Rockies': 'COL', 'Chicago Cubs': 'CHC',
      'Milwaukee Brewers': 'MIL', 'St. Louis Cardinals': 'STL', 'Pittsburgh Pirates': 'PIT',
      'Cincinnati Reds': 'CIN', 'Houston Astros': 'HOU', 'Texas Rangers': 'TEX',
      'Seattle Mariners': 'SEA', 'Los Angeles Angels': 'LAA', 'Oakland Athletics': 'OAK',
      'Minnesota Twins': 'MIN', 'Cleveland Guardians': 'CLE', 'Detroit Tigers': 'DET',
      'Chicago White Sox': 'CWS', 'Kansas City Royals': 'KC', 'Toronto Blue Jays': 'TOR',
      'Baltimore Orioles': 'BAL', 'Tampa Bay Rays': 'TB',
    };
    const abbrev = teamAbbrevs[teamName] || 'MLB';
    return `https://www.mlbstatic.com/team-logos/${getTeamId(teamName)}.svg`;
  };

  const getTeamId = (teamName: string): number => {
    const teamIds: { [key: string]: number } = {
      'New York Yankees': 147, 'Boston Red Sox': 111, 'Atlanta Braves': 144,
      'Philadelphia Phillies': 143, 'Miami Marlins': 146, 'Washington Nationals': 120,
      'Los Angeles Dodgers': 119, 'San Diego Padres': 135, 'San Francisco Giants': 137,
      'Arizona Diamondbacks': 109, 'Colorado Rockies': 115, 'Chicago Cubs': 112,
      'Milwaukee Brewers': 158, 'St. Louis Cardinals': 138, 'Pittsburgh Pirates': 134,
      'Cincinnati Reds': 113, 'Houston Astros': 117, 'Texas Rangers': 140,
      'Seattle Mariners': 136, 'Los Angeles Angels': 108, 'Oakland Athletics': 133,
      'Minnesota Twins': 142, 'Cleveland Guardians': 114, 'Detroit Tigers': 116,
      'Chicago White Sox': 145, 'Kansas City Royals': 118, 'Toronto Blue Jays': 141,
      'Baltimore Orioles': 110, 'Tampa Bay Rays': 139, 'New York Mets': 121,
    };
    return teamIds[teamName] || 121;
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEOHead
        title="2026 NY Mets Regular Season Schedule"
        description="View the complete 2026 New York Mets Regular Season schedule. Game times, opponents, and venues."
        keywords="Mets schedule 2026, New York Mets games, Mets Regular Season, MLB schedule"
        canonical="https://www.metsxmfanzone.com/mets-schedule-2026"
      />
      
      <Navigation />
      
      <main className="flex-1 container mx-auto px-4 pt-12 pb-8 max-w-7xl">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 text-center"
        >
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-3">
            2026 New York Mets Schedule
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base mb-4">
            Regular Season Schedule
          </p>
          
          <Button
            variant="outline"
            size="sm"
            onClick={fetchSchedule}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            Refresh Schedule
          </Button>
        </motion.div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Loading 2026 Mets schedule...</p>
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={fetchSchedule}>Try Again</Button>
          </div>
        ) : (
          <>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
              <TabsList className="grid w-full grid-cols-3 max-w-md mx-auto">
                <TabsTrigger value="all">All Games</TabsTrigger>
                <TabsTrigger value="home">Home</TabsTrigger>
                <TabsTrigger value="away">Away</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="space-y-8">
              {Object.entries(groupedGames).map(([month, monthGames]) => (
                <motion.div
                  key={month}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                >
                  <h2 className="text-xl sm:text-2xl font-bold mb-4 flex items-center gap-2 sticky top-16 bg-background/95 backdrop-blur-sm py-2 z-10">
                    <Calendar className="w-5 h-5 text-primary" />
                    {month}
                    <Badge variant="secondary" className="ml-2">
                      {monthGames.length} games
                    </Badge>
                  </h2>
                  
                  <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {monthGames.map((game, index) => (
                      <motion.div
                        key={`${game.gameId ?? "game"}-${game.gameDate ?? ""}-${index}`}
                        initial={{ opacity: 0, scale: 0.95 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: index * 0.02 }}
                      >
                        <Card className={cn(
                          "hover:shadow-lg transition-all duration-300 overflow-hidden border-l-4",
                          game.gameType === 'S' ? "border-l-green-500" : "border-l-primary",
                          game.isHome && "bg-primary/5"
                        )}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge 
                                    variant={game.gameType === 'S' ? 'secondary' : 'default'}
                                    className="text-[10px] shrink-0"
                                  >
                                    {game.gameTypeLabel}
                                  </Badge>
                                  <Badge 
                                    variant="outline" 
                                    className={cn(
                                      "text-[10px]",
                                      game.isHome ? "border-green-500 text-green-600" : "border-blue-500 text-blue-600"
                                    )}
                                  >
                                    {game.isHome ? (
                                      <><Home className="w-3 h-3 mr-1" />Home</>
                                    ) : (
                                      <><Plane className="w-3 h-3 mr-1" />Away</>
                                    )}
                                  </Badge>
                                </div>
                                
                                <div className="flex items-center gap-2 mb-2">
                                  <img 
                                    src={getTeamLogo(game.opponent)}
                                    alt={game.opponent}
                                    className="w-8 h-8 object-contain"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).src = 'https://www.mlbstatic.com/team-logos/league-on-dark.svg';
                                    }}
                                  />
                                  <div>
                                    <p className="font-semibold text-sm line-clamp-1">
                                      {game.isHome ? 'vs' : '@'} {game.opponent}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {dayLabelET(game.date)} • {timeLabelET(game.date)}
                                    </p>
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <MapPin className="w-3 h-3" />
                                  <span className="line-clamp-1">{game.venue}</span>
                                </div>

                                {MATCHUP_ROUTES[game.opponent] && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="mt-2 h-7 text-xs gap-1 w-full border-primary/30 hover:bg-primary/10"
                                    onClick={() => navigate(MATCHUP_ROUTES[game.opponent])}
                                  >
                                    <Swords className="w-3 h-3" />
                                    View Matchup Breakdown
                                  </Button>
                                )}
                              </div>
                              
                              {game.metsScore !== undefined && game.opponentScore !== undefined && (
                                <div className="text-right shrink-0">
                                  <div className={cn(
                                    "text-lg font-bold",
                                    game.metsScore > game.opponentScore ? "text-green-600" : 
                                    game.metsScore < game.opponentScore ? "text-red-500" : "text-muted-foreground"
                                  )}>
                                    {game.metsScore} - {game.opponentScore}
                                  </div>
                                  <Badge variant="outline" className="text-[10px]">
                                    {game.status}
                                  </Badge>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>

            {filteredGames.length === 0 && (
              <div className="text-center py-20">
                <p className="text-muted-foreground">No games found for the selected filter.</p>
              </div>
            )}
          </>
        )}

        {!loading && games.length > 0 && (
          <div className="flex flex-wrap justify-center gap-3 mt-8 mb-4">
            <Badge variant="outline" className="text-sm px-3 py-1">
              {springTrainingCount} Spring Training Games
            </Badge>
            <Badge variant="outline" className="text-sm px-3 py-1">
              {regularSeasonCount} Regular Season Games
            </Badge>
            <Badge variant="outline" className="text-sm px-3 py-1">
              {games.length} Total Games
            </Badge>
          </div>
        )}

        <div className="mt-4 text-center">
          <p className="text-sm text-muted-foreground">
            * Schedule data from MLB Stats API. Subject to change.
          </p>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
