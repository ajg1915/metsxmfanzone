import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { ClapprPlayer } from "@/components/ClapprPlayer";
import { MLBScoresTicker } from "@/components/MLBScoresTicker";
import { NewPostAlert } from "@/components/NewPostAlert";
import StreamTimeLimit from "@/components/StreamTimeLimit";
import AdminAlertsFeed from "@/components/AdminAlertsFeed";
import SEOHead from "@/components/SEOHead";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Mic, Trophy, Swords, Loader2, Home, Plane } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";

const MATCHUP_ROUTES: Record<string, string> = {
  'Houston Astros': '/matchup/astros',
  'Atlanta Braves': '/matchup/braves',
  'St. Louis Cardinals': '/matchup/cardinals',
  'Washington Nationals': '/matchup/nationals',
  'Boston Red Sox': '/matchup/redsox',
  'New York Yankees': '/matchup/yankees',
  'Toronto Blue Jays': '/matchup/bluejays',
};

const getTeamId = (teamName: string): number => {
  const teamIds: Record<string, number> = {
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

interface ScheduleGame {
  gameId: number;
  date: string;
  gameType: string;
  gameTypeLabel: string;
  status: string;
  isHome: boolean;
  opponent: string;
  venue: string;
}

// MetsXMFanZone Live always plays this feed.
const METSXM_STREAM_URL = "https://metsxmfanzone.metsxmfanzone.com/hls/metsxmfanzone.m3u8";

const MetsXMFanZone = () => {
  const navigate = useNavigate();
  const [games, setGames] = useState<ScheduleGame[]>([]);
  const [gamesLoading, setGamesLoading] = useState(true);
  const streamUrl = METSXM_STREAM_URL;





  // Defer schedule fetch so stream player loads first
  useEffect(() => {
    const timer = setTimeout(() => fetchUpcomingGames(), 3000);
    return () => clearTimeout(timer);
  }, []);

  const fetchUpcomingGames = async () => {
    try {
      const { data } = await supabase.functions.invoke('fetch-mets-schedule', {
        body: { year: 2026, gameTypes: ['S', 'R'] }
      });
      if (data?.success && data?.games) {
        const now = new Date();
        const upcoming = (data.games as ScheduleGame[])
          .filter(g => new Date(g.date) >= now)
          .slice(0, 10);
        setGames(upcoming);
      }
    } catch (err) {
      console.error('Error fetching games:', err);
    } finally {
      setGamesLoading(false);
    }
  };

  return (
    <StreamTimeLimit>
    <div className="min-h-screen bg-background flex flex-col">
      <SEOHead
        title="MetsXMFanZone TV - Watch Live Mets Shows & Exclusive Content"
        description="Watch MetsXMFanZone TV for exclusive Mets live shows, fan discussions, and 24/7 coverage. Your ultimate destination for Mets content."
        canonical="https://www.metsxmfanzone.com/metsxmfanzone"
        keywords="MetsXMFanZone TV, Mets live show, Mets fan TV, exclusive Mets content, Mets 24/7"
        ogType="video.other"
      />
      <Navigation />
      
      <main className="flex-1 pt-12">
        {/* Ambient backdrop */}
        <div className="relative">
          <div className="absolute inset-0 h-[520px] pointer-events-none overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/25 via-secondary/10 to-transparent" />
            <div className="absolute -top-20 -right-20 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
            <div className="absolute -bottom-20 -left-20 w-96 h-96 bg-secondary/20 rounded-full blur-3xl" />
            <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-background" />
          </div>

          {/* Player + admin alerts command-center grid */}
          <div className="container mx-auto px-3 sm:px-4 pt-4 pb-8 relative z-10 max-w-[1400px]">
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_400px] gap-4 lg:gap-5">
              {/* Player + meta */}
              <div className="flex flex-col gap-4 min-w-0">
                {/* MLB Live Scores Ticker (scrolls left, above player) - hidden on mobile */}
                <div className="hidden md:block rounded-xl overflow-hidden border border-border/60 shadow-lg shadow-primary/10">
                  <MLBScoresTicker />
                </div>

                {/* 16:9 Player */}
                <div className="stream-player-shell relative aspect-video w-full overflow-hidden bg-player sm:rounded-lg">
                  <ClapprPlayer
                    source={streamUrl}
                    pageTitle="MetsXMFanZone Live Stream"
                    pageDescription="Ultimate Destination Where the Fans Go"
                    showChrome={false}
                  />
                  <NewPostAlert />
                </div>

                {/* Channel info pills */}
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  <div className="rounded-xl bg-card/80 backdrop-blur-xl border border-border/60 p-2.5 sm:p-3 hover:border-primary/40 transition-colors">
                    <Mic className="w-4 h-4 text-primary mb-1.5" />
                    <p className="text-[11px] sm:text-xs font-bold text-foreground">Live Shows</p>
                    <p className="text-[10px] text-muted-foreground hidden sm:block">Fan discussions & reactions</p>
                  </div>
                  <div className="rounded-xl bg-card/80 backdrop-blur-xl border border-border/60 p-2.5 sm:p-3 hover:border-primary/40 transition-colors">
                    <Users className="w-4 h-4 text-secondary mb-1.5" />
                    <p className="text-[11px] sm:text-xs font-bold text-foreground">Community</p>
                    <p className="text-[10px] text-muted-foreground hidden sm:block">Connect with fellow fans</p>
                  </div>
                  <div className="rounded-xl bg-card/80 backdrop-blur-xl border border-border/60 p-2.5 sm:p-3 hover:border-primary/40 transition-colors">
                    <Trophy className="w-4 h-4 text-primary mb-1.5" />
                    <p className="text-[11px] sm:text-xs font-bold text-foreground">Exclusive</p>
                    <p className="text-[10px] text-muted-foreground hidden sm:block">Interviews & analysis</p>
                  </div>
                </div>

                {/* Upcoming Games */}
                <div className="rounded-2xl bg-card/80 backdrop-blur-xl border border-border/60 p-4 sm:p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
                      <Swords className="w-4 h-4 text-primary" />
                    </div>
                    <h2 className="text-base sm:text-lg font-bold text-foreground">Upcoming Games & Matchups</h2>
                  </div>

                  {gamesLoading ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="w-5 h-5 text-primary animate-spin" />
                      <span className="ml-2 text-xs text-muted-foreground">Loading schedule...</span>
                    </div>
                  ) : games.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {games.map((game) => (
                        <div
                          key={game.gameId}
                          className="group rounded-xl border border-border/50 bg-background/40 p-3 hover:border-primary/40 hover:bg-background/60 transition-all"
                        >
                          <div className="flex items-center gap-2.5 mb-2">
                            <img
                              src={`https://www.mlbstatic.com/team-logos/${getTeamId(game.opponent)}.svg`}
                              alt={game.opponent}
                              className="w-8 h-8 object-contain shrink-0"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://www.mlbstatic.com/team-logos/league-on-dark.svg';
                              }}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-xs text-foreground truncate">
                                {game.isHome ? 'vs' : '@'} {game.opponent}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                {format(parseISO(game.date), 'EEE, MMM d • h:mm a')}
                              </p>
                            </div>
                            <Badge
                              variant={game.gameType === 'S' ? 'secondary' : 'default'}
                              className="text-[9px] h-4 px-1.5 shrink-0"
                            >
                              {game.gameType === 'S' ? 'ST' : 'REG'}
                            </Badge>
                          </div>

                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-2">
                            {game.isHome ? (
                              <Home className="w-3 h-3 text-primary" />
                            ) : (
                              <Plane className="w-3 h-3" />
                            )}
                            <span className="truncate">{game.venue}</span>
                          </div>

                          {MATCHUP_ROUTES[game.opponent] && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full h-6 text-[10px] gap-1 border-primary/30"
                              onClick={() => navigate(MATCHUP_ROUTES[game.opponent])}
                            >
                              <Swords className="w-3 h-3" />
                              Matchup Breakdown
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-4">No upcoming games found.</p>
                  )}
                </div>
              </div>

              {/* Admin Alerts sidebar */}
              <aside className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xl overflow-hidden lg:sticky lg:top-20 lg:h-[calc(100vh-6rem)] lg:max-h-[760px] flex flex-col">
                <div className="px-4 py-2.5 border-b border-border/50 flex items-center justify-between bg-gradient-to-r from-primary/15 to-transparent shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="relative flex items-center justify-center">
                      <span className="absolute inline-flex h-2 w-2 rounded-full bg-primary opacity-75 animate-ping" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                    </span>
                    <h2 className="text-xs font-bold text-foreground tracking-wide">ADMIN ALERTS</h2>
                  </div>
                  <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Live</span>
                </div>
                <div className="flex-1 min-h-[420px] lg:min-h-0 overflow-hidden">
                  <AdminAlertsFeed />
                </div>
              </aside>
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
    </StreamTimeLimit>
  );
};

export default MetsXMFanZone;