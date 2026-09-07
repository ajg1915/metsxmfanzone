import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getTodayET } from "@/utils/dateUtils";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router-dom";
import { Sparkles, Lock, ArrowRight } from "lucide-react";

const PredictionsSection = () => {
  const { user } = useAuth();

  const { data: predictions } = useQuery({
    queryKey: ["todays-predictions"],
    queryFn: async () => {
      const todayStr = getTodayET();
      const { data, error } = await supabase
        .from("daily_player_predictions")
        .select("*")
        .eq("prediction_date", todayStr)
        .order("confidence", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
    staleTime: 3 * 60 * 1000,
  });

  if (!predictions || predictions.length === 0) return null;

  return (
    <section className="py-4 lg:py-8">
      <div className="container mx-auto px-3 lg:px-4 max-w-5xl">
        <div className="flex items-center gap-2 mb-3 lg:mb-5">
          <div className="w-1 h-5 lg:h-6 rounded-full bg-secondary" />
          <h2 className="text-lg lg:text-2xl font-black uppercase tracking-wide flex items-center gap-2">
            <Sparkles className="w-4 h-4 lg:w-5 lg:h-5 text-secondary" />
            Anthony's Predictions
          </h2>
        </div>

        {!user ? (
          <div className="relative rounded-2xl overflow-hidden">
            <div className="space-y-1.5 blur-sm pointer-events-none select-none p-2">
              {predictions.slice(0, 3).map((pred: any) => (
                <div key={pred.id} className="flex items-center gap-2 p-2 rounded-xl bg-secondary/5 border border-secondary/15">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[11px] truncate">{pred.player_name}</p>
                    <p className="text-[9px] text-muted-foreground truncate">{pred.description}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/60 backdrop-blur-[2px]">
              <Lock className="w-6 h-6 text-secondary mb-1.5" />
              <p className="text-[11px] font-bold text-foreground">Sign in to unlock</p>
              <Link to="/auth" className="text-[10px] text-secondary hover:text-secondary/80 font-semibold mt-1 transition-colors">
                Log In →
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            {predictions.map((pred: any) => (
              <div key={pred.id} className="flex items-center gap-2 p-2.5 rounded-xl bg-secondary/5 border border-secondary/15 hover:border-secondary/30 transition-all">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-xs lg:text-sm truncate">{pred.player_name}</p>
                  <p className="text-[10px] lg:text-xs text-muted-foreground truncate">{pred.description}</p>
                </div>
                {pred.confidence && (
                  <span className="text-[10px] font-bold text-secondary bg-secondary/10 px-1.5 py-0.5 rounded-md shrink-0">
                    {pred.confidence}%
                  </span>
                )}
              </div>
            ))}
            <Link to="/mets-lineup-card" className="flex items-center justify-center gap-1 text-[10px] lg:text-xs text-secondary hover:text-secondary/80 font-bold pt-1 transition-colors">
              View All Predictions <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
};

export default PredictionsSection;
