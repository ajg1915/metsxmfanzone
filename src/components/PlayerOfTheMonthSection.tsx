import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThumbsUp, ThumbsDown, Star } from "lucide-react";
import metsxmfanzoneLogo from "@/assets/metsxmfanzone-logo.png";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface PlayerEntry {
  id: string;
  player_name: string;
  player_image_url: string | null;
  month: string;
  year: number;
  admin_opinion: string;
  is_active: boolean;
}

interface VoteCounts {
  agree: number;
  disagree: number;
}

const PlayerOfTheMonthSection = () => {
  const { user } = useAuth();
  const [entry, setEntry] = useState<PlayerEntry | null>(null);
  const [votes, setVotes] = useState<VoteCounts>({ agree: 0, disagree: 0 });
  const [userVote, setUserVote] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);

  useEffect(() => {
    fetchEntry();
  }, [user]);

  const fetchEntry = async () => {
    try {
      const { data, error } = await supabase
        .from("player_of_the_month")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!data) { setLoading(false); return; }

      setEntry(data as PlayerEntry);

      // Fetch vote counts via aggregate RPC (votes table is no longer publicly readable)
      const { data: counts } = await supabase
        .rpc("get_potm_vote_counts", { p_player_of_the_month_id: data.id });

      const agree = counts?.find((r: any) => r.vote_type === "agree")?.vote_count ?? 0;
      const disagree = counts?.find((r: any) => r.vote_type === "disagree")?.vote_count ?? 0;
      setVotes({ agree: Number(agree), disagree: Number(disagree) });


      // Check user vote
      if (user) {
        const { data: uv } = await supabase
          .from("player_of_the_month_votes")
          .select("vote_type")
          .eq("player_of_the_month_id", data.id)
          .eq("user_id", user.id)
          .maybeSingle();
        setUserVote(uv?.vote_type || null);
      }
    } catch (err) {
      console.error("Error fetching player of the month:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (voteType: "agree" | "disagree") => {
    if (!user) {
      toast({ title: "Sign in required", description: "Please sign in to vote.", variant: "destructive" });
      return;
    }
    if (!entry) return;
    setVoting(true);

    try {
      if (userVote === voteType) {
        // Remove vote
        await supabase
          .from("player_of_the_month_votes")
          .delete()
          .eq("player_of_the_month_id", entry.id)
          .eq("user_id", user.id);
        setUserVote(null);
        setVotes(prev => ({ ...prev, [voteType]: prev[voteType] - 1 }));
      } else {
        if (userVote) {
          // Switch vote
          await supabase
            .from("player_of_the_month_votes")
            .update({ vote_type: voteType })
            .eq("player_of_the_month_id", entry.id)
            .eq("user_id", user.id);
          setVotes(prev => ({
            agree: voteType === "agree" ? prev.agree + 1 : prev.agree - 1,
            disagree: voteType === "disagree" ? prev.disagree + 1 : prev.disagree - 1,
          }));
        } else {
          // New vote
          await supabase
            .from("player_of_the_month_votes")
            .insert({ player_of_the_month_id: entry.id, user_id: user.id, vote_type: voteType });
          setVotes(prev => ({ ...prev, [voteType]: prev[voteType] + 1 }));
        }
        setUserVote(voteType);
      }
    } catch (err) {
      console.error("Vote error:", err);
      toast({ title: "Error", description: "Could not submit your vote.", variant: "destructive" });
    } finally {
      setVoting(false);
    }
  };

  if (loading || !entry) return null;

  const totalVotes = votes.agree + votes.disagree;
  const agreePercent = totalVotes > 0 ? Math.round((votes.agree / totalVotes) * 100) : 0;

  return (
    <section className="py-6 sm:py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center gap-2 mb-4">
            <img src={metsxmfanzoneLogo} alt="MetsXMFanZone" className="w-5 h-5 sm:w-6 sm:h-6 rounded" />
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground">
              Player of the Month
            </h2>
            <Badge className="text-[8px] sm:text-[10px] px-1.5 py-0.5 font-semibold bg-primary/90 text-primary-foreground">
              {entry.month} {entry.year}
            </Badge>
          </div>

          <div className="rounded-xl border border-border bg-card/80 backdrop-blur-sm overflow-hidden">
            <div className="flex flex-col md:flex-row gap-4 sm:gap-6 p-4 sm:p-6">
              {/* Player Image */}
              {entry.player_image_url && (
                <div className="flex-shrink-0 w-40 mx-auto md:mx-0 md:w-48 lg:w-56">
                  <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-muted">
                    <img
                      src={entry.player_image_url}
                      alt={entry.player_name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 left-2">
                      <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-primary/90 backdrop-blur-sm">
                        <Star className="w-3 h-3 text-primary-foreground" fill="currentColor" />
                        <span className="text-[10px] sm:text-xs font-bold text-primary-foreground">POTM</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Content */}
              <div className="flex-1 space-y-3">
                <h3 className="text-xl sm:text-2xl font-bold text-foreground">
                  {entry.player_name}
                </h3>

                <div className="bg-muted/50 rounded-lg p-3 sm:p-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    Anthony's Take
                  </p>
                  <p className="text-sm sm:text-base text-foreground leading-relaxed whitespace-pre-line">
                    {entry.admin_opinion}
                  </p>
                </div>

                {/* Voting */}
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-foreground">Do you agree with this pick?</p>
                  <div className="flex items-center gap-3">
                    <Button
                      variant={userVote === "agree" ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleVote("agree")}
                      disabled={voting}
                      className={cn(
                        "gap-1.5",
                        userVote === "agree" && "bg-green-600 hover:bg-green-700 text-white border-green-600"
                      )}
                    >
                      <ThumbsUp className="w-4 h-4" />
                      Agree ({votes.agree})
                    </Button>
                    <Button
                      variant={userVote === "disagree" ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleVote("disagree")}
                      disabled={voting}
                      className={cn(
                        "gap-1.5",
                        userVote === "disagree" && "bg-red-600 hover:bg-red-700 text-white border-red-600"
                      )}
                    >
                      <ThumbsDown className="w-4 h-4" />
                      Disagree ({votes.disagree})
                    </Button>
                  </div>

                  {/* Vote bar */}
                  {totalVotes > 0 && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] sm:text-xs text-muted-foreground">
                        <span>{agreePercent}% agree</span>
                        <span>{totalVotes} total votes</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden flex">
                        <div
                          className="h-full bg-green-500 transition-all duration-500"
                          style={{ width: `${agreePercent}%` }}
                        />
                        <div
                          className="h-full bg-red-500 transition-all duration-500"
                          style={{ width: `${100 - agreePercent}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default PlayerOfTheMonthSection;
