import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CheckCircle2, Trophy, Clock } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Poll {
  id: string;
  question: string;
  options: string[];
  poll_type: "poll" | "prediction";
  points: number;
  correct_option_index: number | null;
  is_resolved: boolean;
  expires_at: string | null;
}

interface VoteRow {
  poll_id: string;
  user_id: string;
  option_index: number;
}

export function GameDayPolls() {
  const { user } = useAuth();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [votes, setVotes] = useState<VoteRow[]>([]);
  const [myVotes, setMyVotes] = useState<Record<string, number>>({});

  const loadAll = async () => {
    const [{ data: p }, { data: v }] = await Promise.all([
      supabase
        .from("gameday_polls")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false }),
      supabase.from("gameday_poll_votes").select("poll_id, user_id, option_index"),
    ]);
    if (p) {
      setPolls(
        p.map((row: any) => ({
          ...row,
          options: Array.isArray(row.options) ? row.options : [],
        }))
      );
    }
    if (v) {
      setVotes(v as VoteRow[]);
      if (user) {
        const mine: Record<string, number> = {};
        v.forEach((row: any) => {
          if (row.user_id === user.id) mine[row.poll_id] = row.option_index;
        });
        setMyVotes(mine);
      }
    }
  };

  useEffect(() => {
    loadAll();
    const channel = supabase
      .channel("gameday_polls_live")
      .on("postgres_changes", { event: "*", schema: "public", table: "gameday_polls" }, loadAll)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "gameday_poll_votes" },
        loadAll
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const vote = async (pollId: string, optionIndex: number) => {
    if (!user) {
      toast({ title: "Sign in to vote", variant: "destructive" });
      return;
    }
    if (myVotes[pollId] !== undefined) return;
    const { error } = await supabase
      .from("gameday_poll_votes")
      .insert({ poll_id: pollId, user_id: user.id, option_index: optionIndex });
    if (error) {
      toast({ title: "Vote failed", description: error.message, variant: "destructive" });
    } else {
      setMyVotes((prev) => ({ ...prev, [pollId]: optionIndex }));
    }
  };

  if (polls.length === 0) {
    return (
      <Card className="p-6 text-center bg-card/50 backdrop-blur-sm">
        <Trophy className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          No active polls. Polls drop during games — stick around!
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {polls.map((poll) => {
        const pollVotes = votes.filter((v) => v.poll_id === poll.id);
        const total = pollVotes.length;
        const myChoice = myVotes[poll.id];
        const hasVoted = myChoice !== undefined;
        return (
          <Card key={poll.id} className="p-4 bg-card/50 backdrop-blur-sm border-border">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={cn(
                      "text-[10px] font-bold uppercase px-1.5 py-0.5 rounded",
                      poll.poll_type === "prediction"
                        ? "bg-yellow-500/20 text-yellow-400"
                        : "bg-primary/20 text-primary"
                    )}
                  >
                    {poll.poll_type === "prediction" ? `Predict · ${poll.points}pt` : "Poll"}
                  </span>
                  {poll.is_resolved && (
                    <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Resolved
                    </span>
                  )}
                </div>
                <h4 className="font-semibold text-sm leading-snug">{poll.question}</h4>
              </div>
            </div>
            <div className="space-y-1.5">
              {poll.options.map((opt, i) => {
                const count = pollVotes.filter((v) => v.option_index === i).length;
                const pct = total > 0 ? (count / total) * 100 : 0;
                const isMine = myChoice === i;
                const isCorrect = poll.is_resolved && poll.correct_option_index === i;
                const isWrong =
                  poll.is_resolved && isMine && poll.correct_option_index !== i;
                return (
                  <button
                    key={i}
                    onClick={() => vote(poll.id, i)}
                    disabled={hasVoted || poll.is_resolved}
                    className={cn(
                      "w-full text-left relative overflow-hidden rounded-md border px-3 py-2 text-sm transition-all",
                      "disabled:cursor-default",
                      isCorrect
                        ? "border-green-500 bg-green-500/10"
                        : isWrong
                        ? "border-destructive bg-destructive/10"
                        : isMine
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50 hover:bg-primary/5"
                    )}
                  >
                    <div
                      className={cn(
                        "absolute inset-y-0 left-0 transition-all",
                        isCorrect
                          ? "bg-green-500/20"
                          : isMine
                          ? "bg-primary/20"
                          : "bg-muted/40"
                      )}
                      style={{ width: hasVoted || poll.is_resolved ? `${pct}%` : "0%" }}
                    />
                    <div className="relative flex items-center justify-between gap-2">
                      <span className="font-medium flex items-center gap-1.5">
                        {isMine && <CheckCircle2 className="w-3.5 h-3.5" />}
                        {opt}
                      </span>
                      {(hasVoted || poll.is_resolved) && (
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {Math.round(pct)}% · {count}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
            {!hasVoted && !poll.is_resolved && (
              <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Cast your vote to see live results
              </p>
            )}
          </Card>
        );
      })}
    </div>
  );
}
