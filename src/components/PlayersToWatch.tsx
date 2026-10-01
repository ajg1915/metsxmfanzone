import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, RefreshCw, CheckCircle2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useState } from "react";
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
  bet_amount: string | null;
  payout: string | null;
}

interface NYTeamPick {
  id: string;
  event_id: string;
  team_key: string;
  league: string;
  picked_team: string;
  picked_team_logo: string | null;
  other_team: string;
  other_team_logo: string | null;
  is_home: boolean;
  game_start: string;
  confidence: number | null;
  reasoning: string | null;
  outcome: string | null;
}

// Full names of the six NY teams, keyed the same way as ny_team_picks.team_key.
const NY_TEAM_NAMES: Record<string, string> = {
  giants: "New York Giants",
  jets: "New York Jets",
  knicks: "New York Knicks",
  nets: "Brooklyn Nets",
  rangers: "New York Rangers",
  islanders: "New York Islanders",
};

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

  // NY team picks show whenever there's no Mets game day (e.g. the off-season).
  // The Mets predictions below are untouched and return on their own on game days.
  const { data: teamPicks, isLoading: picksLoading } = useQuery({
    queryKey: ["ny-team-picks"],
    enabled: noGameToday,
    queryFn: async () => {
      const since = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("ny_team_picks" as any)
        .select("id, event_id, team_key, league, picked_team, picked_team_logo, other_team, other_team_logo, is_home, game_start, confidence, reasoning, outcome")
        .eq("published", true)
        .gte("game_start", since)
        .order("game_start", { ascending: true })
        .limit(9);
      if (error) throw error;
      return (data ?? []) as unknown as NYTeamPick[];
    },
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: true,
  });
  const hasTeamPicks = noGameToday && !!teamPicks && teamPicks.length > 0;
  const shouldGenerate = !noGameToday && !isLoading && (!predictions || predictions.length === 0);

  const isPitcherPlayer = (p: PlayerPrediction) => p.is_pitcher === true;
  const isCloser = (p: PlayerPrediction) => (p.predicted_saves ?? 0) > 0;
  const isStarter = (p: PlayerPrediction) => isPitcherPlayer(p) && !isCloser(p);

  const scroller = "-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 scrollbar-hide md:mx-0 md:grid md:grid-cols-2 md:gap-4 md:overflow-visible md:px-0 lg:grid-cols-3";
  const slide = "w-[84vw] max-w-[360px] shrink-0 snap-center md:w-auto md:max-w-none";
  const showUpdated = (predictions && predictions.length > 0 && !noGameToday) || hasTeamPicks;
  const Loading = ({ label }: { label: string }) => (
    <div className="flex items-center justify-center gap-3 rounded-2xl border border-border/40 bg-card/60 py-12">
      <RefreshCw className="h-6 w-6 animate-spin text-primary" />
      <span className="text-foreground">{label}</span>
    </div>
  );
  const Footer = () => (
    <p className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5 font-bold text-primary"><CheckCircle2 className="h-4 w-4" /> Anthony Approved</span>
      <span>For entertainment purposes. Always bet responsibly.</span>
    </p>
  );

  return (
    <section className="w-full px-4 py-7 sm:px-6 sm:py-12 lg:px-8">
      <div className="mx-auto w-full max-w-7xl">
        {/* Header */}
        <div className="mb-4 flex items-end justify-between gap-3 sm:mb-6">
          <div className="flex min-w-0 items-center gap-3">
            <img src={metsLogo} alt="" className="h-11 w-11 shrink-0 object-contain sm:h-14 sm:w-14" />
            <div className="min-w-0">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#ff5a1f]">
                {noGameToday ? "NY team picks" : "Daily parlays & projections"}
              </p>
              <h2 className="font-display text-[30px] font-bold uppercase leading-none tracking-wide text-foreground sm:text-5xl">
                Anthony's <span className="text-[#ff5a1f]">Predictions</span>
              </h2>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            {!canViewParlays && <PremiumBadge size="xs" noGlow />}
            {showUpdated && (
              <span className="rounded-full border border-border/50 bg-card px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            )}
          </div>
        </div>

        {noGameToday && picksLoading && <Loading label="Loading picks..." />}

        {hasTeamPicks && (
          <>
            <div className={scroller}>
              {teamPicks!.map((pick) => (
                <div key={pick.id} className={slide}><TeamPickCard pick={pick} /></div>
              ))}
            </div>
            <Footer />
          </>
        )}

        {noGameToday && !picksLoading && !hasTeamPicks && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-border/40 bg-card/60 px-4 py-12 text-center">
            <TrendingUp className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="font-display text-2xl uppercase tracking-wide text-foreground">No game today</p>
            <p className="mt-1 text-sm text-muted-foreground">Picks return on the next game day.</p>
          </div>
        )}

        {!noGameToday && isLoading && <Loading label="Loading predictions..." />}

        {shouldGenerate && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-border/40 bg-card/60 px-4 py-12 text-center">
            <TrendingUp className="mb-3 h-10 w-10 text-primary" />
            <p className="mb-4 text-foreground">Predictions not yet available</p>
            <Button onClick={generatePredictions} disabled={isGenerating} className="h-11 bg-primary hover:bg-primary/90">
              {isGenerating ? (<><RefreshCw className="mr-2 h-4 w-4 animate-spin" />Generating...</>) : (<><TrendingUp className="mr-2 h-4 w-4" />Predictions Coming Soon</>)}
            </Button>
          </div>
        )}

        {!noGameToday && predictions && predictions.length > 0 && (
          <>
            <div className={scroller}>
              {predictions.map((player) => (
                <div key={player.id} className={slide}>
                  <ParlayCard player={player} isPitcher={isPitcherPlayer(player)} isCloser={isCloser(player)} isStarter={isStarter(player)} canFlip={canViewParlays} />
                </div>
              ))}
            </div>
            <Footer />
          </>
        )}
      </div>
    </section>
  );
};

