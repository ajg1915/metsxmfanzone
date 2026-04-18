import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const EMOJIS = ["⚾", "🔥", "🧡", "👏", "😱", "🎉", "💪", "⚡"];

interface FloatingReaction {
  id: string;
  emoji: string;
  left: number;
  duration: number;
}

export function GameDayReactions() {
  const { user } = useAuth();
  const [floating, setFloating] = useState<FloatingReaction[]>([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const channel = supabase
      .channel("gameday_reactions_live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "gameday_reactions" },
        (payload) => {
          const r = payload.new as { id: string; emoji: string };
          const newReaction: FloatingReaction = {
            id: r.id,
            emoji: r.emoji,
            left: 5 + Math.random() * 85,
            duration: 3000 + Math.random() * 1500,
          };
          setFloating((prev) => [...prev, newReaction]);
          setTimeout(() => {
            setFloating((prev) => prev.filter((f) => f.id !== newReaction.id));
          }, newReaction.duration);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const send = async (emoji: string) => {
    if (!user || sending) return;
    setSending(true);
    await supabase.from("gameday_reactions").insert({ user_id: user.id, emoji });
    setTimeout(() => setSending(false), 200);
  };

  return (
    <>
      {/* Floating overlay */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {floating.map((f) => (
          <span
            key={f.id}
            className="absolute bottom-0 text-3xl sm:text-4xl select-none"
            style={{
              left: `${f.left}%`,
              animation: `gameday-float ${f.duration}ms ease-out forwards`,
            }}
          >
            {f.emoji}
          </span>
        ))}
      </div>
      {/* Buttons */}
      <div className="absolute bottom-3 right-3 flex flex-wrap gap-1.5 z-10 max-w-[60%] justify-end">
        {EMOJIS.map((e) => (
          <button
            key={e}
            onClick={() => send(e)}
            disabled={!user || sending}
            className={cn(
              "w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-background/70 backdrop-blur-md border border-border",
              "flex items-center justify-center text-lg sm:text-xl",
              "hover:scale-110 hover:bg-primary/20 transition-all active:scale-95",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
            aria-label={`React with ${e}`}
          >
            {e}
          </button>
        ))}
      </div>
      <style>{`
        @keyframes gameday-float {
          0% { transform: translateY(0) scale(0.5); opacity: 0; }
          10% { transform: translateY(-10vh) scale(1); opacity: 1; }
          100% { transform: translateY(-90vh) scale(1.2); opacity: 0; }
        }
      `}</style>
    </>
  );
}
