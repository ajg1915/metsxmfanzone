import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import SEOHead from "@/components/SEOHead";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, User, Calendar, MapPin, Ruler, Scale } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface PlayerInfo {
  id: number;
  fullName: string;
  firstName: string;
  lastName: string;
  jerseyNumber: string;
  primaryPosition: {
    name: string;
    abbreviation: string;
    type: string;
  };
  batSide: {
    code: string;
    description: string;
  };
  pitchHand: {
    code: string;
    description: string;
  };
  birthDate: string;
  birthCity: string;
  birthStateProvince: string;
  birthCountry: string;
  height: string;
  weight: number;
  currentAge: number;
  mlbDebutDate: string;
  active: boolean;
}

interface CareerStats {
  hitting?: {
    gamesPlayed: number;
    atBats: number;
    runs: number;
    hits: number;
    doubles: number;
    triples: number;
    homeRuns: number;
    rbi: number;
    stolenBases: number;
    avg: string;
    obp: string;
    slg: string;
    ops: string;
  };
  pitching?: {
    gamesPlayed: number;
    gamesStarted: number;
    wins: number;
    losses: number;
    era: string;
    inningsPitched: string;
    strikeOuts: number;
    walks: number;
    hits: number;
    saves: number;
    whip: string;
  };
  fielding?: {
    gamesPlayed: number;
    gamesStarted: number;
    assists: number;
    putOuts: number;
    errors: number;
    fielding: string;
  };
}

interface SeasonStats {
  season: string;
  team: string;
  stats: any;
}

