import SEOHead from "@/components/SEOHead";
import { useState, useEffect } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, BarChart3, Users, Radio } from "lucide-react";
import GamecastTicker from "@/components/gamecast/GamecastTicker";
import GamecastScoreboard from "@/components/gamecast/GamecastScoreboard";
import GamecastLineScore from "@/components/gamecast/GamecastLineScore";
import GamecastBoxScore from "@/components/gamecast/GamecastBoxScore";
import GamecastLineup from "@/components/gamecast/GamecastLineup";
import GamecastPlays, { type PlayEvent } from "@/components/gamecast/GamecastPlays";

interface GameData {
  gamePk: number;
  gameDate: string;
  status: { abstractGameState: string; detailedState: string; statusCode: string };
  teams: {
    away: { team: { id: number; name: string }; score?: number };
    home: { team: { id: number; name: string }; score?: number };
  };
  linescore?: {
    currentInning?: number;
    currentInningOrdinal?: string;
    inningState?: string;
    innings?: Array<{ num: number; home?: { runs?: number }; away?: { runs?: number } }>;
    offense?: { batter?: { id: number; fullName: string }; onDeck?: { id: number; fullName: string }; inHole?: { id: number; fullName: string }; first?: boolean; second?: boolean; third?: boolean };
    defense?: { pitcher?: { id: number; fullName: string } };
    balls?: number;
    strikes?: number;
    outs?: number;
  };
  venue?: { name: string };
}

interface OtherGame {
  gamePk: number;
  teams: {
    away: { team: { id: number; name: string }; score?: number };
    home: { team: { id: number; name: string }; score?: number };
  };
  status: { abstractGameState: string; detailedState: string };
}

const getSampleGameData = (): GameData => ({
  gamePk: 0,
  gameDate: new Date().toISOString(),
  status: { abstractGameState: 'Preview', detailedState: 'Scheduled', statusCode: 'S' },
  teams: {
    away: { team: { id: 144, name: 'Atlanta Braves' }, score: 0 },
    home: { team: { id: 121, name: 'New York Mets' }, score: 0 },
  },
  linescore: {
    currentInning: 1, currentInningOrdinal: '1st', inningState: 'Top',
    innings: [], offense: { first: false, second: false, third: false },
    balls: 0, strikes: 0, outs: 0,
  },
  venue: { name: 'Citi Field' },
});

