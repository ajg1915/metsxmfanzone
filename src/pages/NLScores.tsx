import { useState, useEffect } from 'react';
import SEOHead from '@/components/SEOHead';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

interface GameData {
  gamePk: number;
  gameDate: string;
  status: {
    abstractGameState: string;
    detailedState: string;
    statusCode: string;
  };
  teams: {
    away: {
      team: { id: number; name: string };
      score?: number;
      isWinner?: boolean;
    };
    home: {
      team: { id: number; name: string };
      score?: number;
      isWinner?: boolean;
    };
  };
  venue: { name: string };
  linescore?: {
    currentInning?: number;
    currentInningOrdinal?: string;
    inningState?: string;
    innings?: Array<{
      num: number;
      home: { runs?: number };
      away: { runs?: number };
    }>;
  };
}

// NL Team IDs
const NL_TEAM_IDS = [
  109, // Arizona Diamondbacks
  144, // Atlanta Braves
  112, // Chicago Cubs
  113, // Cincinnati Reds
  115, // Colorado Rockies
  119, // Los Angeles Dodgers
  146, // Miami Marlins
  158, // Milwaukee Brewers
  121, // New York Mets
  143, // Philadelphia Phillies
  134, // Pittsburgh Pirates
  135, // San Diego Padres
  137, // San Francisco Giants
  138, // St. Louis Cardinals
  120, // Washington Nationals
];

const NLScores = () => {
  const [games, setGames] = useState<GameData[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

  const fetchNLGames = async (date: string) => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}&hydrate=team,linescore`
      );
      const data = await response.json();
      
      if (data.dates && data.dates.length > 0) {
        const allGames = data.dates[0].games || [];
        // Filter for NL games (both teams must be NL teams for it to be an NL-only game,
        // or at least one team is NL for interleague)
        const nlGames = allGames.filter((game: GameData) => 
          NL_TEAM_IDS.includes(game.teams.home.team.id) || 
          NL_TEAM_IDS.includes(game.teams.away.team.id)
        );
        setGames(nlGames);
      } else {
        setGames([]);
      }
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching NL games:', error);
      setGames([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNLGames(selectedDate);
    // Refresh every 30 seconds for live updates
    const interval = setInterval(() => fetchNLGames(selectedDate), 30000);
    return () => clearInterval(interval);
  }, [selectedDate]);

  const getTeamLogo = (teamId: number) => {
    return `https://www.mlbstatic.com/team-logos/${teamId}.svg`;
  };

  const getGameStatus = (game: GameData) => {
    const status = game.status.detailedState;
    if (status === 'In Progress') {
      return `${game.linescore?.inningState} ${game.linescore?.currentInningOrdinal}`;
    }
    if (status === 'Scheduled' || status === 'Pre-Game') {
      const gameTime = new Date(game.gameDate);
      return format(gameTime, 'h:mm a');
    }
    return status;
  };

  const isLive = (game: GameData) => {
    return game.status.abstractGameState === 'Live';
  };

  const GameCard = ({ game }: { game: GameData }) => (
    <Card className="bg-card/50 backdrop-blur border-border/50 hover:border-primary/30 transition-all">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <Badge 
            variant={isLive(game) ? "destructive" : "secondary"}
            className={isLive(game) ? "animate-pulse" : ""}
          >
            {getGameStatus(game)}
          </Badge>
          <span className="text-xs text-muted-foreground truncate ml-2">
            {game.venue.name}
          </span>
        </div>

        {/* Away Team */}
        <div className={`flex items-center justify-between py-2 ${
          game.status.abstractGameState === 'Final' && game.teams.away.isWinner 
            ? 'font-bold' : ''
        }`}>
          <div className="flex items-center gap-3">
            <img 
              src={getTeamLogo(game.teams.away.team.id)} 
              alt={game.teams.away.team.name}
              className="w-8 h-8 object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/placeholder.svg';
              }}
            />
            <span className="text-sm">{game.teams.away.team.name}</span>
          </div>
          <span className="text-lg font-semibold">
            {game.teams.away.score ?? '-'}
          </span>
        </div>

        {/* Home Team */}
        <div className={`flex items-center justify-between py-2 border-t border-border/30 ${
          game.status.abstractGameState === 'Final' && game.teams.home.isWinner 
            ? 'font-bold' : ''
        }`}>
          <div className="flex items-center gap-3">
            <img 
              src={getTeamLogo(game.teams.home.team.id)} 
              alt={game.teams.home.team.name}
              className="w-8 h-8 object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/placeholder.svg';
              }}
            />
            <span className="text-sm">{game.teams.home.team.name}</span>
          </div>
          <span className="text-lg font-semibold">
            {game.teams.home.score ?? '-'}
          </span>
        </div>

        {/* Line Score for live/final games */}
        {game.linescore?.innings && game.linescore.innings.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border/30 overflow-x-auto">
            <div className="flex gap-1 text-xs min-w-max">
              <span className="w-12"></span>
              {game.linescore.innings.map((inning) => (
                <span key={inning.num} className="w-6 text-center text-muted-foreground">
                  {inning.num}
                </span>
              ))}
              <span className="w-8 text-center font-semibold">R</span>
            </div>
            <div className="flex gap-1 text-xs min-w-max mt-1">
              <span className="w-12 truncate">{game.teams.away.team.name.split(' ').pop()}</span>
              {game.linescore.innings.map((inning) => (
                <span key={inning.num} className="w-6 text-center">
                  {inning.away.runs ?? '-'}
                </span>
              ))}
              <span className="w-8 text-center font-semibold">{game.teams.away.score}</span>
            </div>
            <div className="flex gap-1 text-xs min-w-max mt-1">
              <span className="w-12 truncate">{game.teams.home.team.name.split(' ').pop()}</span>
              {game.linescore.innings.map((inning) => (
                <span key={inning.num} className="w-6 text-center">
                  {inning.home.runs ?? '-'}
                </span>
              ))}
              <span className="w-8 text-center font-semibold">{game.teams.home.score}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const LoadingSkeleton = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <Card key={i} className="bg-card/50">
          <CardContent className="p-4">
            <Skeleton className="h-6 w-20 mb-4" />
            <Skeleton className="h-10 w-full mb-2" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <>
      <SEOHead
        title="MLB NL Scores - Live National League Games"
        description="Live MLB National League scores and game updates. Real-time NL baseball scores, standings, and game information."
        keywords="NL scores, National League scores, MLB scores today, NL baseball, NL standings"
        canonical="https://www.metsxmfanzone.com/nl-scores"
      />

      <div className="min-h-screen bg-background">
        <Navigation />
        
        <main className="container mx-auto px-4 pt-12 md:pt-24 pb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">
                MLB NL Scores
              </h1>
              <p className="text-muted-foreground text-xs">
                Live • 30s refresh
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-secondary text-foreground border border-border rounded px-2 py-1 text-xs"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchNLGames(selectedDate)}
                disabled={loading}
                className="h-7 w-7 p-0"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground mb-4">
            Last updated: {format(lastUpdated, 'h:mm:ss a')}
          </p>

          {loading && games.length === 0 ? (
            <LoadingSkeleton />
          ) : games.length === 0 ? (
            <Card className="bg-card/50 backdrop-blur">
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">No NL games scheduled for {format(new Date(selectedDate), 'MMMM d, yyyy')}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {games.map((game) => (
                <GameCard key={game.gamePk} game={game} />
              ))}
            </div>
          )}
        </main>

        <Footer />
      </div>
    </>
  );
};

export default NLScores;