const PlayerStats = () => {
  const { playerId } = useParams<{ playerId: string }>();
  const navigate = useNavigate();
  const [playerInfo, setPlayerInfo] = useState<PlayerInfo | null>(null);
  const [careerStats, setCareerStats] = useState<CareerStats | null>(null);
  const [seasonStats, setSeasonStats] = useState<SeasonStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("career");

  useEffect(() => {
    const fetchPlayerData = async () => {
      if (!playerId) return;
      
      setLoading(true);
      setError(null);

      try {
        const { data, error: fetchError } = await supabase.functions.invoke("fetch-player-stats", {
          body: { playerId: parseInt(playerId) }
        });

        if (fetchError) throw fetchError;

        if (data) {
          setPlayerInfo(data.playerInfo);
          setCareerStats(data.careerStats);
          setSeasonStats(data.seasonStats || []);
        }
      } catch (err) {
        console.error("Error fetching player stats:", err);
        setError("Failed to load player stats. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchPlayerData();
  }, [playerId]);

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric"
    });
  };

  const getPositionColor = (posType: string) => {
    switch (posType?.toLowerCase()) {
      case "pitcher":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "catcher":
        return "bg-purple-500/20 text-purple-400 border-purple-500/30";
      case "infielder":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "outfielder":
        return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const isPitcher = playerInfo?.primaryPosition?.type?.toLowerCase() === "pitcher";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEOHead
        title={playerInfo ? `${playerInfo.fullName} Career Stats` : "Player Stats"}
        description={playerInfo ? `View ${playerInfo.fullName}'s career statistics, including hitting, pitching, and fielding stats on MetsXMFanZone.` : "View player career statistics."}
        keywords={playerInfo ? `${playerInfo.fullName} stats, Mets player stats, ${playerInfo.fullName} career, MLB stats` : "Mets player stats, MLB stats"}
        canonical={`https://metsxmfanzone.com/player/${encodeURIComponent(playerId || "")}`}
        ogImage={playerId ? `https://img.mlbstatic.com/mlb-photos/image/upload/w_1200,h_630,c_fill,g_auto,q_auto:best/v1/people/${encodeURIComponent(playerId)}/headshot/67/current` : "/share/mets-roster.jpg"}
        ogImageAlt={playerInfo ? `${playerInfo.fullName} — New York Mets` : "New York Mets player stats"}
      />

      <Navigation />

      <main className="flex-1 pt-12">
        {/* Back Button */}
        <div className="container mx-auto px-4 py-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/mets-roster")}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Roster
          </Button>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-start gap-6">
                    <Skeleton className="w-32 h-32 rounded-full" />
                    <div className="flex-1 space-y-3">
                      <Skeleton className="h-8 w-64" />
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-5 w-48" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <div className="mt-6 grid gap-4">
                <Skeleton className="h-64 w-full" />
              </div>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="container mx-auto px-4">
            <Card className="max-w-4xl mx-auto border-destructive">
              <CardContent className="py-12 text-center">
                <p className="text-destructive mb-4">{error}</p>
                <Button onClick={() => navigate("/mets-roster")}>
                  Return to Roster
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Player Info */}
        {playerInfo && !loading && (
          <div className="container mx-auto px-4 pb-12">
            <div className="max-w-4xl mx-auto space-y-6">
              {/* Player Header Card */}
              <Card className="overflow-hidden">
                <div className="bg-gradient-to-r from-primary/20 to-primary/5 p-6">
                  <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                    {/* Player Photo */}
                    <div className="relative w-32 h-32 rounded-full overflow-hidden bg-gradient-to-br from-primary/30 to-primary/10 border-4 border-primary/30 flex-shrink-0">
                      <img
                        src={`https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_426,q_auto:best/v1/people/${playerInfo.id}/headshot/67/current`}
                        alt={playerInfo.fullName}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                      <div className="absolute -bottom-1 -right-1 w-10 h-10 rounded-full bg-primary flex items-center justify-center border-3 border-background">
                        <span className="text-sm font-bold text-primary-foreground">
                          {playerInfo.jerseyNumber || "—"}
                        </span>
                      </div>
                    </div>

                    {/* Player Details */}
                    <div className="flex-1 text-center sm:text-left">
                      <h1 className="text-3xl sm:text-4xl font-bold text-foreground">
                        {playerInfo.fullName}
                      </h1>
                      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-2">
                        <Badge className={getPositionColor(playerInfo.primaryPosition?.type)}>
                          {playerInfo.primaryPosition?.name}
                        </Badge>
                        {playerInfo.active && (
                          <Badge variant="outline" className="text-green-500 border-green-500/30">
                            Active
                          </Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Calendar className="w-4 h-4" />
                          <span>Age: {playerInfo.currentAge}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Ruler className="w-4 h-4" />
                          <span>{playerInfo.height}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Scale className="w-4 h-4" />
                          <span>{playerInfo.weight} lbs</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <MapPin className="w-4 h-4" />
                          <span>{playerInfo.birthCity}, {playerInfo.birthCountry}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-4 mt-4 text-sm text-muted-foreground">
                        <span>Bats: <strong className="text-foreground">{playerInfo.batSide?.description}</strong></span>
                        <span>Throws: <strong className="text-foreground">{playerInfo.pitchHand?.description}</strong></span>
                        {playerInfo.mlbDebutDate && (
                          <span>MLB Debut: <strong className="text-foreground">{formatDate(playerInfo.mlbDebutDate)}</strong></span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Stats Tabs */}
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="career">Career Stats</TabsTrigger>
                  <TabsTrigger value="seasons">Season by Season</TabsTrigger>
                </TabsList>

                <TabsContent value="career" className="mt-4">
                  {careerStats ? (
                    <div className="grid gap-4">
                      {/* Hitting Stats */}
                      {careerStats.hitting && (
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-lg">Career Hitting</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
                              <StatBox label="G" value={careerStats.hitting.gamesPlayed} />
                              <StatBox label="AB" value={careerStats.hitting.atBats} />
                              <StatBox label="H" value={careerStats.hitting.hits} />
                              <StatBox label="HR" value={careerStats.hitting.homeRuns} />
                              <StatBox label="RBI" value={careerStats.hitting.rbi} />
                              <StatBox label="R" value={careerStats.hitting.runs} />
                              <StatBox label="2B" value={careerStats.hitting.doubles} />
                              <StatBox label="3B" value={careerStats.hitting.triples} />
                              <StatBox label="SB" value={careerStats.hitting.stolenBases} />
                              <StatBox label="AVG" value={careerStats.hitting.avg} highlight />
                              <StatBox label="OBP" value={careerStats.hitting.obp} highlight />
                              <StatBox label="OPS" value={careerStats.hitting.ops} highlight />
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* Pitching Stats */}
                      {careerStats.pitching && isPitcher && (
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-lg">Career Pitching</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
                              <StatBox label="G" value={careerStats.pitching.gamesPlayed} />
                              <StatBox label="GS" value={careerStats.pitching.gamesStarted} />
                              <StatBox label="W" value={careerStats.pitching.wins} />
                              <StatBox label="L" value={careerStats.pitching.losses} />
                              <StatBox label="SV" value={careerStats.pitching.saves} />
                              <StatBox label="ERA" value={careerStats.pitching.era} highlight />
                              <StatBox label="IP" value={careerStats.pitching.inningsPitched} />
                              <StatBox label="K" value={careerStats.pitching.strikeOuts} />
                              <StatBox label="BB" value={careerStats.pitching.walks} />
                              <StatBox label="H" value={careerStats.pitching.hits} />
                              <StatBox label="WHIP" value={careerStats.pitching.whip} highlight />
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* Fielding Stats */}
                      {careerStats.fielding && (
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-lg">Career Fielding</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
                              <StatBox label="G" value={careerStats.fielding.gamesPlayed} />
                              <StatBox label="GS" value={careerStats.fielding.gamesStarted} />
                              <StatBox label="PO" value={careerStats.fielding.putOuts} />
                              <StatBox label="A" value={careerStats.fielding.assists} />
                              <StatBox label="E" value={careerStats.fielding.errors} />
                              <StatBox label="FLD%" value={careerStats.fielding.fielding} highlight />
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  ) : (
                    <Card>
                      <CardContent className="py-12 text-center">
                        <User className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">No career stats available.</p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="seasons" className="mt-4">
                  {seasonStats.length > 0 ? (
                    <Card>
                      <CardContent className="p-0">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-muted/50">
                              <tr>
                                <th className="text-left p-3 font-medium">Season</th>
                                <th className="text-left p-3 font-medium">Team</th>
                                <th className="text-center p-3 font-medium">G</th>
                                {isPitcher ? (
                                  <>
                                    <th className="text-center p-3 font-medium">W</th>
                                    <th className="text-center p-3 font-medium">L</th>
                                    <th className="text-center p-3 font-medium">ERA</th>
                                    <th className="text-center p-3 font-medium">IP</th>
                                    <th className="text-center p-3 font-medium">K</th>
                                    <th className="text-center p-3 font-medium">WHIP</th>
                                  </>
                                ) : (
                                  <>
                                    <th className="text-center p-3 font-medium">AB</th>
                                    <th className="text-center p-3 font-medium">H</th>
                                    <th className="text-center p-3 font-medium">HR</th>
                                    <th className="text-center p-3 font-medium">RBI</th>
                                    <th className="text-center p-3 font-medium">AVG</th>
                                    <th className="text-center p-3 font-medium">OPS</th>
                                  </>
                                )}
                              </tr>
                            </thead>
                            <tbody>
                              {seasonStats.map((season, idx) => (
                                <tr key={idx} className="border-t border-border hover:bg-muted/30">
                                  <td className="p-3 font-medium">{season.season}</td>
                                  <td className="p-3">{season.team}</td>
                                  <td className="text-center p-3">{season.stats.gamesPlayed}</td>
                                  {isPitcher ? (
                                    <>
                                      <td className="text-center p-3">{season.stats.wins}</td>
                                      <td className="text-center p-3">{season.stats.losses}</td>
                                      <td className="text-center p-3">{season.stats.era}</td>
                                      <td className="text-center p-3">{season.stats.inningsPitched}</td>
                                      <td className="text-center p-3">{season.stats.strikeOuts}</td>
                                      <td className="text-center p-3">{season.stats.whip}</td>
                                    </>
                                  ) : (
                                    <>
                                      <td className="text-center p-3">{season.stats.atBats}</td>
                                      <td className="text-center p-3">{season.stats.hits}</td>
                                      <td className="text-center p-3">{season.stats.homeRuns}</td>
                                      <td className="text-center p-3">{season.stats.rbi}</td>
                                      <td className="text-center p-3">{season.stats.avg}</td>
                                      <td className="text-center p-3">{season.stats.ops}</td>
                                    </>
                                  )}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <CardContent className="py-12 text-center">
                        <User className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">No season stats available.</p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

// Stat Box Component
const StatBox = ({ label, value, highlight = false }: { label: string; value: string | number; highlight?: boolean }) => (
  <div className={`text-center p-3 rounded-lg ${highlight ? "bg-primary/10 border border-primary/20" : "bg-muted/30"}`}>
    <p className="text-xs text-muted-foreground mb-1">{label}</p>
    <p className={`text-lg font-bold ${highlight ? "text-primary" : "text-foreground"}`}>
      {value ?? "—"}
    </p>
  </div>
);

export default PlayerStats;
