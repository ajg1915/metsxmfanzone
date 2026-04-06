import { useState, useEffect, useRef, useCallback } from "react";
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

const WHEEL_COLORS = [
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const checkedRef = useRef(false);

  // Check for active sweepstakes on login
  useEffect(() => {
    if (!user || checkedRef.current) return;
    checkedRef.current = true;

    const checkSweepstakes = async () => {
      // Check for active events
      const { data: events } = await supabase
        .from("sweepstakes_events")
        .select("id, name, description, max_spins_per_user")
        .eq("is_active", true)
        .lte("start_time", new Date().toISOString())
        .gte("end_time", new Date().toISOString())
        .limit(1);

      if (!events || events.length === 0) return;

      const activeEvent = events[0];

      // Check if user already spun
      const { data: existingWins } = await supabase
        .from("sweepstakes_winners")
        .select("id")
        .eq("event_id", activeEvent.id)
        .eq("user_id", user.id);

      if (existingWins && existingWins.length >= activeEvent.max_spins_per_user) return;

      // Get prizes
      const { data: eventPrizes } = await supabase
        .from("sweepstakes_prizes")
        .select("id, name, description, icon, color, odds_weight, is_grand_prize, content_url")
        .eq("event_id", activeEvent.id);

      if (!eventPrizes || eventPrizes.length < 2) return;

      setEvent(activeEvent);
      setPrizes(eventPrizes);

      // Small delay before showing
      setTimeout(() => setOpen(true), 2000);
    };

    checkSweepstakes();
  }, [user]);

  // Draw wheel on canvas
  useEffect(() => {
    if (!canvasRef.current || prizes.length === 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const size = 380;
    canvas.width = size * 2;
    canvas.height = size * 2;
    ctx.scale(2, 2); // retina

    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size / 2 - 12;
    const sliceAngle = (2 * Math.PI) / prizes.length;

    // Outer ring glow
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius + 6, 0, 2 * Math.PI);
    ctx.strokeStyle = "#FF5910";
    ctx.lineWidth = 4;
    ctx.shadowColor = "#FF5910";
    ctx.shadowBlur = 15;
    ctx.stroke();
    ctx.shadowBlur = 0;

    prizes.forEach((prize, i) => {
      const startAngle = i * sliceAngle;
      const endAngle = startAngle + sliceAngle;

      // Draw slice
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = WHEEL_COLORS[i % WHEEL_COLORS.length];
      ctx.fill();
      ctx.strokeStyle = "#ffffff33";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw text
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(startAngle + sliceAngle / 2);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const text = prize.icon + " " + prize.name;
      const displayText = text.length > 18 ? text.slice(0, 16) + "…" : text;
      ctx.fillText(displayText, radius * 0.58, 0);
      ctx.restore();
    });

    // Center circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, 28, 0, 2 * Math.PI);
    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 28);
    gradient.addColorStop(0, "#2a2a4e");
    gradient.addColorStop(1, "#1a1a2e");
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.strokeStyle = "#FF5910";
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("SPIN", centerX, centerY);
  }, [prizes]);

  const selectPrize = useCallback(() => {
    // Weighted random selection
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

    // Calculate rotation to land on prize (pointer at top = 270deg offset)
    const targetAngle = 360 - (prizeIndex * sliceAngle + sliceAngle / 2);
    const totalRotation = 360 * 8 + targetAngle; // 8 full spins + target

    setRotation(totalRotation);

    // Wait for spin animation
    setTimeout(async () => {
      setSpinning(false);
      setWonPrize(winner);
      setHasSpun(true);

      // Record win
      await supabase.from("sweepstakes_winners").insert({
        event_id: event.id,
        prize_id: winner.id,
        user_id: user.id,
      });
    }, 5000);
  };

  if (!event || prizes.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !spinning && setOpen(v)}>
      <DialogContent className="sm:max-w-md bg-gradient-to-b from-[#0a0a1a] to-[#1a1a2e] border-primary/30 p-0 overflow-hidden">
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
                className="relative"
              >
                {/* Pointer */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-10">
                  <div className="w-0 h-0 border-l-[12px] border-r-[12px] border-t-[20px] border-l-transparent border-r-transparent border-t-primary drop-shadow-lg" />
                </div>

                <motion.div
                  animate={{ rotate: rotation }}
                  transition={{ duration: 5, ease: [0.2, 0.8, 0.3, 1] }}
                  className="w-[150px] h-[150px] sm:w-[200px] sm:h-[200px]"
                >
                  <canvas
                    ref={canvasRef}
                    className="w-full h-full rounded-full shadow-[0_0_30px_rgba(255,89,16,0.3)]"
                  />
                </motion.div>

                <Button
                  onClick={handleSpin}
                  disabled={spinning || hasSpun}
                  className="mt-4 w-full bg-gradient-to-r from-primary to-orange-500 text-white font-bold text-lg py-3 hover:brightness-110 disabled:opacity-50"
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
                  <PartyPopper className="h-16 w-16 text-yellow-400 mx-auto mb-4" />
                </motion.div>

                <h3 className="text-2xl font-bold text-primary mb-2">
                  🎉 You Won! 🎉
                </h3>

                <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 mb-4">
                  <p className="text-3xl mb-2">{wonPrize.icon}</p>
                  <p className="text-lg font-bold text-foreground">{wonPrize.name}</p>
                  {wonPrize.description && (
                    <p className="text-sm text-muted-foreground mt-1">{wonPrize.description}</p>
                  )}
                  {wonPrize.is_grand_prize && (
                    <div className="flex items-center justify-center gap-1 mt-2">
                      <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                      <span className="text-xs font-bold text-yellow-400 uppercase">Grand Prize!</span>
                      <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                    </div>
                  )}
                </div>

                {wonPrize.content_url && (
                  <Button
                    onClick={() => window.location.href = wonPrize.content_url!}
                    className="w-full bg-gradient-to-r from-primary to-orange-500 mb-2"
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
  );
};

export default SweepstakesWheel;
