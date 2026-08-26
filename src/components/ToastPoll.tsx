import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import metsLogo from "@/assets/metsxmfanzone-logo.png";

interface Poll {
  id: string;
  question: string;
  options: string[];
}

interface PollVote {
  option_index: number;
  vote_count: number;
}

const ToastPoll = () => {
  const [poll, setPoll] = useState<Poll | null>(null);
  const [visible, setVisible] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [votes, setVotes] = useState<PollVote[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAndFetchPoll = async () => {
      // Only show polls to logged-in users
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsAuthenticated(false);
        return;
      }
      setIsAuthenticated(true);

      // Check if user has dismissed polls recently
      const dismissedUntil = localStorage.getItem("poll_dismissed_until");
      if (dismissedUntil && new Date(dismissedUntil) > new Date()) {
        return;
      }

      // Get session ID for voting tracking
      let sessionId = localStorage.getItem("poll_session_id");
      if (!sessionId) {
        sessionId = crypto.randomUUID();
        localStorage.setItem("poll_session_id", sessionId);
      }

      // Fetch active poll that should show as toast
      const { data: polls, error } = await supabase
        .from("polls")
        .select("*")
        .eq("is_active", true)
        .eq("show_as_toast", true)
        .order("created_at", { ascending: false })
        .limit(1);

      if (error || !polls || polls.length === 0) return;

      const activePoll = polls[0];
      
      // Check if poll has expired
      if (activePoll.expires_at && new Date(activePoll.expires_at) < new Date()) {
        return;
      }

      // Check if user has already voted on this poll
      const votedPolls = JSON.parse(localStorage.getItem("voted_polls") || "[]");
      if (votedPolls.includes(activePoll.id)) {
        return;
      }

      setPoll({
        ...activePoll,
        options: Array.isArray(activePoll.options) 
          ? activePoll.options 
          : JSON.parse(activePoll.options as string),
      });

      // Delay showing the poll
      setTimeout(() => setVisible(true), 3000);
    };

    checkAndFetchPoll();
  }, []);

  const fetchVotes = async (pollId: string) => {
    const { data } = await supabase
      .from("poll_vote_counts" as any)
      .select("option_index, vote_count")
      .eq("poll_id", pollId);

    if (data) {
      setVotes(data as unknown as PollVote[]);
    }
  };

  const handleVote = async () => {
    if (!poll || selectedOption === null || submitting) return;

    setSubmitting(true);

    try {
      const sessionId = localStorage.getItem("poll_session_id");
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase.from("poll_votes").insert({
        poll_id: poll.id,
        option_index: selectedOption,
        user_id: user?.id || null,
        session_id: sessionId,
      });

      if (error) throw error;

      // Mark poll as voted
      const votedPolls = JSON.parse(localStorage.getItem("voted_polls") || "[]");
      votedPolls.push(poll.id);
      localStorage.setItem("voted_polls", JSON.stringify(votedPolls));

      setHasVoted(true);
      await fetchVotes(poll.id);
    } catch (error) {
      console.error("Error voting:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    setVisible(false);
    // Don't show polls for 24 hours
    const dismissUntil = new Date();
    dismissUntil.setHours(dismissUntil.getHours() + 24);
    localStorage.setItem("poll_dismissed_until", dismissUntil.toISOString());
  };

  const getVotePercentage = (optionIndex: number) => {
    const totalVotes = votes.reduce((sum, vote) => sum + Number(vote.vote_count || 0), 0);
    if (totalVotes === 0) return 0;
    const optionVotes = votes.find((v) => v.option_index === optionIndex)?.vote_count ?? 0;
    return (Number(optionVotes) / totalVotes) * 100;
  };

  if (!poll || !visible || dismissed || !isAuthenticated) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 100, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 100, scale: 0.9 }}
        className="fixed bottom-4 right-4 z-50 w-80 sm:w-96"
      >
        <Card className="border-primary/50 shadow-2xl bg-background/95 backdrop-blur-sm">
          <CardHeader className="pb-2 flex flex-row items-start justify-between">
            <div className="flex items-center gap-2">
              <img src={metsLogo} alt="MetsXMFanZone" className="h-6 w-6 object-contain" />
              <CardTitle className="text-base font-semibold">Quick Poll</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 -mt-1 -mr-2"
              onClick={handleDismiss}
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="font-medium text-foreground">{poll.question}</p>

            {!hasVoted ? (
              <>
                <div className="space-y-2">
                  {poll.options.map((option, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedOption(index)}
                      className={`w-full text-left px-3 py-2 rounded-lg border transition-all ${
                        selectedOption === index
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:border-primary/50 hover:bg-muted"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                            selectedOption === index
                              ? "border-primary bg-primary"
                              : "border-muted-foreground"
                          }`}
                        >
                          {selectedOption === index && (
                            <Check className="h-3 w-3 text-primary-foreground" />
                          )}
                        </div>
                        <span className="text-sm">{option}</span>
                      </div>
                    </button>
                  ))}
                </div>
                <Button
                  onClick={handleVote}
                  disabled={selectedOption === null || submitting}
                  className="w-full"
                  size="sm"
                >
                  {submitting ? "Submitting..." : "Vote"}
                </Button>
              </>
            ) : (
              <div className="space-y-2">
                {poll.options.map((option, index) => {
                  const percentage = getVotePercentage(index);
                  const isSelected = selectedOption === index;

                  return (
                    <div key={index} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className={isSelected ? "font-medium text-primary" : ""}>
                          {option} {isSelected && "✓"}
                        </span>
                        <span className="text-muted-foreground">{percentage.toFixed(0)}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${percentage}%` }}
                          transition={{ duration: 0.5, delay: index * 0.1 }}
                          className={`h-full rounded-full ${
                            isSelected ? "bg-primary" : "bg-muted-foreground/40"
                          }`}
                        />
                      </div>
                    </div>
                  );
                })}
                <p className="text-xs text-muted-foreground text-center pt-2">
                  {votes.length} total vote{votes.length !== 1 ? "s" : ""}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
};

export default ToastPoll;