// NY team matchup pick card: both teams side by side, the picked team highlighted.
const TeamPickCard = ({ pick }: { pick: NYTeamPick }) => {
  const nyName = NY_TEAM_NAMES[pick.team_key] ?? "";
  const nyIsPicked = pick.picked_team === nyName;
  const ny = nyIsPicked ? { name: pick.picked_team, logo: pick.picked_team_logo } : { name: pick.other_team, logo: pick.other_team_logo };
  const opp = nyIsPicked ? { name: pick.other_team, logo: pick.other_team_logo } : { name: pick.picked_team, logo: pick.picked_team_logo };
  const away = pick.is_home ? opp : ny;
  const home = pick.is_home ? ny : opp;

  const when = new Date(pick.game_start).toLocaleString("en-US", {
    timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
  const outcome = (pick.outcome || "").toLowerCase();
  const isCorrect = outcome === "correct" || outcome === "win" || outcome === "hit";
  const isMissed = outcome === "incorrect" || outcome === "loss" || outcome === "miss";

  const Side = ({ team }: { team: { name: string; logo: string | null } }) => {
    const picked = team.name === pick.picked_team;
    return (
      <div className={`relative flex min-w-0 flex-1 flex-col items-center gap-2 rounded-xl border px-2 pb-3 pt-4 ${picked ? "border-[#ff5a1f] bg-[#ff5a1f]/10" : "border-border/40 bg-background/40 opacity-70"}`}>
        {picked && (
          <span className="absolute -top-2.5 inline-flex items-center gap-1 rounded-full bg-[#d43700] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white">
            <CheckCircle2 className="h-3 w-3" /> Pick
          </span>
        )}
        {team.logo ? <img src={team.logo} alt="" className="h-14 w-14 object-contain" loading="lazy" /> : <div className="h-14 w-14 rounded-full bg-muted" />}
        <span className="line-clamp-2 text-center text-[13px] font-bold leading-tight text-foreground">{team.name}</span>
      </div>
    );
  };

  return (
    <article className="flex h-full min-w-0 flex-col gap-3 rounded-2xl border border-border/50 bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-md bg-[#0b3e75] px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-white">{pick.league}</span>
        <span className="text-xs font-semibold text-muted-foreground">{when} ET</span>
      </div>
      <div className="flex items-stretch gap-2">
        <Side team={away} />
        <span className="flex items-center font-display text-lg text-muted-foreground">@</span>
        <Side team={home} />
      </div>
      {pick.confidence != null && (
        <div>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="font-semibold text-muted-foreground">Confidence</span>
            <span className="font-display text-xl leading-none text-[#ff5a1f]">{pick.confidence}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-background/60">
            <div className="h-full rounded-full bg-gradient-to-r from-[#d43700] to-[#ff8a4d]" style={{ width: `${Math.min(100, pick.confidence)}%` }} />
          </div>
        </div>
      )}
      {(isCorrect || isMissed) && (
        <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-bold ${isCorrect ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}>
          {isCorrect ? "Correct" : "Missed"}
        </span>
      )}
      {pick.reasoning && <p className="line-clamp-4 text-[13px] leading-snug text-muted-foreground">{pick.reasoning}</p>}
    </article>
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
  const hot = player.status === "hot";

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
      className="relative h-[390px] cursor-pointer perspective-1000"
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
          <div className={`flex h-full flex-col overflow-hidden rounded-2xl border bg-card ${hot ? "border-[#ff5a1f]/40" : "border-[#2c78c9]/40"}`}>
            <div className={`h-1.5 w-full ${hot ? "bg-gradient-to-r from-[#d43700] to-[#ffb347]" : "bg-gradient-to-r from-[#0b3e75] to-[#4fb3ff]"}`} />

            <div className="flex items-center gap-3 p-4 pb-3">
              <img
                src={player.player_image_url || "/placeholder.svg"}
                alt=""
                className={`h-16 w-16 shrink-0 rounded-2xl border-2 object-cover ${hot ? "border-[#ff5a1f]/60" : "border-[#2c78c9]/60"}`}
                onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg"; }}
              />
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-display text-[26px] font-bold uppercase leading-none tracking-wide text-foreground">{player.player_name}</h3>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold ${hot ? "bg-[#ff5a1f]/15 text-[#ff8a4d]" : "bg-[#2c78c9]/20 text-[#6fb4ff]"}`}>
                    {hot ? "HOT" : "COLD"}
                  </span>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold text-foreground">{roleLabel}</span>
                </div>
              </div>
              {isStarter && player.predicted_win_loss && (
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-display text-2xl ${player.predicted_win_loss === "W" ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}>
                  {player.predicted_win_loss}
                </div>
              )}
            </div>

            <div className="px-4">
              <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground">Projected line</p>
              <div className="grid grid-cols-4 gap-2">
                {isPitcher ? (
                  isCloser ? (
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
                  )
                ) : (
                  <>
                    <StatBox label="HR" value={player.predicted_hr ?? 0} highlight />
                    <StatBox label="RBI" value={player.predicted_rbis ?? 0} />
                    <StatBox label="R" value={player.predicted_runs ?? 0} />
                    <StatBox label="SB" value={player.predicted_sb ?? 0} />
                  </>
                )}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-background/50 px-3 py-2">
                  <p className="text-[11px] font-semibold text-muted-foreground">Bet</p>
                  <p className="font-display text-xl leading-tight text-foreground">{player.bet_amount || "—"}</p>
                </div>
                <div className="rounded-xl bg-background/50 px-3 py-2">
                  <p className="text-[11px] font-semibold text-muted-foreground">Payout</p>
                  <p className="font-display text-xl leading-tight text-green-400">{player.payout || "—"}</p>
                </div>
              </div>
            </div>

            <div className="mt-auto px-4 pb-4 pt-3">
              {player.confidence != null && (
                <>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-semibold text-muted-foreground">Confidence</span>
                    <span className="font-display text-xl leading-none text-[#ff5a1f]">{player.confidence}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-background/60">
                    <div className={`h-full rounded-full ${hot ? "bg-gradient-to-r from-[#d43700] to-[#ffb347]" : "bg-gradient-to-r from-[#0b3e75] to-[#4fb3ff]"}`} style={{ width: `${Math.min(100, player.confidence)}%` }} />
                  </div>
                </>
              )}
              {canFlip && <p className="mt-2 text-center text-xs font-semibold text-muted-foreground">Tap card for parlay</p>}
            </div>
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

            {/* Bet & Payout */}
            <div className="px-4 py-2 border-t border-primary/20 bg-primary/5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-muted-foreground block">💰 BET AMOUNT</span>
                  <span className="text-sm font-bold text-foreground">{player.bet_amount || "—"}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-muted-foreground block">PAYOUT</span>
                  <span className="text-sm font-bold text-green-400">{player.payout || "—"}</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-primary/20 bg-primary/5 flex items-center justify-between">
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
  <div className={`rounded-xl py-2 text-center ${highlight ? "bg-[#ff5a1f]/15 ring-1 ring-[#ff5a1f]/40" : "bg-background/50"}`}>
    <div className={`font-display text-[28px] leading-none ${highlight ? "text-[#ff5a1f]" : "text-foreground"}`}>{value}</div>
    <div className="mt-1 text-[11px] font-bold text-muted-foreground">{label}</div>
  </div>
);

export default PlayersToWatch;
