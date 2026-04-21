import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import SEOHead from "@/components/SEOHead";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Tv, TrendingUp, Trophy, Target, Users, Star, 
  ArrowRight, Flame, Zap, DollarSign, BarChart3, 
  Play, Radio, Calendar, ChevronRight, Award
} from "lucide-react";
import { motion } from "framer-motion";
import logo from "@/assets/metsxmfanzone-logo.png";

interface PlayerStats {
  name: string;
  position: string;
  avg?: string;
  hr?: number;
  rbi?: number;
  era?: string;
  wins?: number;
  strikeouts?: number;
  imageId?: number;
}

interface TeamData {
  name: string;
  abbr: string;
  primaryColor: string;
  secondaryColor: string;
  logo: string;
  teamId: number;
  record: string;
  springRecord: string;
  keyPlayers: PlayerStats[];
  keyPitchers: PlayerStats[];
}

interface BettingLine {
  spread: string;
  moneyline: { mets: string; opponent: string };
  overUnder: string;
}

interface AnthonyPick {
  pick: string;
  confidence: number;
  reasoning: string;
  whereToBet: string[];
  recommendation: string;
}

interface MatchupPageProps {
  opponent: TeamData;
  metsData: TeamData;
  bettingLines: BettingLine;
  anthonyPick: AnthonyPick;
  headToHead: { metsWins: number; opponentWins: number };
  heroImage: string;
  matchupDate?: string;
}

const MLB_LOGO_URL = (teamId: number) => 
  `https://www.mlbstatic.com/team-logos/${teamId}.svg`;

const MLB_PLAYER_IMG = (playerId: number) =>
  `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${playerId}/headshot/67/current`;

