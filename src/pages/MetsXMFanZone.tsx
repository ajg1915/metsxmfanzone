import { useState, useEffect, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { ClapprPlayer } from "@/components/ClapprPlayer";
import StreamTimeLimit from "@/components/StreamTimeLimit";
import LiveStreamChat from "@/components/LiveStreamChat";
import SEOHead from "@/components/SEOHead";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Radio, Tv, Signal, Clock, MapPin, Users, Mic, Trophy, Swords, Calendar, Loader2, Home, Plane } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import logo from "@/assets/metsxmfanzone-logo.png";

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

const MetsXMFanZone = () => {
  const navigate = useNavigate();
  const [games, setGames] = useState<ScheduleGame[]>([]);
  const [gamesLoading, setGamesLoading] = useState(true);

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
        {/* Hero Banner - lightweight for TV browsers */}
        <div className="relative overflow-hidden bg-primary/10">
          
          <div className="container mx-auto px-4 py-8 sm:py-12 relative z-10">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
              <div className="relative">
                <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-xl shadow-primary/20 p-2">
                  <img src={logo} alt="MetsXMFanZone" className="w-full h-full object-contain" />
                </div>
                <div className="absolute -top-2 -right-2 flex items-center gap-1 bg-destructive text-destructive-foreground px-2 py-1 rounded-full text-xs font-bold shadow-lg">
                  <Radio className="w-3 h-3" />
                  LIVE
                </div>
              </div>
              
              <div className="flex-1">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary" className="bg-primary/20 text-primary border-primary/30">
                      <Signal className="w-3 h-3 mr-1" />
                      Exclusive
                    </Badge>
                    <Badge variant="outline" className="border-muted-foreground/30">
                      <Tv className="w-3 h-3 mr-1" />
                      HD Quality
                    </Badge>
                  </div>
                  <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-foreground mb-2">
                    MetsXMFanZone <span className="text-primary">TV</span>
                  </h1>
                  <p className="text-muted-foreground text-sm sm:text-base max-w-xl">
                    Your ultimate destination for exclusive Mets content, live fan discussions, 
                    and 24/7 coverage from the heart of the fanbase.
                  </p>
                </div>
                
                <div className="flex flex-wrap gap-3 mt-4">
                  <div className="flex items-center gap-2 bg-background/50 px-3 py-2 rounded-lg border border-border/50">
                    <MapPin className="w-4 h-4 text-primary" />
                    <span className="text-xs text-foreground">New York, NY</span>
                  </div>
                  <div className="flex items-center gap-2 bg-background/50 px-3 py-2 rounded-lg border border-border/50">
                    <Clock className="w-4 h-4 text-primary" />
                    <span className="text-xs text-foreground">24/7 Fan Coverage</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stream Player Section */}
        <div className="container mx-auto px-4 py-6 sm:py-8">
          <div className="max-w-6xl mx-auto">
            <ClapprPlayer
              pageTitle="MetsXMFanZone Live Stream"
              pageDescription="Ultimate Destination Where the Fans Go"
            />

            {/* Upcoming Games & Matchup Breakdowns */}
            <div className="mt-8">
              <div className="flex items-center gap-3 mb-4">
                <Swords className="w-5 h-5 text-primary" />
                <h2 className="text-xl sm:text-2xl font-bold text-foreground">Upcoming Games & Matchups</h2>
              </div>

              {gamesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-primary" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading schedule...</span>
                </div>
              ) : games.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {games.map((game) => (
                    <Card key={game.gameId} className="border-border/50 overflow-hidden">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3 mb-2">
                          <img 
                            src={`https://www.mlbstatic.com/team-logos/${getTeamId(game.opponent)}.svg`}
                            alt={game.opponent}
                            className="w-8 h-8 object-contain"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://www.mlbstatic.com/team-logos/league-on-dark.svg';
                            }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-foreground line-clamp-1">
                              {game.isHome ? 'vs' : '@'} {game.opponent}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(parseISO(game.date), 'EEE, MMM d • h:mm a')}
                            </p>
                          </div>
                          <Badge 
                            variant={game.gameType === 'S' ? 'secondary' : 'default'}
                            className="text-[10px] shrink-0"
                          >
                            {game.gameType === 'S' ? 'ST' : 'REG'}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                          {game.isHome ? (
                            <Home className="w-3 h-3 text-primary" />
                          ) : (
                            <Plane className="w-3 h-3 text-muted-foreground" />
                          )}
                          <span className="line-clamp-1">{game.venue}</span>
                        </div>

                        {MATCHUP_ROUTES[game.opponent] && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full h-7 text-xs gap-1 border-primary/30"
                            onClick={() => navigate(MATCHUP_ROUTES[game.opponent])}
                          >
                            <Swords className="w-3 h-3" />
                            View Matchup Breakdown
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No upcoming games found.</p>
              )}
            </div>
            
            {/* Channel Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
              <Card className="bg-gradient-to-br from-card to-card/50 border-border/50">
                <CardContent className="p-4 sm:p-6">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <Mic className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-bold text-lg text-foreground mb-2">Live Shows</h3>
                  <p className="text-sm text-muted-foreground">
                    Exclusive live shows featuring fan discussions, game reactions, and special guest appearances.
                  </p>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-card to-card/50 border-border/50">
                <CardContent className="p-4 sm:p-6">
                  <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center mb-4">
                    <Users className="w-6 h-6 text-secondary" />
                  </div>
                  <h3 className="font-bold text-lg text-foreground mb-2">Fan Community</h3>
                  <p className="text-sm text-muted-foreground">
                    Connect with fellow Mets fans in real-time during live streams and interactive events.
                  </p>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-card to-card/50 border-border/50">
                <CardContent className="p-4 sm:p-6">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <Trophy className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-bold text-lg text-foreground mb-2">Exclusive Content</h3>
                  <p className="text-sm text-muted-foreground">
                    Premium Mets content you won't find anywhere else - interviews, analysis, and behind-the-scenes.
                  </p>
                </CardContent>
              </Card>
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