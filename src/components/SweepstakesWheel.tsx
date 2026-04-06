import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Gift, PartyPopper, Star, X } from "lucide-react";

interface Prize {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  odds_weight: number;
  is_grand_prize: boolean;
  content_url: string | null;
}

interface SweepstakesEvent {
  id: string;
  name: string;
  description: string | null;
  max_spins_per_user: number;
}

const SLICE_COLORS = [
  "#FF5910", "#002D72", "#FF8C42", "#1B4D8E",
  "#FF6B35", "#003DA5", "#FFB347", "#0056B3",
];

export const SweepstakesWheel = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [event, setEvent] = useState<SweepstakesEvent | null>(null);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [wonPrize, setWonPrize] = useState<Prize | null>(null);
  const [rotation, setRotation] = useState(0);
  const [hasSpun, setHasSpun] = useState(false);
  const checkedRef = useRef(false);

  useEffect(() => {
    // Only mark as checked once we've actually fetched data
    if (event) return;

    const checkSweepstakes = async () => {
      const { data: events } = await supabase
        .from("sweepstakes_events")
        .select("id, name, description, max_spins_per_user")
        .eq("is_active", true)
        .lte("start_time", new Date().toISOString())
        .gte("end_time", new Date().toISOString())
        .limit(1);

      if (!events || events.length === 0) return;
      const activeEvent = events[0];

      // If user is logged in, check if they already spun
      if (user) {
        const { data: existingWins } = await supabase
          .from("sweepstakes_winners")
          .select("id")
          .eq("event_id", activeEvent.id)
          .eq("user_id", user.id);

        if (existingWins && existingWins.length >= activeEvent.max_spins_per_user) {
          setHasSpun(true);
          return;
        }
      }

      const { data: eventPrizes } = await supabase
        .from("sweepstakes_prizes")
        .select("id, name, description, icon, color, odds_weight, is_grand_prize, content_url")
        .eq("event_id", activeEvent.id);

      if (!eventPrizes || eventPrizes.length < 2) return;

      setEvent(activeEvent);
      setPrizes(eventPrizes);
    };

    checkSweepstakes();
  }, [user]);

  const selectPrize = useCallback(() => {
    const totalWeight = prizes.reduce((sum, p) => sum + p.odds_weight, 0);
    let random = Math.random() * totalWeight;
    for (const prize of prizes) {
      random -= prize.odds_weight;
      if (random <= 0) return prize;
    }
    return prizes[prizes.length - 1];
  }, [prizes]);

  const handleSpin = async () => {
    if (spinning || hasSpun || !event || !user) return;
    setSpinning(true);

    const winner = selectPrize();
    const prizeIndex = prizes.findIndex((p) => p.id === winner.id);
    const sliceAngle = 360 / prizes.length;
    const targetAngle = 360 - (prizeIndex * sliceAngle + sliceAngle / 2);
    const totalRotation = 360 * 8 + targetAngle;

    setRotation(totalRotation);

    setTimeout(async () => {
      setSpinning(false);
      setWonPrize(winner);
      setHasSpun(true);

      await supabase.from("sweepstakes_winners").insert({
        event_id: event.id,
        prize_id: winner.id,
        user_id: user.id,
      });
    }, 5000);
  };

  if (!event || prizes.length === 0) return null;

  const sliceAngle = 360 / prizes.length;

  return (
    <>
      {/* Floating Spin Button */}
      {!open && !hasSpun && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          onClick={() => setOpen(true)}
          className="fixed bottom-24 right-4 z-50 flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-orange-500 px-5 py-3 text-white font-bold shadow-[0_0_20px_rgba(255,89,16,0.5)] hover:shadow-[0_0_30px_rgba(255,89,16,0.7)] transition-shadow"
        >
          <Gift className="h-5 w-5 animate-bounce" />
          <span className="text-sm">Spin & Win!</span>
        </motion.button>
      )}

      <Dialog open={open} onOpenChange={(v) => !spinning && setOpen(v)}>
      <DialogContent className="sm:max-w-md border-primary/30 p-0 overflow-hidden" style={{ background: "linear-gradient(to bottom, #0a0a1a, #1a1a2e)" }}>
        {/* Header */}
        <div className="relative p-6 pb-2 text-center">
          <button
            onClick={() => !spinning && setOpen(false)}
            className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="flex items-center justify-center gap-2 mb-2">
            <Gift className="h-6 w-6 text-primary animate-bounce" />
            <h2 className="text-xl font-bold text-primary">🎰 SWEEPSTAKES</h2>
            <Gift className="h-6 w-6 text-primary animate-bounce" />
          </div>
          <p className="text-sm text-muted-foreground">{event.name}</p>
          {event.description && (
            <p className="text-xs text-muted-foreground/70 mt-1">{event.description}</p>
          )}
        </div>

        {/* Wheel */}
        <div className="flex flex-col items-center px-6 pb-6">
          <AnimatePresence mode="wait">
            {!wonPrize ? (
              <motion.div
                key="wheel"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative flex flex-col items-center"
              >
                {/* Pointer */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-20">
                  <div
                    className="drop-shadow-lg"
                    style={{
                      width: 0,
                      height: 0,
                      borderLeft: "14px solid transparent",
                      borderRight: "14px solid transparent",
                      borderTop: "24px solid #FF5910",
                      filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))",
                    }}
                  />
                </div>

                {/* Wheel container */}
                <motion.div
                  animate={{ rotate: rotation }}
                  transition={{ duration: 5, ease: [0.2, 0.8, 0.3, 1] }}
                  className="relative"
                  style={{ width: 300, height: 300 }}
                >
                  {/* Outer glow ring */}
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{
                      boxShadow: "0 0 30px 8px rgba(255,89,16,0.5), inset 0 0 15px rgba(255,89,16,0.2)",
                      border: "4px solid #FF5910",
                    }}
                  />

                  {/* Conic gradient wheel */}
                  <div
                    className="absolute inset-[4px] rounded-full overflow-hidden"
                    style={{
                      background: `conic-gradient(${prizes.map((_, i) => {
                        const color = SLICE_COLORS[i % SLICE_COLORS.length];
                        const start = (i / prizes.length) * 100;
                        const end = ((i + 1) / prizes.length) * 100;
                        return `${color} ${start}% ${end}%`;
                      }).join(", ")})`,
                    }}
                  />

                  {/* Slice divider lines */}
                  {prizes.map((_, i) => (
                    <div
                      key={`line-${i}`}
                      className="absolute top-1/2 left-1/2 origin-left"
                      style={{
                        width: "50%",
                        height: "2px",
                        background: "rgba(255,255,255,0.3)",
                        transform: `rotate(${i * sliceAngle}deg)`,
                        transformOrigin: "0% 50%",
                      }}
                    />
                  ))}

                  {/* Prize labels */}
                  {prizes.map((prize, i) => {
                    const angle = (i * sliceAngle + sliceAngle / 2) - 90;
                    const rad = (angle * Math.PI) / 180;
                    const labelRadius = 105;
                    const x = 150 + Math.cos(rad) * labelRadius;
                    const y = 150 + Math.sin(rad) * labelRadius;

                    return (
                      <div
                        key={prize.id}
                        className="absolute flex flex-col items-center justify-center text-center pointer-events-none"
                        style={{
                          left: x,
                          top: y,
                          transform: `translate(-50%, -50%) rotate(${angle + 90}deg)`,
                          width: 70,
                        }}
                      >
                        <span className="text-lg leading-none drop-shadow-md">{prize.icon}</span>
                        <span
                          className="text-[9px] font-bold leading-tight mt-0.5 drop-shadow-md"
                          style={{
                            color: "#ffffff",
                            textShadow: "0 1px 3px rgba(0,0,0,0.8)",
                          }}
                        >
                          {prize.name.length > 14 ? prize.name.slice(0, 12) + "…" : prize.name}
                        </span>
                      </div>
                    );
                  })}

                  {/* Center hub */}
                  <div
                    className="absolute rounded-full flex items-center justify-center z-10"
                    style={{
                      width: 54,
                      height: 54,
                      top: "50%",
                      left: "50%",
                      transform: "translate(-50%, -50%)",
                      background: "radial-gradient(circle, #2a2a4e, #1a1a2e)",
                      border: "3px solid #FF5910",
                      boxShadow: "0 0 12px rgba(255,89,16,0.6)",
                    }}
                  >
                    <span className="text-white font-bold text-xs tracking-wider">SPIN</span>
                  </div>
                </motion.div>

                <Button
                  onClick={handleSpin}
                  disabled={spinning || hasSpun}
                  className="mt-5 w-full font-bold text-lg py-3 hover:brightness-110 disabled:opacity-50"
                  style={{ background: "linear-gradient(to right, #FF5910, #FF8C42)" }}
                  size="lg"
                >
                  {spinning ? "🎰 Spinning..." : "🎯 SPIN THE WHEEL!"}
                </Button>
              </motion.div>
            ) : (
              <motion.div
                key="result"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", bounce: 0.5 }}
                className="text-center py-6"
              >
                <motion.div
                  animate={{ rotate: [0, -10, 10, -10, 10, 0] }}
                  transition={{ duration: 0.5 }}
                >
                  <PartyPopper className="h-16 w-16 mx-auto mb-4" style={{ color: "#facc15" }} />
                </motion.div>

                <h3 className="text-2xl font-bold text-primary mb-2">🎉 You Won! 🎉</h3>

                <div className="rounded-xl p-4 mb-4 border" style={{ background: "rgba(255,89,16,0.1)", borderColor: "rgba(255,89,16,0.3)" }}>
                  <p className="text-3xl mb-2">{wonPrize.icon}</p>
                  <p className="text-lg font-bold text-foreground">{wonPrize.name}</p>
                  {wonPrize.description && (
                    <p className="text-sm text-muted-foreground mt-1">{wonPrize.description}</p>
                  )}
                  {wonPrize.is_grand_prize && (
                    <div className="flex items-center justify-center gap-1 mt-2">
                      <Star className="h-4 w-4 fill-current" style={{ color: "#facc15" }} />
                      <span className="text-xs font-bold uppercase" style={{ color: "#facc15" }}>Grand Prize!</span>
                      <Star className="h-4 w-4 fill-current" style={{ color: "#facc15" }} />
                    </div>
                  )}
                </div>

                {wonPrize.content_url && (
                  <Button
                    onClick={() => window.location.href = wonPrize.content_url!}
                    className="w-full mb-2"
                    style={{ background: "linear-gradient(to right, #FF5910, #FF8C42)" }}
                  >
                    🎁 Claim Your Prize
                  </Button>
                )}

                <Button
                  variant="ghost"
                  onClick={() => setOpen(false)}
                  className="w-full text-muted-foreground"
                >
                  Close
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
};

export default SweepstakesWheel;
