import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { RefreshCw, Star, Flame, Snowflake, AlertTriangle, Users, Calendar, Plus, Trash2, PenLine, Link2, TrendingUp } from "lucide-react";
import { AdminPage, AdminPageHeader, AdminEmpty } from "@/components/admin/AdminUI";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";

const PITCHER_POSITIONS = new Set(["P", "SP", "RP", "CL"]);

// Fallback list used only if the MLB API is unreachable. The live 40-man
// roster from MLB Stats API is the source of truth so newly added players
// appear here automatically.
const FALLBACK_STAR_PLAYERS: { id: number; name: string; isPitcher?: boolean }[] = [
  { id: 596019, name: "Francisco Lindor" },
  { id: 665742, name: "Juan Soto" },
  { id: 668901, name: "Mark Vientos" },
  { id: 682626, name: "Francisco Alvarez" },
  { id: 673540, name: "Kodai Senga", isPitcher: true },
  { id: 640455, name: "Sean Manaea", isPitcher: true },
  { id: 656849, name: "David Peterson", isPitcher: true },
  { id: 605280, name: "Clay Holmes", isPitcher: true },
];

interface Prediction {
  id: string;
  player_name: string;
  player_id: number | null;
  player_image_url: string | null;
  status: string;
  description: string;
  prediction_date: string;
  created_at: string;
  bet_amount: string | null;
  payout: string | null;
}

const DEFAULT_MANUAL = {
  player_name: "",
  player_id: "",
  is_pitcher: false,
  status: "hot",
  description: "",
  predicted_hr: 0,
  predicted_rbis: 0,
  predicted_runs: 0,
  predicted_sb: 0,
  predicted_strikeouts: 0,
  predicted_innings_pitched: 0,
  predicted_walks: 0,
  predicted_saves: 0,
  predicted_win_loss: "",
  confidence: 75,
  bet_amount: "",
  payout: "",
};

