import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { Loader2, TrendingUp } from "lucide-react";

interface PlayerStatsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playerId?: number;
  playerName: string;
  fieldPosition: string;
  imageUrl?: string;
  battingPosition?: number;
}

const isPitcher = (pos: string) => ["P", "SP", "RP"].includes(pos?.toUpperCase());

export default function PlayerStatsDialog({
  open,
  onOpenChange,
  playerId,
  playerName,
  fieldPosition,
  imageUrl,
  battingPosition,
}: PlayerStatsDialogProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["player-stats-card", playerId],
    enabled: open && !!playerId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const group = isPitcher(fieldPosition) ? "pitching" : "hitting";
      const [bioRes, statsRes] = await Promise.all([
        fetch(`https://statsapi.mlb.com/api/v1/people/${playerId}`),
        fetch(
          `https://statsapi.mlb.com/api/v1/people/${playerId}/stats?stats=season&season=2026&group=${group}`
        ),
      ]);
      const bioJson = await bioRes.json();
      const statsJson = await statsRes.json();
      const bio = bioJson.people?.[0];
      const stat = statsJson.stats?.[0]?.splits?.[0]?.stat;
      return { bio, stat, group };
    },
  });

  const bio = data?.bio;
  const stat = data?.stat;
  const group = data?.group;

  const hittingStats = [
    { label: "AVG", value: stat?.avg ?? ".—" },
    { label: "HR", value: stat?.homeRuns ?? "—" },
    { label: "RBI", value: stat?.rbi ?? "—" },
    { label: "OBP", value: stat?.obp ?? ".—" },
    { label: "SLG", value: stat?.slg ?? ".—" },
    { label: "OPS", value: stat?.ops ?? ".—" },
    { label: "H", value: stat?.hits ?? "—" },
    { label: "R", value: stat?.runs ?? "—" },
    { label: "SB", value: stat?.stolenBases ?? "—" },
  ];

  const pitchingStats = [
    { label: "ERA", value: stat?.era ?? "—" },
    { label: "W-L", value: `${stat?.wins ?? 0}-${stat?.losses ?? 0}` },
    { label: "SO", value: stat?.strikeOuts ?? "—" },
    { label: "WHIP", value: stat?.whip ?? "—" },
    { label: "IP", value: stat?.inningsPitched ?? "—" },
    { label: "BAA", value: stat?.avg ?? ".—" },
    { label: "SV", value: stat?.saves ?? "—" },
    { label: "GS", value: stat?.gamesStarted ?? "—" },
    { label: "K/9", value: stat?.strikeoutsPer9Inn ?? "—" },
  ];

  const statBlocks = group === "pitching" ? pitchingStats : hittingStats;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden bg-card border-border/50">
        <DialogHeader className="sr-only">
          <DialogTitle>{playerName} stats</DialogTitle>
        </DialogHeader>

        {/* Player Header */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/90 to-primary/60" />
          <div className="absolute -right-10 -top-10 w-48 h-48 bg-white/15 rounded-full blur-3xl" aria-hidden />
          <div className="relative p-5 flex items-center gap-4 text-primary-foreground">
            <div className="relative shrink-0">
              <div className="absolute inset-0 bg-white/30 blur-xl rounded-full" />
              <div className="relative w-24 h-24 rounded-2xl overflow-hidden border-2 border-white/40 shadow-2xl bg-white/10 backdrop-blur-md">
                {imageUrl ? (
                  <img src={imageUrl} alt={playerName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl font-black">
                    {playerName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </div>
                )}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              {battingPosition !== undefined && (
                <p className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-80">
                  Batting #{battingPosition}
                </p>
              )}
              <p className="text-xl font-black tracking-tight leading-tight truncate">{playerName}</p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider bg-black/25 px-2 py-0.5 rounded-md border border-white/20">
                  {fieldPosition}
                </span>
                {bio?.primaryNumber && (
                  <span className="text-[10px] font-black uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-md">
                    #{bio.primaryNumber}
                  </span>
                )}
                {bio?.batSide?.code && bio?.pitchHand?.code && (
                  <span className="text-[10px] font-bold opacity-90">
                    B/T: {bio.batSide.code}/{bio.pitchHand.code}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="p-5">
          <div className="flex items-center gap-1.5 mb-3">
            <TrendingUp className="w-3.5 h-3.5 text-primary" />
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">
              {group === "pitching" ? "2026 Pitching" : "2026 Batting"} Stats
            </p>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {statBlocks.map((s) => (
                <div
                  key={s.label}
                  className="rounded-xl border border-border/30 bg-muted/20 p-3 text-center"
                >
                  <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">
                    {s.label}
                  </p>
                  <p
                    className="text-lg font-black text-foreground mt-0.5"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {String(s.value)}
                  </p>
                </div>
              ))}
            </div>
          )}

          {bio && (
            <div className="mt-4 pt-3 border-t border-border/30 grid grid-cols-2 gap-2 text-[11px]">
              {bio.height && (
                <div>
                  <span className="text-muted-foreground">Height: </span>
                  <span className="font-bold text-foreground">{bio.height}</span>
                </div>
              )}
              {bio.weight && (
                <div>
                  <span className="text-muted-foreground">Weight: </span>
                  <span className="font-bold text-foreground">{bio.weight} lbs</span>
                </div>
              )}
              {bio.birthCity && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">From: </span>
                  <span className="font-bold text-foreground">
                    {bio.birthCity}
                    {bio.birthStateProvince ? `, ${bio.birthStateProvince}` : ""}
                    {bio.birthCountry ? `, ${bio.birthCountry}` : ""}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