const MetsGamecast = () => {
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [boxScore, setBoxScore] = useState<any>(null);
  const [plays, setPlays] = useState<PlayEvent[]>([]);
  const [otherGames, setOtherGames] = useState<OtherGame[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGameData = async () => {
      try {
        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
        const [metsRes, allRes] = await Promise.all([
          fetch(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=121&date=${today}&hydrate=linescore,team,venue`),
          fetch(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${today}&hydrate=team,linescore`),
        ]);
        const [metsData, allData] = await Promise.all([metsRes.json(), allRes.json()]);

        if (allData.dates?.[0]?.games) {
          setOtherGames(allData.dates[0].games.filter((g: any) => g.teams.away.team.id !== 121 && g.teams.home.team.id !== 121));
        }

        if (metsData.dates?.[0]?.games?.[0]) {
          const game = metsData.dates[0].games[0];
          setGameData(game);

          if (game.status.abstractGameState !== 'Preview') {
            const liveRes = await fetch(`https://statsapi.mlb.com/api/v1.1/game/${game.gamePk}/feed/live`);
            const liveData = await liveRes.json();
            setBoxScore(liveData.liveData?.boxscore);

            const allPlays = liveData.liveData?.plays?.allPlays || [];
            const completedPlays: PlayEvent[] = allPlays
              .filter((p: any) => p.about?.isComplete)
              .map((p: any) => ({
                result: {
                  description: p.result?.description || '',
                  event: p.result?.event || '',
                  eventType: p.result?.eventType || '',
                  rbi: p.result?.rbi || 0,
                  awayScore: p.result?.awayScore,
                  homeScore: p.result?.homeScore,
                },
                about: {
                  atBatIndex: p.about?.atBatIndex || 0,
                  halfInning: p.about?.halfInning || 'top',
                  inning: p.about?.inning || 1,
                  isComplete: true,
                  isScoringPlay: p.about?.isScoringPlay || false,
                },
                matchup: {
                  batter: p.matchup?.batter ? { fullName: p.matchup.batter.fullName } : undefined,
                  pitcher: p.matchup?.pitcher ? { fullName: p.matchup.pitcher.fullName } : undefined,
                },
              }));
            setPlays(completedPlays);
          }
        } else {
          setGameData(getSampleGameData());
        }
      } catch (error) {
        console.error('Error fetching game data:', error);
        setGameData(getSampleGameData());
      } finally {
        setLoading(false);
      }
    };

    fetchGameData();
    const interval = setInterval(fetchGameData, 30000);
    return () => clearInterval(interval);
  }, []);

  const isLive = gameData?.status.abstractGameState === 'Live';

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navigation />
        <main className="flex-1 pt-14 px-3 sm:px-6 max-w-[1400px] mx-auto w-full space-y-4">
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-56 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEOHead
        title="MetsXMFanZone Gamecast - Live Game Updates"
        description="Follow New York Mets games live with real-time scores, play-by-play, box scores, and live commentary."
        keywords="Mets gamecast, Mets live updates, Mets play by play, Mets box score, MLB live"
        canonical="https://www.metsxmfanzone.com/mets-gamecast"
      />
      <Navigation />

      <main className="flex-1 pt-12">
        {/* Broadcast Header Bar */}
        <div className="relative overflow-hidden border-b border-border/20">
          <div className="absolute inset-0 bg-gradient-to-r from-mets-blue/20 via-transparent to-mets-orange/10" />
          <div className="relative max-w-[1400px] mx-auto px-3 sm:px-6 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-1 h-5 rounded-full bg-primary" />
              <h1 className="text-sm sm:text-base font-black tracking-tight uppercase text-foreground">
                Game Center
              </h1>
              {isLive && (
                <span className="flex items-center gap-1 text-[10px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 rounded-full px-2 py-0.5">
                  <Radio className="w-3 h-3 animate-pulse" />
                  LIVE
                </span>
              )}
            </div>
            <span className="text-[10px] sm:text-xs text-muted-foreground font-mono">
              {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
          </div>
        </div>

        {/* MLB Ticker */}
        <GamecastTicker games={otherGames} />

        {/* Main Content Grid */}
        <div className="max-w-[1400px] mx-auto">
          <div className="flex flex-col lg:flex-row">
            {/* Left Column - Scoreboard + Line Score */}
            <div className="flex-1 p-3 sm:p-5 space-y-4">
              {gameData && <GamecastScoreboard gameData={gameData} />}
              {gameData && <GamecastLineScore gameData={gameData} />}
            </div>

            {/* Right Column - Tabs Panel */}
            <div className="w-full lg:w-[420px] border-t lg:border-t-0 lg:border-l border-border/10 bg-card/30 backdrop-blur-sm">
              <Tabs defaultValue="plays" className="w-full h-full flex flex-col">
                <TabsList className="w-full rounded-none border-b border-border/10 bg-transparent p-0 h-auto shrink-0">
                  <TabsTrigger
                    value="plays"
                    className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary text-xs font-bold uppercase tracking-wider py-3 gap-1.5"
                  >
                    <Activity className="w-3.5 h-3.5" />
                    Plays
                  </TabsTrigger>
                  <TabsTrigger
                    value="lineup"
                    className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary text-xs font-bold uppercase tracking-wider py-3 gap-1.5"
                  >
                    <Users className="w-3.5 h-3.5" />
                    Lineup
                  </TabsTrigger>
                  <TabsTrigger
                    value="box"
                    className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary text-xs font-bold uppercase tracking-wider py-3 gap-1.5"
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    Box Score
                  </TabsTrigger>
                </TabsList>
                <div className="flex-1 p-3 sm:p-4 pb-20 sm:pb-4 overflow-y-auto">
                  <TabsContent value="plays" className="mt-0">
                    <GamecastPlays plays={plays} />
                  </TabsContent>
                  <TabsContent value="lineup" className="mt-0">
                    {gameData && <GamecastLineup gameData={gameData} boxScore={boxScore} />}
                  </TabsContent>
                  <TabsContent value="box" className="mt-0">
                    {gameData && <GamecastBoxScore gameData={gameData} boxScore={boxScore} />}
                  </TabsContent>
                </div>
              </Tabs>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default MetsGamecast;