export default function PredictionsManagement() {
  const queryClient = useQueryClient();
  const [selectedStarPlayers, setSelectedStarPlayers] = useState<number[]>([]);
  const [forceRegenerate, setForceRegenerate] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [manual, setManual] = useState(DEFAULT_MANUAL);
  const [isSyncingLineup, setIsSyncingLineup] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBet, setEditBet] = useState("");
  const [editPayout, setEditPayout] = useState("");

  // Live 40-man roster from MLB Stats API — keeps the star players list in
  // sync with the main roster page so newly added players show up here.
  const { data: STAR_PLAYERS = FALLBACK_STAR_PLAYERS } = useQuery({
    queryKey: ["mets-40man-roster-star-players"],
    queryFn: async () => {
      try {
        const res = await fetch(
          "https://statsapi.mlb.com/api/v1/teams/121/roster?rosterType=40Man"
        );
        if (!res.ok) throw new Error("MLB API error");
        const json = await res.json();
        const players = (json.roster ?? [])
          .map((r: any) => ({
            id: r.person?.id as number,
            name: r.person?.fullName as string,
            isPitcher: PITCHER_POSITIONS.has(r.position?.abbreviation ?? ""),
          }))
          .filter((p: any) => p.id && p.name);
        return players.length > 0 ? players : FALLBACK_STAR_PLAYERS;
      } catch (e) {
        console.warn("Falling back to static star players list:", e);
        return FALLBACK_STAR_PLAYERS;
      }
    },
    staleTime: 1000 * 60 * 30,
  });

  const updateBetPayoutMutation = useMutation({
    mutationFn: async ({ id, bet_amount, payout }: { id: string; bet_amount: string; payout: string }) => {
      const { error } = await supabase
        .from("daily_player_predictions")
        .update({ bet_amount: bet_amount || null, payout: payout || null } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-predictions"] });
      queryClient.invalidateQueries({ queryKey: ["daily-predictions"] });
      toast.success("Bet/Payout updated!");
      setEditingId(null);
    },
    onError: () => toast.error("Failed to update"),
  });

  // Fetch today's lineup card to check sync status
  const { data: todayLineup } = useQuery({
    queryKey: ["today-lineup-card"],
    queryFn: async () => {
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
      const { data, error } = await supabase
        .from("lineup_cards")
        .select("*")
        .eq("game_date", today)
        .eq("published", true)
        .single();
      if (error) return null;
      return data;
    },
  });

  const { data: predictions, isLoading } = useQuery({
    queryKey: ["admin-predictions"],
    queryFn: async () => {
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
      const { data, error } = await supabase
        .from("daily_player_predictions")
        .select("*")
        .eq("prediction_date", today)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Prediction[];
    },
  });

  const { data: history } = useQuery({
    queryKey: ["predictions-history"],
    queryFn: async () => {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const { data, error } = await supabase
        .from("daily_player_predictions")
        .select("prediction_date")
        .gte("prediction_date", weekAgo.toISOString().split("T")[0])
        .order("prediction_date", { ascending: false });
      if (error) throw error;
      const grouped = data.reduce((acc: Record<string, number>, item) => {
        acc[item.prediction_date] = (acc[item.prediction_date] || 0) + 1;
        return acc;
      }, {});
      return Object.entries(grouped).map(([date, count]) => ({ date, count }));
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: async () => {
      if (forceRegenerate && predictions && predictions.length > 0) {
        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
        const { error: deleteError } = await supabase
          .from("daily_player_predictions")
          .delete()
          .eq("prediction_date", today);
        if (deleteError) throw deleteError;
      }
      const { data, error } = await supabase.functions.invoke("generate-daily-predictions", {
        body: { forceStarPlayers: selectedStarPlayers.length > 0 ? selectedStarPlayers : undefined },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-predictions"] });
      queryClient.invalidateQueries({ queryKey: ["predictions-history"] });
      queryClient.invalidateQueries({ queryKey: ["daily-predictions"] });
      toast.success(data.message || "Predictions regenerated successfully!");
    },
    onError: (error) => {
      console.error("Regeneration error:", error);
      toast.error("AI generation failed — Manual Entry form has been opened for you.");
      setShowManualForm(true);
    },
  });

  const manualInsertMutation = useMutation({
    mutationFn: async () => {
      if (!manual.player_name.trim() || !manual.description.trim()) {
        throw new Error("Player name and description are required");
      }
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
      const starPlayer = STAR_PLAYERS.find(p => p.name === manual.player_name);
      const playerId = manual.player_id ? parseInt(manual.player_id) : (starPlayer?.id || null);
      const imageUrl = playerId
        ? `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${playerId}/headshot/67/current`
        : null;

      const { error } = await supabase.from("daily_player_predictions").insert({
        player_name: manual.player_name,
        player_id: playerId,
        player_image_url: imageUrl,
        is_pitcher: manual.is_pitcher,
        status: manual.status,
        description: manual.description,
        prediction_date: today,
        predicted_hr: manual.is_pitcher ? 0 : manual.predicted_hr,
        predicted_rbis: manual.is_pitcher ? 0 : manual.predicted_rbis,
        predicted_runs: manual.is_pitcher ? 0 : manual.predicted_runs,
        predicted_sb: manual.is_pitcher ? 0 : manual.predicted_sb,
        predicted_strikeouts: manual.is_pitcher ? manual.predicted_strikeouts : 0,
        predicted_innings_pitched: manual.is_pitcher ? manual.predicted_innings_pitched : 0,
        predicted_walks: manual.is_pitcher ? manual.predicted_walks : 0,
        predicted_saves: manual.is_pitcher ? manual.predicted_saves : 0,
        predicted_win_loss: manual.is_pitcher ? manual.predicted_win_loss : null,
        confidence: manual.confidence,
        bet_amount: manual.bet_amount || null,
        payout: manual.payout || null,
      } as any);
      if (error) {
        console.error("[Manual Prediction Insert Error]", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-predictions"] });
      queryClient.invalidateQueries({ queryKey: ["daily-predictions"] });
      queryClient.invalidateQueries({ queryKey: ["daily-player-predictions"] });
      toast.success("Prediction added manually!");
      setManual(DEFAULT_MANUAL);
      setShowManualForm(false);
    },
    onError: (error: any) => {
      console.error("[Manual Prediction Mutation Error]", error);
      const msg = error?.message || error?.details || error?.hint || "Failed to add prediction";
      toast.error(msg, { duration: 8000 });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("daily_player_predictions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-predictions"] });
      queryClient.invalidateQueries({ queryKey: ["daily-predictions"] });
      toast.success("Prediction deleted");
    },
    onError: () => toast.error("Failed to delete prediction"),
  });

  const toggleStarPlayer = (playerId: number) => {
    setSelectedStarPlayers((prev) =>
      prev.includes(playerId) ? prev.filter((id) => id !== playerId) : prev.length < 6 ? [...prev, playerId] : prev
    );
  };

  const selectStarForManual = (playerName: string) => {
    const player = STAR_PLAYERS.find(p => p.name === playerName);
    if (player) {
      setManual(prev => ({ ...prev, player_name: player.name, player_id: String(player.id) }));
    }
  };

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

  return (
    <AdminPage>
      <AdminPageHeader
        icon={TrendingUp}
        title="Anthony's Predictions"
        count={predictions?.length}
        countLabel="today"
        description="Manage daily player predictions — use AI or add manually"
      />

      {/* Manual Entry Card */}
      <Card className="border-primary/30">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <PenLine className="h-5 w-5 text-primary" />
                Manual Prediction Entry
              </CardTitle>
              <CardDescription>Add predictions without using AI credits</CardDescription>
            </div>
            <Button variant={showManualForm ? "secondary" : "default"} size="sm" onClick={() => setShowManualForm(!showManualForm)}>
              {showManualForm ? "Hide Form" : <><Plus className="h-4 w-4 mr-1" /> Add Manually</>}
            </Button>
          </div>
        </CardHeader>
        {showManualForm && (
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Quick Select Player</Label>
              <div className="flex flex-wrap gap-1.5">
                {STAR_PLAYERS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => selectStarForManual(p.name)}
                    className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                      manual.player_name === p.name ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Player Name *</Label>
                <Input value={manual.player_name} onChange={e => setManual(p => ({ ...p, player_name: e.target.value }))} placeholder="e.g. Francisco Lindor" />
              </div>
              <div>
                <Label>MLB Player ID (optional)</Label>
                <Input value={manual.player_id} onChange={e => setManual(p => ({ ...p, player_id: e.target.value }))} placeholder="e.g. 596019" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label>Status</Label>
                <Select value={manual.status} onValueChange={v => setManual(p => ({ ...p, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hot">🔥 Hot</SelectItem>
                    <SelectItem value="cold">❄️ Cold</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Type</Label>
                <Select value={manual.is_pitcher ? "pitcher" : "hitter"} onValueChange={v => setManual(p => ({ ...p, is_pitcher: v === "pitcher" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hitter">Hitter</SelectItem>
                    <SelectItem value="pitcher">Pitcher</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Confidence %</Label>
                <Input type="number" min={0} max={100} value={manual.confidence} onChange={e => setManual(p => ({ ...p, confidence: parseInt(e.target.value) || 0 }))} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Bet Amount (e.g. $10)</Label>
                <Input value={manual.bet_amount} onChange={e => setManual(p => ({ ...p, bet_amount: e.target.value }))} placeholder="e.g. $10" />
              </div>
              <div>
                <Label>Payout (e.g. $150)</Label>
                <Input value={manual.payout} onChange={e => setManual(p => ({ ...p, payout: e.target.value }))} placeholder="e.g. $150" />
              </div>
            </div>

            <div>
              <Label>Description / Parlay Line *</Label>
              <Textarea value={manual.description} onChange={e => setManual(p => ({ ...p, description: e.target.value }))} placeholder="e.g. Lindor goes 2-for-4 with a homer and 3 RBIs tonight" rows={2} />
            </div>

            {!manual.is_pitcher ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div><Label className="text-xs">HR</Label><Input type="number" min={0} value={manual.predicted_hr} onChange={e => setManual(p => ({ ...p, predicted_hr: parseInt(e.target.value) || 0 }))} /></div>
                <div><Label className="text-xs">RBI</Label><Input type="number" min={0} value={manual.predicted_rbis} onChange={e => setManual(p => ({ ...p, predicted_rbis: parseInt(e.target.value) || 0 }))} /></div>
                <div><Label className="text-xs">Runs</Label><Input type="number" min={0} value={manual.predicted_runs} onChange={e => setManual(p => ({ ...p, predicted_runs: parseInt(e.target.value) || 0 }))} /></div>
                <div><Label className="text-xs">SB</Label><Input type="number" min={0} value={manual.predicted_sb} onChange={e => setManual(p => ({ ...p, predicted_sb: parseInt(e.target.value) || 0 }))} /></div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div><Label className="text-xs">K</Label><Input type="number" min={0} value={manual.predicted_strikeouts} onChange={e => setManual(p => ({ ...p, predicted_strikeouts: parseInt(e.target.value) || 0 }))} /></div>
                <div><Label className="text-xs">IP</Label><Input type="number" min={0} step={0.1} value={manual.predicted_innings_pitched} onChange={e => setManual(p => ({ ...p, predicted_innings_pitched: parseFloat(e.target.value) || 0 }))} /></div>
                <div><Label className="text-xs">BB</Label><Input type="number" min={0} value={manual.predicted_walks} onChange={e => setManual(p => ({ ...p, predicted_walks: parseInt(e.target.value) || 0 }))} /></div>
                <div><Label className="text-xs">SV</Label><Input type="number" min={0} value={manual.predicted_saves} onChange={e => setManual(p => ({ ...p, predicted_saves: parseInt(e.target.value) || 0 }))} /></div>
                <div><Label className="text-xs">W/L</Label><Input value={manual.predicted_win_loss} onChange={e => setManual(p => ({ ...p, predicted_win_loss: e.target.value }))} placeholder="W" /></div>
              </div>
            )}

            <Button onClick={() => manualInsertMutation.mutate()} disabled={manualInsertMutation.isPending} className="w-full">
              {manualInsertMutation.isPending ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Saving...</> : <><Plus className="h-4 w-4 mr-2" /> Add Prediction</>}
            </Button>
          </CardContent>
        )}
      </Card>

      {/* Sync with Lineup Override */}
      <Card className="border-orange-500/30 bg-gradient-to-r from-orange-500/5 to-transparent">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5 text-orange-500" />
                Sync with Today's Lineup
              </CardTitle>
              <CardDescription>
                {todayLineup 
                  ? `Lineup found: vs ${todayLineup.opponent} — ${(todayLineup.lineup_data as any[])?.length || 0} players`
                  : "No lineup card posted for today yet"
                }
              </CardDescription>
            </div>
            {todayLineup && (
              <Badge variant="outline" className="border-orange-500/30 text-orange-500">
                {todayLineup.game_time}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-4">
            This will delete all existing predictions for today and regenerate them using the players from today's lineup card. Ensures predictions match the actual game lineup.
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                className="w-full bg-orange-500 hover:bg-orange-600 text-white" 
                disabled={!todayLineup || isSyncingLineup || (todayLineup?.lineup_data as any[])?.length === 0}
              >
                {isSyncingLineup ? (
                  <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Syncing with Lineup...</>
                ) : (
                  <><Link2 className="h-4 w-4 mr-2" /> Override & Sync Predictions with Lineup</>
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Sync Predictions with Lineup?</AlertDialogTitle>
                <AlertDialogDescription className="space-y-2">
                  <p>This will:</p>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    <li>Delete all existing predictions for today</li>
                    <li>Generate new predictions based on today's lineup card ({(todayLineup?.lineup_data as any[])?.length || 0} players + pitcher)</li>
                    <li>Use AI credits for generation</li>
                  </ul>
                  {todayLineup && <p className="text-primary font-medium mt-2">Game: vs {todayLineup.opponent} at {todayLineup.game_time}</p>}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={async () => {
                    setIsSyncingLineup(true);
                    try {
                      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
                      
                      // Delete existing predictions
                      const { error: deleteError } = await supabase
                        .from("daily_player_predictions")
                        .delete()
                        .eq("prediction_date", today);
                      if (deleteError) throw deleteError;

                      // Extract lineup player data
                      const lineupData = todayLineup?.lineup_data as any[] || [];
                      const lineupPlayerIds: number[] = [];
                      const lineupPlayers: Array<{ name: string; id: number; position: string }> = [];

                      lineupData.forEach((p: any) => {
                        const match = p.imageUrl?.match(/\/people\/(\d+)\//);
                        if (match) {
                          const playerId = parseInt(match[1]);
                          lineupPlayerIds.push(playerId);
                          lineupPlayers.push({ name: p.name, id: playerId, position: p.fieldPosition || "DH" });
                        }
                      });

                      // Include starting pitcher
                      const pitcher = todayLineup?.starting_pitcher as any;
                      if (pitcher?.name) {
                        const starPitcher = STAR_PLAYERS.find(sp => sp.name === pitcher.name);
                        if (starPitcher) {
                          lineupPlayerIds.push(starPitcher.id);
                          lineupPlayers.push({ name: pitcher.name, id: starPitcher.id, position: "SP" });
                        }
                      }

                      // Call generate-daily-predictions with lineup data
                      const { data, error } = await supabase.functions.invoke("generate-daily-predictions", {
                        body: {
                          triggeredBy: "lineup-sync-override",
                          lineupPlayerIds,
                          lineupPlayers,
                          opponent: todayLineup?.opponent,
                          gameTime: todayLineup?.game_time,
                          location: todayLineup?.location
                        },
                      });
                      if (error) throw error;

                      queryClient.invalidateQueries({ queryKey: ["admin-predictions"] });
                      queryClient.invalidateQueries({ queryKey: ["daily-player-predictions"] });
                      queryClient.invalidateQueries({ queryKey: ["predictions-history"] });
                      toast.success(`Predictions synced with lineup! ${data?.count || 6} players generated.`);
                    } catch (err: any) {
                      console.error("Lineup sync error:", err);
                      toast.error("AI sync failed — Manual Entry form has been opened for you.");
                      setShowManualForm(true);
                    } finally {
                      setIsSyncingLineup(false);
                    }
                  }} 
                  className="bg-orange-500 hover:bg-orange-600"
                >
                  Confirm & Sync
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      {/* Current Predictions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" /> Today's Predictions</CardTitle>
              <CardDescription>{format(new Date(), "EEEE, MMMM d, yyyy")}</CardDescription>
            </div>
            <Badge variant={predictions && predictions.length > 0 ? "default" : "secondary"}>{predictions?.length || 0} Players</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : predictions && predictions.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {predictions.map((pred) => (
                <div key={pred.id} className="p-3 rounded-lg bg-muted/50 border group space-y-2">
                  <div className="flex items-center gap-3">
                    {pred.player_image_url ? (
                      <img src={pred.player_image_url} alt={pred.player_name} className="w-12 h-12 rounded-full object-cover bg-background" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                        <span className="text-lg font-bold text-primary">{pred.player_name.charAt(0)}</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{pred.player_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{pred.description}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge variant={pred.status === "hot" ? "destructive" : "secondary"} className="flex items-center gap-1">
                        {pred.status === "hot" ? <Flame className="h-3 w-3" /> : <Snowflake className="h-3 w-3" />}
                        {pred.status.toUpperCase()}
                      </Badge>
                      <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => deleteMutation.mutate(pred.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  {/* Bet Amount & Payout — Always Visible */}
                  <div className="mt-3 p-3 rounded-lg bg-primary/5 border-2 border-primary/20">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-primary">💰 Betting Info</span>
                      {editingId === pred.id ? (
                        <div className="flex gap-1">
                          <Button size="sm" className="h-6 text-xs px-3 bg-primary hover:bg-primary/90" onClick={() => updateBetPayoutMutation.mutate({ id: pred.id, bet_amount: editBet, payout: editPayout })} disabled={updateBetPayoutMutation.isPending}>Save</Button>
                          <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => setEditingId(null)}>Cancel</Button>
                        </div>
                      ) : (
                        <Button variant="outline" size="sm" className="h-6 text-xs px-2 border-primary/30 text-primary" onClick={() => { setEditingId(pred.id); setEditBet(pred.bet_amount || ""); setEditPayout(pred.payout || ""); }}>
                          <PenLine className="h-3 w-3 mr-1" /> Edit
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Bet Amount</Label>
                        {editingId === pred.id ? (
                          <Input className="h-9 text-sm font-semibold" placeholder="e.g. $10" value={editBet} onChange={e => setEditBet(e.target.value)} />
                        ) : (
                          <p className="text-base font-bold text-foreground">
                            {pred.bet_amount || <span className="text-muted-foreground/40 font-normal text-sm">Tap Edit to set</span>}
                          </p>
                        )}
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Payout</Label>
                        {editingId === pred.id ? (
                          <Input className="h-9 text-sm font-semibold" placeholder="e.g. $150" value={editPayout} onChange={e => setEditPayout(e.target.value)} />
                        ) : (
                          <p className="text-base font-bold text-green-400">
                            {pred.payout || <span className="text-muted-foreground/40 font-normal text-sm">Tap Edit to set</span>}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No predictions generated for today yet</p>
              <p className="text-xs mt-1">Use the manual form above or AI generation below</p>
              {!showManualForm && (
                <Button variant="outline" className="mt-3" onClick={() => setShowManualForm(true)}>
                  <PenLine className="h-4 w-4 mr-2" /> Open Manual Entry
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Force Star Players */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Star className="h-5 w-5 text-yellow-500" /> Force Star Players (AI)</CardTitle>
          <CardDescription>Select up to 6 players to always include when using AI generation</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {STAR_PLAYERS.map((player) => (
              <div key={player.id} className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${selectedStarPlayers.includes(player.id) ? "bg-primary/10 border-primary" : "hover:bg-muted/50"}`} onClick={() => toggleStarPlayer(player.id)}>
                <Checkbox checked={selectedStarPlayers.includes(player.id)} onCheckedChange={() => toggleStarPlayer(player.id)} disabled={!selectedStarPlayers.includes(player.id) && selectedStarPlayers.length >= 6} />
                <Label className="cursor-pointer text-sm">{player.name}</Label>
              </div>
            ))}
          </div>
          {selectedStarPlayers.length > 0 && <p className="text-sm text-muted-foreground mt-3">{selectedStarPlayers.length} of 6 star players selected</p>}
        </CardContent>
      </Card>

      {/* AI Regenerate */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><RefreshCw className="h-5 w-5" /> AI Generate Predictions</CardTitle>
          <CardDescription>Uses AI credits — if depleted, use the manual form above instead</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {predictions && predictions.length > 0 && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">Predictions already exist</p>
                <p className="text-xs text-muted-foreground">Enable "Force Regenerate" to delete and recreate</p>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="force-regen" checked={forceRegenerate} onCheckedChange={(checked) => setForceRegenerate(checked as boolean)} />
                <Label htmlFor="force-regen" className="text-sm cursor-pointer">Force Regenerate</Label>
              </div>
            </div>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button className="w-full" disabled={regenerateMutation.isPending || (predictions && predictions.length > 0 && !forceRegenerate)}>
                {regenerateMutation.isPending ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Generating...</> : <><RefreshCw className="h-4 w-4 mr-2" /> AI Generate Predictions</>}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Regenerate Predictions?</AlertDialogTitle>
                <AlertDialogDescription className="space-y-2">
                  <p>This will use AI credits to generate predictions.</p>
                  {selectedStarPlayers.length > 0 && <p className="text-primary">⭐ {selectedStarPlayers.length} star player(s) will be forced.</p>}
                  {forceRegenerate && predictions && predictions.length > 0 && <p className="text-yellow-500">⚠️ Will delete existing {predictions.length} predictions.</p>}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => regenerateMutation.mutate()} className="bg-primary">Confirm & Generate</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      {history && history.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Prediction History (Last 7 Days)</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {history.map((item) => (
                <Badge key={item.date} variant={item.date === today ? "default" : "secondary"} className="px-3 py-1">
                  {format(new Date(item.date + "T12:00:00"), "MMM d")} - {item.count} players
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </AdminPage>
  );
}
