import { Button } from "@/components/ui/button";
import { Check, Crown } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { useNavigate } from "react-router-dom";
import GlassCard from "@/components/GlassCard";

const AppInstallSection = () => {
  const { user } = useAuth();
  const { isPremium, loading } = useSubscription();
  const navigate = useNavigate();

  // Don't show for premium/annual members or while loading
  if (loading) return null;
  if (user && isPremium) return null;

  return (
    <section className="py-10 sm:py-12 md:py-16 px-4 relative overflow-hidden">
      <div className="container max-w-6xl mx-auto px-0 sm:px-4 relative z-10">
        <GlassCard glow="blue" className="p-6 sm:p-8 md:p-10">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/20 text-primary font-bold text-sm mb-4">
            <Crown className="h-4 w-4" /> PREMIUM MEMBERSHIP
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4">
            Join for Only <span className="text-primary">$9.99/month</span>
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base max-w-2xl mx-auto mb-4">
            Get unlimited access to all streams with no ads, no providers, and live 24/7 content
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 text-sm mb-6">
            <span className="flex items-center gap-1.5 text-foreground/80">
              <Check className="h-4 w-4 text-green-500" /> All Live Streams
            </span>
            <span className="flex items-center gap-1.5 text-foreground/80">
              <Check className="h-4 w-4 text-green-500" /> No Ads
            </span>
            <span className="flex items-center gap-1.5 text-foreground/80">
              <Check className="h-4 w-4 text-green-500" /> No Providers
            </span>
            <span className="flex items-center gap-1.5 text-foreground/80">
              <Check className="h-4 w-4 text-green-500" /> 24/7 Live Content
            </span>
          </div>
          <Button 
            onClick={() => navigate("/pricing")}
            size="lg"
            className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-bold px-8 shadow-lg shadow-primary/30 hover:shadow-primary/50 transition-all duration-300"
          >
            <Crown className="h-5 w-5" />
            View Pricing
          </Button>
        </div>
        </GlassCard>
      </div>
    </section>
  );
};

export default AppInstallSection;
