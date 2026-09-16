import { useAutoLineupFetch } from "@/hooks/useAutoLineupFetch";
import { useState, useEffect } from "react";
import SEOHead from "@/components/SEOHead";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, Calendar, Users, ChevronDown, ChevronUp } from "lucide-react";
// Auto lineup fetch removed to reduce Cloud load — triggered by admin instead

interface LineupPlayer {
  position: number;
  name: string;
  fieldPosition: string;
  imageUrl?: string;
  jerseyNumber?: string | number;
  bats?: string;
  throws?: string;
  bt?: string;
}

interface PlayerPrediction {
  id: string;
  player_name: string;
  player_id: number | null;
  status: "hot" | "cold" | string;
  description: string;
  is_pitcher: boolean | null;
  predicted_hr: number | null;
  predicted_rbis: number | null;
  predicted_runs: number | null;
  predicted_sb: number | null;
  predicted_strikeouts: number | null;
  predicted_innings_pitched: number | null;
  predicted_win_loss: string | null;
  confidence: number | null;
}

const normalizeName = (n: string) =>
  (n || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.\-']/g, "")
    .replace(/\s+/g, " ")
    .trim();

interface StartingPitcher {
  name: string;
  hand: string;
  era: string;
  strikeouts: string;
}

interface LineupCard {
  id: string;
  game_date: string;
  game_time: string;
  opponent: string;
  location: string | null;
  lineup_data: LineupPlayer[] | null;
  starting_pitcher: StartingPitcher | null;
  published: boolean;
  notes: string | null;
}

// Historical end-of-2025 lineups (September/October)
const historical2025Lineups = [
{
  id: "hist-2025-sept-28",
  game_date: "2025-09-28",
  game_time: "1:10 PM",
  opponent: "Braves",
  location: "Citi Field",
  lineup_data: [
  { position: 1, name: "Francisco Lindor", fieldPosition: "SS" },
  { position: 2, name: "Juan Soto", fieldPosition: "RF" },
  { position: 3, name: "Mark Vientos", fieldPosition: "3B" },
  { position: 4, name: "Pete Alonso", fieldPosition: "1B" },
  { position: 5, name: "Brandon Nimmo", fieldPosition: "LF" },
  { position: 6, name: "Jesse Winker", fieldPosition: "DH" },
  { position: 7, name: "Francisco Alvarez", fieldPosition: "C" },
  { position: 8, name: "Tyrone Taylor", fieldPosition: "CF" },
  { position: 9, name: "Jose Iglesias", fieldPosition: "2B" }],

  starting_pitcher: { name: "Sean Manaea", hand: "LHP", era: "3.47", strikeouts: "184" },
  published: true,
  notes: "Regular Season Finale 2025"
},
{
  id: "hist-2025-sept-27",
  game_date: "2025-09-27",
  game_time: "7:10 PM",
  opponent: "Braves",
  location: "Citi Field",
  lineup_data: [
  { position: 1, name: "Francisco Lindor", fieldPosition: "SS" },
  { position: 2, name: "Juan Soto", fieldPosition: "RF" },
  { position: 3, name: "Mark Vientos", fieldPosition: "3B" },
  { position: 4, name: "Pete Alonso", fieldPosition: "1B" },
  { position: 5, name: "Brandon Nimmo", fieldPosition: "LF" },
  { position: 6, name: "Francisco Alvarez", fieldPosition: "C" },
  { position: 7, name: "Jesse Winker", fieldPosition: "DH" },
  { position: 8, name: "Harrison Bader", fieldPosition: "CF" },
  { position: 9, name: "Jose Iglesias", fieldPosition: "2B" }],

  starting_pitcher: { name: "Kodai Senga", hand: "RHP", era: "2.90", strikeouts: "52" },
  published: true,
  notes: null
},
{
  id: "hist-2025-sept-26",
  game_date: "2025-09-26",
  game_time: "7:10 PM",
  opponent: "Braves",
  location: "Citi Field",
  lineup_data: [
  { position: 1, name: "Francisco Lindor", fieldPosition: "SS" },
  { position: 2, name: "Juan Soto", fieldPosition: "RF" },
  { position: 3, name: "Mark Vientos", fieldPosition: "3B" },
  { position: 4, name: "Pete Alonso", fieldPosition: "1B" },
  { position: 5, name: "Brandon Nimmo", fieldPosition: "LF" },
  { position: 6, name: "Francisco Alvarez", fieldPosition: "C" },
  { position: 7, name: "Tyrone Taylor", fieldPosition: "CF" },
  { position: 8, name: "Jesse Winker", fieldPosition: "DH" },
  { position: 9, name: "Luisangel Acuña", fieldPosition: "2B" }],

  starting_pitcher: { name: "David Peterson", hand: "LHP", era: "3.08", strikeouts: "143" },
  published: true,
  notes: null
},
{
  id: "hist-2025-sept-25",
  game_date: "2025-09-25",
  game_time: "6:40 PM",
  opponent: "Brewers",
  location: "American Family Field",
  lineup_data: [
  { position: 1, name: "Francisco Lindor", fieldPosition: "SS" },
  { position: 2, name: "Juan Soto", fieldPosition: "RF" },
  { position: 3, name: "Mark Vientos", fieldPosition: "3B" },
  { position: 4, name: "Pete Alonso", fieldPosition: "1B" },
  { position: 5, name: "Brandon Nimmo", fieldPosition: "LF" },
  { position: 6, name: "Francisco Alvarez", fieldPosition: "C" },
  { position: 7, name: "Jesse Winker", fieldPosition: "DH" },
  { position: 8, name: "Harrison Bader", fieldPosition: "CF" },
  { position: 9, name: "Jose Iglesias", fieldPosition: "2B" }],

  starting_pitcher: { name: "Jose Quintana", hand: "LHP", era: "3.75", strikeouts: "140" },
  published: true,
  notes: null
},
{
  id: "hist-2025-sept-24",
  game_date: "2025-09-24",
  game_time: "6:40 PM",
  opponent: "Brewers",
  location: "American Family Field",
  lineup_data: [
  { position: 1, name: "Francisco Lindor", fieldPosition: "SS" },
  { position: 2, name: "Juan Soto", fieldPosition: "RF" },
  { position: 3, name: "Mark Vientos", fieldPosition: "3B" },
  { position: 4, name: "Pete Alonso", fieldPosition: "1B" },
  { position: 5, name: "Brandon Nimmo", fieldPosition: "LF" },
  { position: 6, name: "Francisco Alvarez", fieldPosition: "C" },
  { position: 7, name: "Jesse Winker", fieldPosition: "DH" },
  { position: 8, name: "Tyrone Taylor", fieldPosition: "CF" },
  { position: 9, name: "Luisangel Acuña", fieldPosition: "2B" }],

  starting_pitcher: { name: "Luis Severino", hand: "RHP", era: "3.91", strikeouts: "161" },
  published: true,
  notes: null
}];


// Mets brand colors
const METS_BLUE = "#002D72";
const METS_ORANGE = "#FF5910";
const METS_LOGO = "https://www.mlbstatic.com/team-logos/121.svg";

function StatPod({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-md px-2 py-1.5 min-w-[52px] border"
      style={{
        background: `linear-gradient(135deg, ${METS_BLUE} 0%, #001a4a 100%)`,
        borderColor: `${METS_ORANGE}66`,
        boxShadow: `0 0 12px ${METS_ORANGE}33`,
      }}
    >
      <span className="text-[9px] font-black uppercase tracking-widest text-white/70">{label}</span>
      <span className="text-base font-black text-white leading-none mt-0.5" style={{ textShadow: `0 0 6px ${METS_ORANGE}88` }}>
        {value}
      </span>
    </div>
  );
}

function AnthonyApprovedHeader() {
  return (
    <div
      className="flex items-center gap-2 rounded-t-md px-3 py-1.5"
      style={{ background: `linear-gradient(90deg, ${METS_BLUE} 0%, ${METS_ORANGE} 100%)` }}
    >
      <img src={METS_LOGO} alt="Mets" className="h-5 w-5 drop-shadow" />
      <span className="text-xs sm:text-sm font-black uppercase tracking-[0.2em] text-white">
        Anthony Approved
      </span>
    </div>
  );
}

function PredictionPods({ prediction }: { prediction: PlayerPrediction }) {
  const isPitcher = !!prediction.is_pitcher;
  const pods = isPitcher
    ? [
        { label: "IP", value: prediction.predicted_innings_pitched ?? 0 },
        { label: "ER", value: prediction.predicted_hr ?? 0 },
        { label: "K", value: prediction.predicted_strikeouts ?? 0 },
        { label: "W", value: prediction.predicted_win_loss ?? "—" },
      ]
    : [
        { label: "HR", value: prediction.predicted_hr ?? 0 },
        { label: "RBI", value: prediction.predicted_rbis ?? 0 },
        { label: "Runs", value: prediction.predicted_runs ?? 0 },
        { label: "SB", value: prediction.predicted_sb ?? 0 },
      ];

  return (
    <div className="rounded-md overflow-hidden border" style={{ borderColor: `${METS_ORANGE}55` }}>
      <AnthonyApprovedHeader />
      <div className="p-2.5 space-y-2" style={{ background: "rgba(0,45,114,0.08)" }}>
        <div className="flex flex-wrap gap-1.5 justify-center">
          {pods.map((p) => (
            <StatPod key={p.label} label={p.label} value={p.value} />
          ))}
        </div>
        {prediction.description && (
          <p className="text-xs text-foreground/80 italic text-center px-1">"{prediction.description}"</p>
        )}
        <p className="text-[10px] font-bold uppercase tracking-wider text-center" style={{ color: METS_ORANGE }}>
          4 Leg in game predictions | Today's Parley
        </p>
      </div>
    </div>
  );
}

function LineupCardDisplay({
  lineup,
  isUpcoming = false,
  predictions = [],
}: {
  lineup: LineupCard | typeof historical2025Lineups[0];
  isUpcoming?: boolean;
  predictions?: PlayerPrediction[];
}) {
  const [expanded, setExpanded] = useState(true);
  const gameDate = new Date(lineup.game_date.includes("T") ? lineup.game_date : lineup.game_date + "T12:00:00");
  const dateStr = gameDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  const players = lineup.lineup_data as LineupPlayer[] | null;
  const pitcher = lineup.starting_pitcher as StartingPitcher | null;

  const predByName = new Map<string, PlayerPrediction>();
  predictions.forEach((p) => predByName.set(normalizeName(p.player_name), p));
  const findPrediction = (name: string) => predByName.get(normalizeName(name));

  return (
    <Card className="overflow-hidden border-2" style={{ borderColor: `${METS_BLUE}33` }}>
      <button onClick={() => setExpanded(!expanded)} className="w-full text-left">
        <CardHeader className="pb-3" style={{ background: `linear-gradient(90deg, ${METS_BLUE}1a 0%, ${METS_ORANGE}1a 100%)` }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={METS_LOGO} alt="Mets" className="h-8 w-8" />
              <div className="flex flex-col">
                <CardTitle className="text-lg flex items-center gap-2" style={{ color: METS_BLUE }}>
                  Mets vs {lineup.opponent}
                  {isUpcoming && <Badge className="text-xs" style={{ background: METS_ORANGE, color: "white" }}>Upcoming</Badge>}
                  {lineup.notes && <Badge variant="secondary" className="text-xs">{lineup.notes}</Badge>}
                </CardTitle>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{dateStr} • {lineup.game_time}</span>
                  {lineup.location && <span>• {lineup.location}</span>}
                </div>
                <p className="text-xs font-semibold mt-1" style={{ color: METS_BLUE }}>
                  Manager: Carlos Mendoza
                </p>
              </div>
            </div>
            {expanded ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
          </div>
        </CardHeader>
      </button>

      {expanded && (
        <CardContent className="pt-4 space-y-4">
          {players && players.length > 0 ? (
            <div className="rounded-lg overflow-hidden border" style={{ borderColor: `${METS_BLUE}33` }}>
              <div
                className="grid grid-cols-[40px_50px_1fr_70px_60px] gap-2 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white"
                style={{ background: METS_BLUE }}
              >
                <span className="text-center">Order</span>
                <span className="text-center">Num</span>
                <span>Player</span>
                <span className="text-center">Pos</span>
                <span className="text-center">B/T</span>
              </div>
              <div className="divide-y" style={{ borderColor: `${METS_BLUE}22` }}>
                {players.map((player) => {
                  const pred = findPrediction(player.name);
                  return (
                    <div key={player.position} className="bg-card">
                      <div className="grid grid-cols-[40px_50px_1fr_70px_60px] gap-2 px-3 py-2.5 items-center">
                        <span className="text-base font-black text-center" style={{ color: METS_ORANGE }}>{player.position}</span>
                        <span className="text-sm font-bold text-center text-muted-foreground">
                          {player.jerseyNumber ?? "—"}
                        </span>
                        <div className="flex items-center gap-2 min-w-0">
                          {player.imageUrl && (
                            <img
                              src={player.imageUrl}
                              alt={player.name}
                              className="w-7 h-7 rounded-full object-cover bg-muted flex-shrink-0"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                            />
                          )}
                          <p className="font-semibold truncate text-sm">{player.name}</p>
                        </div>
                        <Badge variant="outline" className="text-[10px] justify-self-center" style={{ borderColor: METS_BLUE, color: METS_BLUE }}>
                          {player.fieldPosition}
                        </Badge>
                        <span className="text-xs font-mono font-bold text-center text-muted-foreground">
                          {player.bt ?? (player.bats && player.throws ? `${player.bats}/${player.throws}` : "—")}
                        </span>
                      </div>
                      {pred && (
                        <div className="px-3 pb-3 pt-1">
                          <PredictionPods prediction={pred} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="bg-muted/30 rounded-lg p-6 text-center">
              <p className="text-muted-foreground">Lineup TBA — typically released 1-2 hours before first pitch</p>
            </div>
          )}

          {pitcher && (() => {
            const pitcherPred = findPrediction(pitcher.name);
            return (
              <div className="rounded-lg p-4 border-2" style={{ borderColor: `${METS_ORANGE}55`, background: `${METS_BLUE}0d` }}>
                <h3 className="font-black text-xs uppercase tracking-[0.2em] mb-2" style={{ color: METS_BLUE }}>
                  Starting Pitcher
                </h3>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <p className="font-bold text-lg" style={{ color: METS_BLUE }}>{pitcher.name}</p>
                  <div className="flex items-center gap-2">
                    <Badge style={{ background: METS_ORANGE, color: "white" }}>{pitcher.hand}</Badge>
                    <span className="text-sm text-muted-foreground font-mono">{pitcher.era} ERA • {pitcher.strikeouts} K</span>
                  </div>
                </div>
                {pitcherPred && (
                  <div className="mt-3">
                    <PredictionPods prediction={pitcherPred} />
                  </div>
                )}
              </div>
            );
          })()}
        </CardContent>
      )}
    </Card>
  );
}

export default function MetsLineupCard() {
  const [upcomingLineups, setUpcomingLineups] = useState<LineupCard[]>([]);
  const [predictions, setPredictions] = useState<PlayerPrediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Keep today's lineup + predictions fresh automatically (throttled)
  useAutoLineupFetch(() => {
    fetchUpcomingLineups();
    fetchPredictions();
  });

  const fetchUpcomingLineups = async () => {
    try {
      const { data, error } = await supabase.
      from("lineup_cards").
      select("*").
      order("game_date", { ascending: false }).
      limit(30);

      if (error) {
        console.error("Error fetching lineups:", error);
        return;
      }

      setUpcomingLineups((data || []) as unknown as LineupCard[]);
    } catch (err) {
      console.error("Failed to fetch lineups:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPredictions = async () => {
    try {
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
      const { data, error } = await supabase
        .from("daily_player_predictions")
        .select("*")
        .eq("prediction_date", today);
      if (error) {
        console.error("Error fetching predictions:", error);
        return;
      }
      setPredictions((data || []) as unknown as PlayerPrediction[]);
    } catch (err) {
      console.error("Failed to fetch predictions:", err);
    }
  };

  useEffect(() => {
    fetchUpcomingLineups();
    fetchPredictions();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await supabase.functions.invoke("fetch-mets-lineup");
      await fetchUpcomingLineups();
    } catch (err) {
      console.error("Refresh failed:", err);
    } finally {
      setRefreshing(false);
    }
  };

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const todayLineup = upcomingLineups.find((l) => l.game_date?.startsWith(today));
  const futureLineups = upcomingLineups.filter((l) => l.game_date > today);
  const pastLineups2026 = upcomingLineups.filter((l) => l.game_date < today);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEOHead
        title="Mets Lineup Cards - 2025 & 2026"
        description="View New York Mets lineup cards from the end of the 2025 season and upcoming 2026 lineups. Updated automatically with live MLB data."
        keywords="Mets lineup today, New York Mets lineup card, Mets starting lineup, Mets batting order"
        canonical="https://www.metsxmfanzone.com/mets-lineup-card"
      />

      <Navigation />

      <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center mb-8 mt-8">
          <h1 className="text-3xl font-bold mb-3 bg-gradient-to-r from-primary to-bl-600 bg-clip-text text-transparent md:text-xl text-centerrange">
            Mets Lineup Cards
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto mb-4">End-of-2025 lineups & upcoming 2026 season lineups

          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="gap-2">

            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing..." : "Refresh Lineup"}
          </Button>
        </div>

        {/* Today's Game Highlight */}
        {todayLineup &&
        <div className="mb-8">
            <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
              🔴 Today's Lineup
            </h2>
            <LineupCardDisplay lineup={todayLineup} isUpcoming predictions={predictions} />
          </div>
        }

        <Tabs defaultValue="2026" className="w-full">
          <TabsList className="w-full grid grid-cols-2 mb-6">
            <TabsTrigger value="2026">2026 Season</TabsTrigger>
            <TabsTrigger value="2025">End of 2025</TabsTrigger>
          </TabsList>

          <TabsContent value="2026" className="space-y-4">
            {loading ?
            <div className="space-y-4">
                {[1, 2, 3].map((i) =>
              <Card key={i} className="animate-pulse">
                    <CardHeader>
                      <div className="h-5 bg-muted rounded w-48" />
                      <div className="h-4 bg-muted rounded w-32 mt-2" />
                    </CardHeader>
                  </Card>
              )}
              </div> :
            upcomingLineups.length === 0 ?
            <Card>
                <CardContent className="py-12 text-center">
                  <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No 2026 Lineup Data Yet</h3>
                  <p className="text-muted-foreground max-w-md mx-auto mb-4">
                    Lineup cards are automatically fetched from MLB on game days. Once the 2026 season begins, lineups will appear here automatically — typically 1-2 hours before first pitch.
                  </p>
                  <div className="bg-muted/50 rounded-lg p-4 max-w-md mx-auto">
                    <p className="text-sm font-medium mb-1">How it works:</p>
                    <ul className="text-sm text-muted-foreground text-left space-y-1">
                      <li>• Lineups are fetched every 30 minutes on game days</li>
                      <li>• Data comes directly from the MLB Stats API</li>
                      <li>• Includes batting order, positions & starting pitcher</li>
                      <li>• Hit "Refresh Lineup" to manually check for updates</li>
                    </ul>
                  </div>
                </CardContent>
              </Card> :

            <>
                {futureLineups.length > 0 &&
              <div>
                    <h3 className="text-lg font-semibold mb-3 text-muted-foreground">Upcoming Games</h3>
                    <div className="space-y-3">
                      {futureLineups.map((lineup) =>
                  <LineupCardDisplay key={lineup.id} lineup={lineup} isUpcoming />
                  )}
                    </div>
                  </div>
              }
                {pastLineups2026.length > 0 &&
              <div className="mt-6">
                    <h3 className="text-lg font-semibold mb-3 text-muted-foreground">Previous 2026 Games</h3>
                    <div className="space-y-3">
                      {pastLineups2026.map((lineup) =>
                  <LineupCardDisplay key={lineup.id} lineup={lineup} />
                  )}
                    </div>
                  </div>
              }
              </>
            }
          </TabsContent>

          <TabsContent value="2025" className="space-y-4">
            <div className="bg-accent/30 border border-accent rounded-lg p-4 mb-4">
              <p className="text-sm">
                <strong>End of 2025 Season</strong> — Final lineups from September 2025. Note: Some players listed (Nimmo, Winker, Iglesias, Acuña) are no longer with the 2026 Mets.
              </p>
            </div>
            <div className="space-y-3">
              {historical2025Lineups.map((lineup) =>
              <LineupCardDisplay key={lineup.id} lineup={lineup} />
              )}
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">
            * Lineup data sourced from MLB Stats API. Subject to change until game time.
          </p>
        </div>
      </main>

      <Footer />
    </div>);

}