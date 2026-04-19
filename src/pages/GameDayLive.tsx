import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Lock, Sparkles, Radio } from "lucide-react";
import { GameDayVoiceRooms } from "@/components/gameday/GameDayVoiceRooms";
import { ScheduledShowsSection } from "@/components/radio/ScheduledShowsSection";
import { SocialWallSection } from "@/components/radio/SocialWallSection";
import { CreateRoomDialog } from "@/components/radio/CreateRoomDialog";
import StoriesSection from "@/components/StoriesSection";
import BlogSection from "@/components/BlogSection";
import { TikTokLiveBanner } from "@/components/radio/TikTokLiveBanner";

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
          title="MetsXMFanZone Radio Network | Premium Voice Rooms & Live Shows"
          description="Live voice rooms, scheduled podcast shows, and the social hub for MetsXMFanZone premium members."
        />
        <Navigation />
        <div className="container mx-auto px-4 pt-20 pb-16 max-w-2xl text-center">
          <Lock className="w-12 h-12 mx-auto text-primary mb-4" />
          <h1 className="text-3xl font-bold mb-3">MetsXMFanZone Radio Network</h1>
          <p className="text-muted-foreground mb-6">
            Sign in to join voice rooms, catch scheduled shows, and connect with fans.
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
          title="MetsXMFanZone Radio Network | Premium Members Only"
          description="The Radio Network is for premium members. Voice rooms, live shows, and more."
        />
        <Navigation />
        <div className="container mx-auto px-4 pt-20 pb-16 max-w-2xl text-center">
          <Sparkles className="w-12 h-12 mx-auto text-primary mb-4" />
          <h1 className="text-3xl font-bold mb-3">Radio Network is for Premium Members</h1>
          <p className="text-muted-foreground mb-6">
            Join voice rooms, listen to live podcast shows, and tap into the MetsXMFanZone hub.
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
        title="MetsXMFanZone Radio Network | Live Voice Rooms & Podcast Shows"
        description="Live voice rooms, scheduled podcast shows, and the social hub for the MetsXMFanZone Radio Network."
      />
      <Navigation />

      <div className="container mx-auto px-3 sm:px-4 pt-20 sm:pt-24 pb-8 max-w-3xl space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
            <Radio className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">
              MetsXMFanZone Radio Network
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Live voice rooms, scheduled podcast shows, and the social hub for true Mets fans.
            </p>
          </div>
        </div>

        <TikTokLiveBanner />

        <ScheduledShowsSection />

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm">Voice Rooms</h2>
            <CreateRoomDialog />
          </div>
          <GameDayVoiceRooms />
        </div>

        <StoriesSection />

        <BlogSection />

        <SocialWallSection />
      </div>

      <Footer />
    </div>
  );
};

export default GameDayLive;
