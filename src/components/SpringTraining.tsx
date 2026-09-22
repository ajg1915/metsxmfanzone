import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Calendar, ChevronRight, Play } from "lucide-react";

import GlassCard from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import PremiumBadge from "@/components/PremiumBadge";
import { useSubscription } from "@/hooks/useSubscription";

import springAstros from "@/assets/spring-mets-astros.jpg";
import springBraves from "@/assets/spring-mets-braves.jpg";
import springCards from "@/assets/spring-mets-cards.jpg";
import springNats from "@/assets/spring-mets-nats.jpg";
import springRedsox from "@/assets/spring-mets-redsox.jpg";
import springYankees from "@/assets/spring-mets-yankees.jpg";
import springDefault from "@/assets/spring-training.jpg";

const getFallbackImage = (opponent: string): string => {
  const name = opponent.toLowerCase();
  if (name.includes("astros") || name.includes("houston")) return springAstros;
  if (name.includes("braves") || name.includes("atlanta")) return springBraves;
  if (name.includes("cardinal") || name.includes("stl")) return springCards;
  if (name.includes("national") || name.includes("washington")) return springNats;
  if (name.includes("red sox") || name.includes("boston")) return springRedsox;
  if (name.includes("yankee") || name.includes("new york")) return springYankees;
  return springDefault;
};

interface SpringTrainingProps {
  className?: string;
}

export default function SpringTraining({ className }: SpringTrainingProps) {
  const { tier, isAdmin } = useSubscription();
  const isPremium = isAdmin || tier === "weekly" || tier === "premium" || tier === "annual";
  
  const { data: games, isLoading } = useQuery({
    queryKey: ["spring-training-games"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("spring_training_games")
        .select("*")
        .eq("published", true)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data;
    }
  });

  return (
    <section className="py-8 sm:py-10 md:py-12 relative overflow-hidden">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl relative z-10">
        <div className="flex flex-col gap-2 mb-4 sm:mb-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
            <h2 className="font-bold text-sm sm:text-base md:text-lg lg:text-xl text-foreground whitespace-nowrap">
                Regular Season Games
              </h2>
              {!isPremium && <PremiumBadge size="sm" noGlow />}
            </div>
          </div>
          <p className="text-muted-foreground text-[10px] sm:text-xs">
            Watch the 2026 Mets regular season
          </p>
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="aspect-video bg-muted/50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : games && games.length > 0 ? (
          <div className="grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {games.slice(0, 6).map((game, index) => {
              const opponentSlug = game.opponent.toLowerCase().replace(/\s+/g, '').replace('st.louis', 'cardinals').replace('houston', 'astros').replace('atlanta', 'braves').replace('washington', 'nationals').replace('boston', 'redsox').replace('newyork', 'yankees');
              return (
              <Link key={game.id} to={`/matchup/${opponentSlug}`}>
                <GlassCard
                  variant="interactive"
                  glow="blue"
                  delay={index * 0.08}
                  className="group aspect-video overflow-hidden"
                >
                  <div className="relative w-full h-full">
                    <img 
                      src={game.preview_image_url || getFallbackImage(game.opponent)} 
                      alt={`Mets vs ${game.opponent}`} 
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
                    
                    {/* Premium badge for non-members */}
                    {!isPremium && (
                      <PremiumBadge variant="corner" size="sm" noGlow />
                    )}
                    
                    {/* Play button overlay */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-primary/90 backdrop-blur-sm flex items-center justify-center shadow-lg shadow-primary/30">
                        <Play className="w-5 h-5 sm:w-6 sm:h-6 text-primary-foreground ml-0.5" />
                      </div>
                    </div>
                    
                    {/* Content */}
                    <div className="absolute bottom-0 left-0 right-0 p-1.5 sm:p-2 md:p-3">
                      <h3 className="text-[10px] sm:text-xs md:text-sm font-bold text-white mb-0.5 truncate drop-shadow-lg">
                        vs {game.opponent}
                      </h3>
                      <p className="text-[8px] sm:text-[10px] md:text-xs text-white/90 drop-shadow">Spring Training</p>
                    </div>
                  </div>
                </GlassCard>
              </Link>
            );})}
          </div>
        ) : (
          <GlassCard variant="default" glow="blue" className="p-6 text-center">
            <p className="text-muted-foreground">No spring training games scheduled yet.</p>
          </GlassCard>
        )}
        
        {games && games.length > 0 && (
          <div className="flex justify-center mt-4">
            <Button 
              variant="outline" 
              asChild
              size="sm"
              className="text-xs sm:text-sm glass-card border-border/30 hover:border-primary/50"
            >
              <Link to="/mets-schedule-2026">
                See Matchup Overview
              </Link>
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
