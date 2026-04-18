import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Lock, Sparkles, Mic } from "lucide-react";
import { GameDayVoiceRooms } from "@/components/gameday/GameDayVoiceRooms";

const GameDayLive = () => {
  const { user, loading: authLoading } = useAuth();
  const { isPremium, loading: subLoading } = useSubscription();

  const loading = authLoading || subLoading;

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 pt-20 pb-8 space-y-4">
          <Skeleton className="h-12 w-1/2" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <SEOHead
          title="Game Day Live Voice Rooms | Premium Members Only"
          description="Join Mets fans in live voice rooms. Premium members only."
        />
        <Navigation />
        <div className="container mx-auto px-4 pt-20 pb-16 max-w-2xl text-center">
          <Lock className="w-12 h-12 mx-auto text-primary mb-4" />
          <h1 className="text-3xl font-bold mb-3">Game Day Live</h1>
          <p className="text-muted-foreground mb-6">
            Sign in to join the voice rooms with other premium fans.
          </p>
          <div className="flex gap-2 justify-center">
            <Button asChild>
              <Link to="/auth">Sign In</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/pricing">View Plans</Link>
            </Button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!isPremium) {
    return (
      <div className="min-h-screen bg-background">
        <SEOHead
          title="Game Day Live Voice Rooms | Premium Members Only"
          description="Voice rooms for premium members during every Mets game."
        />
        <Navigation />
        <div className="container mx-auto px-4 pt-20 pb-16 max-w-2xl text-center">
          <Sparkles className="w-12 h-12 mx-auto text-primary mb-4" />
          <h1 className="text-3xl font-bold mb-3">Voice Rooms are for Premium Members</h1>
          <p className="text-muted-foreground mb-6">
            Hop into live voice rooms with fellow Mets fans during every game.
          </p>
          <Button asChild size="lg">
            <Link to="/pricing">Upgrade to Premium</Link>
          </Button>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Game Day Live Voice Rooms | MetsXMFanZone"
        description="Live voice rooms for Mets premium members. Join the conversation."
      />
      <Navigation />

      <div className="container mx-auto px-3 sm:px-4 pt-16 sm:pt-20 pb-8 max-w-3xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center">
            <Mic className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              Voice Rooms
            </h1>
            <p className="text-sm text-muted-foreground">
              Drop into a room and talk Mets baseball with other premium fans.
            </p>
          </div>
        </div>

        <GameDayVoiceRooms />
      </div>

      <Footer />
    </div>
  );
};

export default GameDayLive;
