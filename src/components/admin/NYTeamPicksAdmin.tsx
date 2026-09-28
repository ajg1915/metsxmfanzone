import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Trophy, RotateCcw, RefreshCw } from "lucide-react";

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
  manual_override: boolean;
  published: boolean;
  outcome: string | null;
}

const NY_TEAM_NAMES: Record<string, string> = {
  giants: "New York Giants",
  jets: "New York Jets",
  knicks: "New York Knicks",
  nets: "Brooklyn Nets",
  rangers: "New York Rangers",
  islanders: "New York Islanders",
};

const QUERY_KEY = ["admin-ny-team-picks"];

// Admin list of upcoming NY team picks. Tap a team to make it the pick
// (marks the pick as your override so the hourly job leaves it alone),
// reset it back to the agent, or hide a pick from the site.
export default function NYTeamPicksAdmin() {
  const queryClient = useQueryClient();

  const { data: picks, isLoading, refetch, isRefetching } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const since = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("ny_team_picks" as any)
        .select("*")
        .gte("game_start", since)
        .order("game_start", { ascending: true })
        .limit(40);
      if (error) throw error;
      return (data ?? []) as unknown as NYTeamPick[];
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, changes }: { id: string; changes: Partial<NYTeamPick> }) => {
      const { error } = await supabase
        .from("ny_team_picks" as any)
        .update({ ...changes, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["ny-team-picks"] });
    },
    onError: (err: any) => toast.error(err?.message || "Could not update pick"),
  });

  const flipPick = (pick: NYTeamPick) => {
    update.mutate(
      {
        id: pick.id,
        changes: {
          picked_team: pick.other_team,
          picked_team_logo: pick.other_team_logo,
          other_team: pick.picked_team,
          other_team_logo: pick.picked_team_logo,
          confidence: null,
          reasoning: "Anthony's call",
          manual_override: true,
        },
      },
      { onSuccess: () => toast.success(`Pick changed to ${pick.other_team}`) },
    );
  };

  const resetToAgent = (pick: NYTeamPick) => {
    update.mutate(
      { id: pick.id, changes: { manual_override: false } },
      { onSuccess: () => toast.success("Handed back to the agent — it re-picks within the hour") },
    );
  };

  const togglePublished = (pick: NYTeamPick, published: boolean) => {
    update.mutate(
      { id: pick.id, changes: { published } },
      { onSuccess: () => toast.success(published ? "Pick is showing on the site" : "Pick hidden from the site") },
    );
  };

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" /> NY Team Picks
            </CardTitle>
            <CardDescription>
              The agent picks every NY team game. Tap the other team to override its pick.
            </CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isRefetching}>
            <RefreshCw className={`h-4 w-4 ${isRefetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading picks…</p>
        ) : !picks || picks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No upcoming picks yet. The agent runs every hour.</p>
        ) : (
          <div className="space-y-3">
            {picks.map((pick) => {
              const nyName = NY_TEAM_NAMES[pick.team_key] ?? "";
              const nyIsPicked = pick.picked_team === nyName;
              const ny = nyIsPicked
                ? { name: pick.picked_team, logo: pick.picked_team_logo }
                : { name: pick.other_team, logo: pick.other_team_logo };
              const opp = nyIsPicked
                ? { name: pick.other_team, logo: pick.other_team_logo }
                : { name: pick.picked_team, logo: pick.picked_team_logo };
              const away = pick.is_home ? opp : ny;
              const home = pick.is_home ? ny : opp;
              const started = new Date(pick.game_start).getTime() <= Date.now();
              const when = new Date(pick.game_start).toLocaleString("en-US", {
                timeZone: "America/New_York",
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              });

              const TeamButton = ({ team }: { team: { name: string; logo: string | null } }) => {
                const picked = team.name === pick.picked_team;
                return (
                  <button
                    type="button"
                    disabled={picked || started || update.isPending}
                    onClick={() => flipPick(pick)}
                    className={`flex flex-1 min-w-0 items-center gap-2 rounded-lg border p-2 text-left transition-colors ${
                      picked
                        ? "border-primary bg-primary/10"
                        : "border-border/50 opacity-70 hover:opacity-100 hover:border-primary/50 disabled:hover:opacity-70 disabled:hover:border-border/50"
                    }`}
                    title={picked ? "Current pick" : started ? "Game has started" : `Pick ${team.name}`}
                  >
                    {team.logo && <img src={team.logo} alt="" className="h-8 w-8 shrink-0 object-contain" />}
                    <span className="min-w-0 text-xs font-semibold leading-tight line-clamp-2">{team.name}</span>
                  </button>
                );
              };

              return (
                <div key={pick.id} className={`rounded-xl border border-border/50 p-3 ${!pick.published ? "opacity-60" : ""}`}>
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                    <Badge variant="outline" className="text-[10px]">{pick.league}</Badge>
                    <span className="text-muted-foreground">{when} ET</span>
                    {pick.manual_override ? (
                      <Badge className="bg-orange-500 text-white text-[10px]">Your pick</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">
                        Agent{pick.confidence != null ? ` · ${pick.confidence}%` : ""}
                      </Badge>
                    )}
                    {pick.outcome === "correct" && <span className="font-semibold text-green-500">✓ Correct</span>}
                    {pick.outcome === "incorrect" && <span className="font-semibold text-red-500">✗ Missed</span>}
                  </div>
                  <div className="flex items-stretch gap-2">
                    <TeamButton team={away} />
                    <span className="self-center text-xs font-bold text-muted-foreground">@</span>
                    <TeamButton team={home} />
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Switch
                        checked={pick.published}
                        onCheckedChange={(v) => togglePublished(pick, v)}
                        disabled={update.isPending}
                      />
                      {pick.published ? "Showing on site" : "Hidden"}
                    </label>
                    {pick.manual_override && !started && (
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => resetToAgent(pick)} disabled={update.isPending}>
                        <RotateCcw className="mr-1 h-3 w-3" /> Back to agent
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
