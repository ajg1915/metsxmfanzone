import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Flame, Snowflake, TrendingUp, RefreshCw, CheckCircle2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useState } from "react";
import GlassCard from "@/components/GlassCard";
import metsLogo from "@/assets/metsxmfanzone-logo.png";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import PremiumBadge from "@/components/PremiumBadge";
import { Link } from "react-router-dom";

interface PlayerPrediction {
  id: string;
  player_name: string;
  player_id: number | null;
  player_image_url: string | null;
  status: "hot" | "cold";
  description: string;
  prediction_date: string;
  is_pitcher: boolean | null;
  predicted_hr: number | null;
  predicted_rbis: number | null;
  predicted_runs: number | null;
  predicted_sb: number | null;
  predicted_strikeouts: number | null;
  predicted_innings_pitched: number | null;
  predicted_saves: number | null;
  predicted_win_loss: string | null;
  predicted_walks: number | null;
  predicted_walks_allowed: number | null;
  predicted_hr_allowed: number | null;
  confidence: number | null;
}

const PlayersToWatch = ({ lineupGameDate }: { lineupGameDate?: string | null }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const { user } = useAuth();
  const { isPremium, isAdmin } = useSubscription();
  const canViewParlays = isAdmin || isPremium;

  const { data: predictions, isLoading, refetch } = useQuery({
    queryKey: ["daily-player-predictions", lineupGameDate],
    queryFn: async () => {
      // First try today's predictions
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
      const { data: todayData, error: todayError } = await supabase
        .from("daily_player_predictions")
        .select("*")
        .eq("prediction_date", today)
        .order("created_at", { ascending: true })
        .limit(6);
      if (todayError) throw todayError;
      if (todayData && todayData.length > 0) return todayData as PlayerPrediction[];

      // Fallback: show the most recent predictions (from any date)
      const { data: recentData, error: recentError } = await supabase
        .from("daily_player_predictions")
        .select("*")
        .order("prediction_date", { ascending: false })
        .order("created_at", { ascending: true })
        .limit(6);
      if (recentError) throw recentError;
      return (recentData ?? []) as PlayerPrediction[];
    },
    staleTime: 1000 * 60 * 2,
    refetchOnWindowFocus: true,
  });

  const generatePredictions = async () => {
    setIsGenerating(true);
    try {
      const response = await supabase.functions.invoke("generate-daily-predictions");
      if (response.error) throw new Error(response.error.message);
      toast.success("Daily predictions generated!");
      refetch();
    } catch (error) {
      console.error("Error generating predictions:", error);
      toast.error("Failed to generate predictions");
    } finally {
      setIsGenerating(false);
    }
  };

  const noGameToday = !lineupGameDate;
  const shouldGenerate = !noGameToday && !isLoading && (!predictions || predictions.length === 0);

  const isPitcherPlayer = (p: PlayerPrediction) => p.is_pitcher === true;
  const isCloser = (p: PlayerPrediction) => (p.predicted_saves ?? 0) > 0;
  const isStarter = (p: PlayerPrediction) => isPitcherPlayer(p) && !isCloser(p);

  return (
    <section className="py-6 sm:py-12 px-3 sm:px-6 lg:px-8 overflow-hidden w-full box-border">
      <div className="w-full max-w-full mx-auto">
        <GlassCard glow="blue" className="p-3 sm:p-6 md:p-8 lg:p-10 w-full max-w-full border-2 border-primary/30 shadow-[0_0_30px_rgba(var(--primary),0.3)]">
          {/* Section Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3 sm:mb-6 md:mb-8">
            <div className="flex items-center gap-2 sm:gap-3">
              <img src={metsLogo} alt="MetsXMFanZone" className="h-8 w-8 sm:h-12 sm:w-12 object-contain shrink-0" />
              <div>
                <h2 className="text-sm sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary via-orange-400 to-primary bg-clip-text text-transparent">
                  Anthony's Predictions
                </h2>
              {!canViewParlays && <PremiumBadge size="xs" noGlow />}
                <p className="text-[10px] sm:text-sm text-muted-foreground">
                  Daily parlay picks & stat projections
                </p>
              </div>
            </div>
            {predictions && predictions.length > 0 && (
              <div className="text-[9px] sm:text-xs text-muted-foreground bg-card/50 px-2 sm:px-3 py-1 rounded-full w-fit">
                Updated: {new Date().toLocaleDateString()}
              </div>
            )}
          </div>

          {noGameToday && (
            <div className="flex flex-col items-center justify-center py-12 bg-card/30 rounded-xl border border-border/50">
              <TrendingUp className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-foreground font-semibold mb-1">No Game Today</p>
              <p className="text-sm text-muted-foreground">Predictions will return on the next game day.</p>
            </div>
          )}

          {!noGameToday && isLoading && (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 text-primary animate-spin" />
              <span className="ml-3 text-foreground">Loading predictions...</span>
            </div>
          )}

          {shouldGenerate && (
            <div className="flex flex-col items-center justify-center py-12 bg-card/30 rounded-xl border border-border/50">
              <TrendingUp className="w-12 h-12 text-primary mb-4" />
              <p className="text-foreground mb-4 text-center">Predictions not yet available</p>
              <Button onClick={generatePredictions} disabled={isGenerating} className="bg-primary hover:bg-primary/90">
                {isGenerating ? (
                  <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Generating...</>
                ) : (
                  <><TrendingUp className="w-4 h-4 mr-2" />Predictions Coming Soon</>
                )}
              </Button>
            </div>
          )}

          {!noGameToday && predictions && predictions.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {predictions.map((player) => (
                <ParlayCard key={player.id} player={player} isPitcher={isPitcherPlayer(player)} isCloser={isCloser(player)} isStarter={isStarter(player)} canFlip={canViewParlays} />
              ))}
            </div>
          )}

          {!noGameToday && predictions && predictions.length > 0 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span className="text-xs text-primary font-semibold">Anthony Approved</span>
              <span className="text-xs text-muted-foreground ml-2">🎲 For entertainment purposes. Always bet responsibly.</span>
            </div>
          )}
        </GlassCard>
      </div>
    </section>
  );
};

// Individual Parlay Card Component
const ParlayCard = ({ player, isPitcher, isCloser, isStarter, canFlip }: { 
  player: PlayerPrediction; 
  isPitcher: boolean;
  isCloser: boolean;
  isStarter: boolean;
  canFlip: boolean;
}) => {
  const [flipped, setFlipped] = useState(false);
  const roleLabel = isCloser ? "CLOSER" : isStarter ? "STARTER" : "HITTER";

  // Build parlay legs for the back
  const parlayLegs: { label: string; value: string }[] = [];
  if (isPitcher) {
    if (isCloser) {
      if (player.predicted_saves) parlayLegs.push({ label: `${player.predicted_saves}+ Saves`, value: "SV" });
      if (player.predicted_strikeouts) parlayLegs.push({ label: `${player.predicted_strikeouts}+ Strikeouts`, value: "K" });
    } else {
      if (player.predicted_strikeouts) parlayLegs.push({ label: `${player.predicted_strikeouts}+ Strikeouts`, value: "K" });
      if (player.predicted_innings_pitched) parlayLegs.push({ label: `${player.predicted_innings_pitched}+ Innings`, value: "IP" });
      if (player.predicted_win_loss) parlayLegs.push({ label: `Predicted ${player.predicted_win_loss === "W" ? "Win" : "Loss"}`, value: player.predicted_win_loss });
    }
  } else {
    if (player.predicted_hr) parlayLegs.push({ label: `${player.predicted_hr}+ Home Runs`, value: "HR" });
    if (player.predicted_rbis) parlayLegs.push({ label: `${player.predicted_rbis}+ RBIs`, value: "RBI" });
    if (player.predicted_runs) parlayLegs.push({ label: `${player.predicted_runs}+ Runs`, value: "R" });
    if (player.predicted_sb) parlayLegs.push({ label: `${player.predicted_sb}+ Stolen Bases`, value: "SB" });
  }

  return (
    <div
      className="relative h-[340px] cursor-pointer perspective-1000"
      onClick={() => canFlip && setFlipped((f) => !f)}
    >
      {!canFlip && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-2xl bg-background/60 backdrop-blur-sm">
          <Lock className="w-8 h-8 text-secondary mb-2" />
          <span className="text-sm font-bold text-secondary">PRO Only</span>
          <Link to="/pricing" className="text-xs text-primary hover:underline mt-1" onClick={(e) => e.stopPropagation()}>
            Upgrade →
          </Link>
        </div>
      )}
      <div className={`relative w-full h-full transition-transform duration-500 transform-style-3d ${flipped ? "rotate-y-180" : ""}`}>
        {/* FRONT */}
        <div className="absolute inset-0 backface-hidden">
          <div className={`h-full rounded-2xl overflow-hidden border-2 flex flex-col transition-all duration-300 hover:shadow-xl ${
            player.status === "hot" 
              ? "border-orange-500/50 hover:border-orange-500 shadow-orange-500/10" 
              : "border-blue-500/50 hover:border-blue-500 shadow-blue-500/10"
          } bg-gradient-to-br from-background/95 to-card/80`}>
            
            {/* Player Header */}
            <div className={`px-4 py-3 flex items-center gap-3 ${
              player.status === "hot" 
                ? "bg-gradient-to-r from-orange-600/20 to-orange-500/10" 
                : "bg-gradient-to-r from-blue-600/20 to-blue-500/10"
            }`}>
              <div className="relative flex-shrink-0">
                <img
                  src={player.player_image_url || "/placeholder.svg"}
                  alt={player.player_name}
                  className="w-14 h-14 rounded-xl object-cover border-2 border-primary/30"
                  onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg"; }}
                />
                <div className={`absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  player.status === "hot" ? "bg-orange-500 text-white" : "bg-blue-500 text-white"
                }`}>
                  {player.status === "hot" ? "🔥" : "❄️"}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-foreground text-sm sm:text-base truncate">{player.player_name}</h3>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${
                    player.status === "hot" ? "border-orange-500/50 text-orange-400" : "border-blue-500/50 text-blue-400"
                  }`}>
                    {player.status === "hot" ? "HOT" : "COLD"}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/30 text-primary">
                    {roleLabel}
                  </Badge>
                </div>
              </div>
              {isStarter && player.predicted_win_loss && (
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg font-black ${
                  player.predicted_win_loss === "W" 
                    ? "bg-green-500/20 text-green-400 border border-green-500/30" 
                    : "bg-red-500/20 text-red-400 border border-red-500/30"
                }`}>
                  {player.predicted_win_loss}
                </div>
              )}
            </div>

            {/* Stat Line */}
            <div className="px-4 py-3">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 font-medium">
                Today's Projected Line
              </div>
              {isPitcher ? (
                <div className="grid grid-cols-4 gap-1.5">
                  {isCloser ? (
                    <>
                      <StatBox label="SV" value={player.predicted_saves ?? 0} highlight />
                      <StatBox label="K" value={player.predicted_strikeouts ?? 0} />
                      <StatBox label="IP" value={player.predicted_innings_pitched ?? 0} />
                      <StatBox label="BB" value={player.predicted_walks_allowed ?? 0} />
                    </>
                  ) : (
                    <>
                      <StatBox label="K" value={player.predicted_strikeouts ?? 0} highlight />
                      <StatBox label="IP" value={player.predicted_innings_pitched ?? 0} />
                      <StatBox label="BB" value={player.predicted_walks_allowed ?? 0} />
                      <StatBox label="HR" value={player.predicted_hr_allowed ?? 0} />
                    </>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-1.5">
                  <StatBox label="HR" value={player.predicted_hr ?? 0} highlight />
                  <StatBox label="RBI" value={player.predicted_rbis ?? 0} />
                  <StatBox label="R" value={player.predicted_runs ?? 0} />
                  <StatBox label="SB" value={player.predicted_sb ?? 0} />
                </div>
              )}
            </div>

            {/* Confidence Bar */}
            {player.confidence != null && (
              <div className="px-4 pb-3">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                  <span>Confidence</span>
                  <span className="font-bold text-primary">{player.confidence}%</span>
                </div>
                <div className="w-full h-1.5 bg-background/50 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all ${
                      player.status === "hot" 
                        ? "bg-gradient-to-r from-orange-600 to-orange-400" 
                        : "bg-gradient-to-r from-blue-600 to-blue-400"
                    }`}
                    style={{ width: `${player.confidence}%` }}
                  />
                </div>
              </div>
            )}

            {/* Tap hint */}
            <div className="mt-auto px-4 pb-3 text-center">
              {canFlip ? (
                <span className="text-xs text-muted-foreground">Tap for parlay breakdown</span>
              ) : (
                <div className="flex flex-col items-center gap-1">
                  <div className="flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-secondary" />
                    <span className="text-xs font-semibold text-secondary">PRO Members Only</span>
                  </div>
                  <Link to="/pricing" className="text-[10px] text-primary hover:underline font-medium" onClick={(e) => e.stopPropagation()}>
                    Upgrade to unlock parlays →
                  </Link>
                </div>
              )}
            </div>

            {/* Bottom bar */}
            <div className={`h-1 w-full ${
              player.status === "hot"
                ? "bg-gradient-to-r from-orange-600 via-orange-500 to-yellow-500"
                : "bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-400"
            }`} />
          </div>
        </div>

        {/* BACK — Sportsbook parlay style */}
        <div className="absolute inset-0 backface-hidden rotate-y-180">
          <div className="h-full rounded-2xl overflow-hidden border-2 border-primary/40 bg-gradient-to-b from-card to-background flex flex-col">
            {/* Header */}
            <div className="px-4 py-3 bg-primary/10 border-b border-primary/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img src={metsLogo} alt="MetsXMFanZone" className="h-5 w-5 object-contain" />
                <span className="text-xs font-bold text-primary uppercase tracking-wider">
                  {parlayLegs.length} Leg Parlay
                </span>
              </div>
              <span className="text-lg font-black text-primary">
                +{player.confidence ? Math.round((player.confidence / 100) * 500 + 100) : 250}
              </span>
            </div>

            {/* Parlay Legs */}
            <div className="flex-1 overflow-auto px-4 py-3 space-y-3">
              {parlayLegs.map((leg, i) => (
                <div key={i} className="border-b border-border/30 pb-3 last:border-b-0">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-bold text-foreground text-sm">
                        {player.player_name} {leg.label}
                      </p>
                      <p className="text-[10px] text-primary font-semibold uppercase tracking-wider">
                        Player Performance {roleLabel}
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              {/* Description */}
              <div className="pt-2">
                <p className="text-xs text-muted-foreground italic leading-relaxed">
                  "{player.description}"
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-primary/20 bg-primary/5 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-muted-foreground block">CONFIDENCE</span>
                <span className="text-sm font-bold text-foreground">{player.confidence ?? 50}%</span>
              </div>
              <Badge className={`text-xs ${
                player.status === "hot" 
                  ? "bg-orange-500/20 text-orange-400 border-orange-500/30" 
                  : "bg-blue-500/20 text-blue-400 border-blue-500/30"
              }`}>
                {player.status === "hot" ? "🔥 HOT" : "❄️ COLD"}
              </Badge>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatBox = ({ label, value, highlight = false }: { label: string; value: number | string; highlight?: boolean }) => (
  <div className={`rounded-lg p-2 text-center ${highlight ? "bg-primary/15 border border-primary/30" : "bg-background/40 border border-border/30"}`}>
    <div className={`text-base sm:text-lg font-black ${highlight ? "text-primary" : "text-foreground"}`}>
      {value}
    </div>
    <div className="text-[10px] text-muted-foreground font-medium">{label}</div>
  </div>
);

export default PlayersToWatch;