export default function MatchupPage({
  opponent,
  metsData,
  bettingLines,
  anthonyPick,
  headToHead,
  heroImage,
  matchupDate
}: MatchupPageProps) {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isPremium, loading: subLoading } = useSubscription();
  const [showUpgrade, setShowUpgrade] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!authLoading && !subLoading && user && !isPremium) {
      setShowUpgrade(true);
    }
  }, [user, isPremium, authLoading, subLoading]);

  if (authLoading || subLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  const totalGames = headToHead.metsWins + headToHead.opponentWins;
  const metsWinPct = totalGames > 0 ? (headToHead.metsWins / totalGames) * 100 : 50;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEOHead
        title={`Mets vs ${opponent.name} 2026 — Matchup, Stats & Picks`}
        description={`Mets vs ${opponent.name} matchup breakdown: head-to-head record (${headToHead.metsWins}-${headToHead.opponentWins}), key players, betting lines, and Anthony's expert picks for 2026.`}
        keywords={`Mets vs ${opponent.name}, ${opponent.name} vs Mets, Mets ${opponent.abbr} matchup, Mets 2026, Mets betting picks, ${opponent.name} betting odds`}
        canonical={`https://metsxmfanzone.com/matchup/${opponent.abbr.toLowerCase()}`}
        ogType="article"
        section="Sports"
        tags={["MLB", "Mets", opponent.name, "Matchup", "2026 Season"]}
        structuredData={{
          "@context": "https://schema.org",
          "@type": "SportsEvent",
          "name": `New York Mets vs ${opponent.name}`,
          "description": `Matchup analysis: Mets vs ${opponent.name} for the 2026 MLB season.`,
          "sport": "Baseball",
          "startDate": matchupDate || "2026",
          "competitor": [
            { "@type": "SportsTeam", "name": "New York Mets", "sport": "Baseball" },
            { "@type": "SportsTeam", "name": opponent.name, "sport": "Baseball" },
          ],
          "organizer": {
            "@type": "SportsOrganization",
            "name": "Major League Baseball",
            "url": "https://www.mlb.com",
          },
        }}
      />
      <Navigation />

      <UpgradePrompt open={showUpgrade} onOpenChange={setShowUpgrade} />

      <main className="flex-1 pt-12">
        {/* Hero Banner */}
        <div className="relative overflow-hidden min-h-[300px] sm:min-h-[400px]">
          <div 
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${heroImage})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
          
          {/* Animated elements */}
          <motion.div
            className="absolute top-10 right-10 w-64 h-64 rounded-full blur-3xl"
            style={{ backgroundColor: `${opponent.primaryColor}20` }}
            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 4, repeat: Infinity }}
          />
          
          <div className="container mx-auto px-4 py-8 sm:py-12 relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="flex flex-col items-center text-center"
            >
              {/* Team logos */}
              <div className="flex items-center gap-4 sm:gap-8 mb-6">
                <motion.div
                  className="relative"
                  initial={{ x: -50, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-2xl bg-[#ff4500]/20 backdrop-blur-sm flex items-center justify-center border-2 border-[#ff4500]/50 p-3">
                    <img 
                      src={MLB_LOGO_URL(metsData.teamId)} 
                      alt="Mets" 
                      className="w-full h-full object-contain"
                      onError={(e) => (e.currentTarget.src = '/placeholder.svg')}
                    />
                  </div>
                </motion.div>
                
                <div className="flex flex-col items-center">
                  <Badge className="bg-primary text-primary-foreground mb-2">
                    <Calendar className="w-3 h-3 mr-1" />
                    Spring Training
                  </Badge>
                  <span className="text-3xl sm:text-5xl font-black text-foreground">VS</span>
                </div>
                
                <motion.div
                  className="relative"
                  initial={{ x: 50, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  <div 
                    className="w-20 h-20 sm:w-28 sm:h-28 rounded-2xl backdrop-blur-sm flex items-center justify-center border-2 p-3"
                    style={{ 
                      backgroundColor: `${opponent.primaryColor}20`,
                      borderColor: `${opponent.primaryColor}50`
                    }}
                  >
                    <img 
                      src={MLB_LOGO_URL(opponent.teamId)} 
                      alt={opponent.name} 
                      className="w-full h-full object-contain"
                      onError={(e) => (e.currentTarget.src = '/placeholder.svg')}
                    />
                  </div>
                </motion.div>
              </div>

              <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-foreground mb-2">
                <span className="text-[#ff4500]">Mets</span> vs <span className="text-white">{opponent.name}</span>
              </h1>
              
              <p className="text-muted-foreground text-sm sm:text-base max-w-xl">
                Complete matchup breakdown with stats, betting lines, and expert analysis
              </p>

              {matchupDate && (
                <Badge variant="outline" className="mt-4">
                  <Calendar className="w-3 h-3 mr-1" />
                  {matchupDate}
                </Badge>
              )}
            </motion.div>
          </div>
        </div>

        {/* Quick Stats Bar */}
        <div className="bg-card border-y border-border">
          <div className="container mx-auto px-4 py-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground">Mets Record</p>
                <p className="text-lg font-bold text-[#ff4500]">{metsData.record}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{opponent.abbr} Record</p>
                <p className="text-lg font-bold" style={{ color: opponent.primaryColor }}>{opponent.record}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Head to Head</p>
                <p className="text-lg font-bold text-foreground">{headToHead.metsWins}-{headToHead.opponentWins}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Spring Record</p>
                <p className="text-lg font-bold text-primary">{metsData.springRecord}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="container mx-auto px-4 py-8">
          <Tabs defaultValue="comparison" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4 h-auto">
              <TabsTrigger value="comparison" className="text-xs sm:text-sm py-2">
                <BarChart3 className="w-4 h-4 mr-1 hidden sm:inline" />
                Stats
              </TabsTrigger>
              <TabsTrigger value="players" className="text-xs sm:text-sm py-2">
                <Users className="w-4 h-4 mr-1 hidden sm:inline" />
                Players
              </TabsTrigger>
              <TabsTrigger value="betting" className="text-xs sm:text-sm py-2">
                <DollarSign className="w-4 h-4 mr-1 hidden sm:inline" />
                Betting
              </TabsTrigger>
              <TabsTrigger value="picks" className="text-xs sm:text-sm py-2">
                <Star className="w-4 h-4 mr-1 hidden sm:inline" />
                Anthony's
              </TabsTrigger>
            </TabsList>

            {/* Stats Comparison Tab */}
            <TabsContent value="comparison" className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Head to Head Visual */}
                <Card className="col-span-full">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-primary" />
                      Historical Matchup
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="font-bold text-[#ff4500]">Mets: {headToHead.metsWins} Wins</span>
                        <span className="font-bold" style={{ color: opponent.primaryColor }}>
                          {opponent.abbr}: {headToHead.opponentWins} Wins
                        </span>
                      </div>
                      <div className="relative h-8 rounded-full overflow-hidden bg-muted">
                        <motion.div 
                          className="absolute left-0 top-0 h-full bg-gradient-to-r from-[#ff4500] to-[#FF5910]"
                          initial={{ width: 0 }}
                          animate={{ width: `${metsWinPct}%` }}
                          transition={{ duration: 1, delay: 0.5 }}
                        />
                        <motion.div 
                          className="absolute right-0 top-0 h-full"
                          style={{ backgroundColor: opponent.primaryColor }}
                          initial={{ width: 0 }}
                          animate={{ width: `${100 - metsWinPct}%` }}
                          transition={{ duration: 1, delay: 0.5 }}
                        />
                      </div>
                      <p className="text-center text-muted-foreground text-sm">
                        {metsWinPct > 50 
                          ? `Mets have won ${metsWinPct.toFixed(0)}% of matchups`
                          : metsWinPct < 50
                          ? `${opponent.name} have won ${(100 - metsWinPct).toFixed(0)}% of matchups`
                          : "Series is tied"
                        }
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Mets Key Stats */}
                <Card className="border-[#ff4500]/30">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-3">
                      <img 
                        src={MLB_LOGO_URL(metsData.teamId)} 
                        alt="Mets"
                        className="w-10 h-10"
                        onError={(e) => (e.currentTarget.src = '/placeholder.svg')}
                      />
                      <div>
                        <CardTitle className="text-[#ff4500]">New York Mets</CardTitle>
                        <p className="text-sm text-muted-foreground">{metsData.record} | Spring: {metsData.springRecord}</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <StatBar label="Team AVG" value=".265" pct={75} color="#ff4500" />
                    <StatBar label="Team ERA" value="3.45" pct={80} color="#ff4500" />
                    <StatBar label="Home Runs" value="185" pct={70} color="#ff4500" />
                    <StatBar label="Run Differential" value="+45" pct={85} color="#ff4500" />
                  </CardContent>
                </Card>

                {/* Opponent Key Stats */}
                <Card style={{ borderColor: `${opponent.primaryColor}30` }}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-3">
                      <img 
                        src={MLB_LOGO_URL(opponent.teamId)} 
                        alt={opponent.name}
                        className="w-10 h-10"
                        onError={(e) => (e.currentTarget.src = '/placeholder.svg')}
                      />
                      <div>
                        <CardTitle style={{ color: opponent.primaryColor }}>{opponent.name}</CardTitle>
                        <p className="text-sm text-muted-foreground">{opponent.record} | Spring: {opponent.springRecord}</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <StatBar label="Team AVG" value=".258" pct={70} color={opponent.primaryColor} />
                    <StatBar label="Team ERA" value="3.78" pct={72} color={opponent.primaryColor} />
                    <StatBar label="Home Runs" value="168" pct={65} color={opponent.primaryColor} />
                    <StatBar label="Run Differential" value="+28" pct={70} color={opponent.primaryColor} />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Players Tab */}
            <TabsContent value="players" className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Mets Key Players */}
                <div>
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                    <img src={MLB_LOGO_URL(metsData.teamId)} alt="Mets" className="w-6 h-6" />
                    Mets Key Players
                  </h3>
                  <div className="space-y-3">
                    {metsData.keyPlayers.map((player, idx) => (
                      <PlayerCard key={idx} player={player} teamColor="#ff4500" />
                    ))}
                  </div>
                  <h4 className="font-bold text-md mt-6 mb-4 flex items-center gap-2">
                    <Flame className="w-4 h-4 text-primary" />
                    Starting Pitchers
                  </h4>
                  <div className="space-y-3">
                    {metsData.keyPitchers.map((player, idx) => (
                      <PitcherCard key={idx} player={player} teamColor="#ff4500" />
                    ))}
                  </div>
                </div>

                {/* Opponent Key Players */}
                <div>
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                    <img src={MLB_LOGO_URL(opponent.teamId)} alt={opponent.name} className="w-6 h-6" />
                    {opponent.name} Key Players
                  </h3>
                  <div className="space-y-3">
                    {opponent.keyPlayers.map((player, idx) => (
                      <PlayerCard key={idx} player={player} teamColor={opponent.primaryColor} />
                    ))}
                  </div>
                  <h4 className="font-bold text-md mt-6 mb-4 flex items-center gap-2">
                    <Flame className="w-4 h-4 text-primary" />
                    Starting Pitchers
                  </h4>
                  <div className="space-y-3">
                    {opponent.keyPitchers.map((player, idx) => (
                      <PitcherCard key={idx} player={player} teamColor={opponent.primaryColor} />
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Betting Tab */}
            <TabsContent value="betting" className="space-y-6">
              <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-background">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-primary" />
                    Betting Lines
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid sm:grid-cols-3 gap-6">
                    <div className="text-center p-4 rounded-xl bg-card border border-border">
                      <p className="text-xs text-muted-foreground uppercase mb-2">Spread</p>
                      <p className="text-2xl font-black text-foreground">{bettingLines.spread}</p>
                    </div>
                    <div className="text-center p-4 rounded-xl bg-card border border-border">
                      <p className="text-xs text-muted-foreground uppercase mb-2">Moneyline</p>
                      <div className="flex justify-center gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">NYM</p>
                          <p className="text-xl font-bold text-[#002D72]">{bettingLines.moneyline.mets}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">{opponent.abbr}</p>
                          <p className="text-xl font-bold" style={{ color: opponent.primaryColor }}>
                            {bettingLines.moneyline.opponent}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="text-center p-4 rounded-xl bg-card border border-border">
                      <p className="text-xs text-muted-foreground uppercase mb-2">Over/Under</p>
                      <p className="text-2xl font-black text-foreground">{bettingLines.overUnder}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-primary" />
                    Key Prop Bets to Watch
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-muted/50 border border-border">
                      <p className="text-sm font-medium">First Inning Over 0.5 Runs</p>
                      <p className="text-xs text-muted-foreground mt-1">Spring games often start with scoring</p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50 border border-border">
                      <p className="text-sm font-medium">Total Hits Over 15.5</p>
                      <p className="text-xs text-muted-foreground mt-1">Pitchers still building arm strength</p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50 border border-border">
                      <p className="text-sm font-medium">Lead After 5 Innings</p>
                      <p className="text-xs text-muted-foreground mt-1">Starters usually go 3-5 innings max</p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50 border border-border">
                      <p className="text-sm font-medium">Total Strikeouts Under 14.5</p>
                      <p className="text-xs text-muted-foreground mt-1">Mix of AAA players affects K rate</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Anthony's Picks Tab */}
            <TabsContent value="picks" className="space-y-6">
              <Card className="border-2 border-primary bg-gradient-to-br from-primary/10 via-background to-[#FF5910]/10">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden p-1">
                      <img src={logo} alt="MetsXMFanZone" className="w-full h-full object-contain" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">Anthony's Pick</CardTitle>
                      <p className="text-sm text-muted-foreground">Expert Analysis & Prediction</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="p-6 rounded-xl bg-card border-2 border-primary/50 shadow-lg shadow-primary/10">
                    <div className="flex items-center gap-2 mb-3">
                      <Award className="w-5 h-5 text-primary" />
                      <span className="text-sm font-medium text-muted-foreground">MY PICK</span>
                    </div>
                    <p className="text-2xl sm:text-3xl font-black text-foreground mb-4">
                      {anthonyPick.pick}
                    </p>
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-sm text-muted-foreground">Confidence:</span>
                      <div className="flex-1 max-w-[200px]">
                        <Progress value={anthonyPick.confidence} className="h-3" />
                      </div>
                      <span className="font-bold text-primary">{anthonyPick.confidence}%</span>
                    </div>
                    <p className="text-muted-foreground">{anthonyPick.reasoning}</p>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-primary" />
                          Where to Bet
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {anthonyPick.whereToBet.map((site, idx) => (
                            <li key={idx} className="flex items-center gap-2 text-sm">
                              <ChevronRight className="w-4 h-4 text-primary" />
                              {site}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Zap className="w-4 h-4 text-primary" />
                          Recommendation
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">{anthonyPick.recommendation}</p>
                      </CardContent>
                    </Card>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Stream Access Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-12"
          >
            <Card className="border-primary/50 bg-gradient-to-r from-primary/10 to-[#FF5910]/10">
              <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4 py-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                    <Tv className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Watch the Game Live</h3>
                    <p className="text-sm text-muted-foreground">Catch all the action on MetsXMFanZone TV</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" asChild>
                    <Link to="/spring-training-live">
                      <Radio className="w-4 h-4 mr-2" />
                      Spring Training
                    </Link>
                  </Button>
                  <Button asChild>
                    <Link to="/metsxmfanzone">
                      <Play className="w-4 h-4 mr-2" />
                      Watch Live
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

// Helper Components
function StatBar({ label, value, pct, color }: { label: string; value: string; pct: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-bold" style={{ color }}>{value}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <motion.div 
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, delay: 0.3 }}
        />
      </div>
    </div>
  );
}

function PlayerCard({ player, teamColor }: { player: PlayerStats; teamColor: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border hover:border-primary/50 transition-colors">
      <div className="w-12 h-12 rounded-full bg-muted overflow-hidden">
        {player.imageId ? (
          <img 
            src={MLB_PLAYER_IMG(player.imageId)} 
            alt={player.name}
            className="w-full h-full object-cover"
            onError={(e) => (e.currentTarget.src = '/placeholder.svg')}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <Users className="w-5 h-5" />
          </div>
        )}
      </div>
      <div className="flex-1">
        <p className="font-semibold text-sm" style={{ color: teamColor }}>{player.name}</p>
        <p className="text-xs text-muted-foreground">{player.position}</p>
      </div>
      <div className="text-right">
        <p className="font-bold text-sm">{player.avg}</p>
        <p className="text-xs text-muted-foreground">{player.hr} HR | {player.rbi} RBI</p>
      </div>
    </div>
  );
}

function PitcherCard({ player, teamColor }: { player: PlayerStats; teamColor: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border hover:border-primary/50 transition-colors">
      <div className="w-12 h-12 rounded-full bg-muted overflow-hidden">
        {player.imageId ? (
          <img 
            src={MLB_PLAYER_IMG(player.imageId)} 
            alt={player.name}
            className="w-full h-full object-cover"
            onError={(e) => (e.currentTarget.src = '/placeholder.svg')}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <Flame className="w-5 h-5" />
          </div>
        )}
      </div>
      <div className="flex-1">
        <p className="font-semibold text-sm" style={{ color: teamColor }}>{player.name}</p>
        <p className="text-xs text-muted-foreground">{player.position}</p>
      </div>
      <div className="text-right">
        <p className="font-bold text-sm">{player.era} ERA</p>
        <p className="text-xs text-muted-foreground">{player.wins} W | {player.strikeouts} K</p>
      </div>
    </div>
  );
}
