import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Trophy, Medal } from "lucide-react";
import { cn } from "@/lib/utils";

interface LeaderRow {
  user_id: string;
  total_points: number;
  correct_predictions: number;
  total_predictions: number;
  profile?: { full_name: string | null; avatar_url: string | null };
}

export function GameDayLeaderboard() {
  const [rows, setRows] = useState<LeaderRow[]>([]);

  const load = async () => {
    const { data: lb } = await supabase
      .from("gameday_leaderboard")
      .select("*")
      .order("total_points", { ascending: false })
      .limit(10);
    if (!lb) return;
    const ids = lb.map((r) => r.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", ids);
    const pMap = new Map(profiles?.map((p) => [p.id, p]) || []);
    setRows(lb.map((r) => ({ ...r, profile: pMap.get(r.user_id) })));
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel("gameday_leaderboard_live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "gameday_leaderboard" },
        load
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <Card className="p-4 bg-card/50 backdrop-blur-sm border-border">
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="w-4 h-4 text-yellow-400" />
        <h3 className="font-semibold text-sm">Prediction Leaderboard</h3>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">
          No predictions scored yet. Be first on the board!
        </p>
      ) : (
        <ol className="space-y-1.5">
          {rows.map((r, i) => (
            <li key={r.user_id} className="flex items-center gap-2 text-sm">
              <span
                className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0",
                  i === 0
                    ? "bg-yellow-500/20 text-yellow-400"
                    : i === 1
                    ? "bg-gray-400/20 text-gray-300"
                    : i === 2
                    ? "bg-orange-700/30 text-orange-400"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {i < 3 ? <Medal className="w-3.5 h-3.5" /> : i + 1}
              </span>
              <div className="w-6 h-6 rounded-full bg-primary/20 overflow-hidden flex-shrink-0 flex items-center justify-center text-[10px] font-bold">
                {r.profile?.avatar_url ? (
                  <img src={r.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  (r.profile?.full_name?.[0] || "?").toUpperCase()
                )}
              </div>
              <span className="flex-1 truncate font-medium">
                {r.profile?.full_name || "Fan"}
              </span>
              <span className="text-xs text-muted-foreground">
                {r.correct_predictions}/{r.total_predictions}
              </span>
              <span className="font-bold text-primary tabular-nums">{r.total_points}</span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
