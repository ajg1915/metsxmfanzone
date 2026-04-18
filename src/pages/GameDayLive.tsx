import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Lock, Sparkles, Volume2, VolumeX } from "lucide-react";
import { ClapprPlayer } from "@/components/ClapprPlayer";
import { GameDayChat } from "@/components/gameday/GameDayChat";
import { GameDayReactions } from "@/components/gameday/GameDayReactions";
import { GameDayPolls } from "@/components/gameday/GameDayPolls";
import { GameDayLeaderboard } from "@/components/gameday/GameDayLeaderboard";
import { GameDayVoiceRooms } from "@/components/gameday/GameDayVoiceRooms";
import { GameDayAnnouncements } from "@/components/gameday/GameDayAnnouncements";

const STADIUM_AMBIENCE_URL =
  "https://cdn.pixabay.com/audio/2022/03/15/audio_1c9b7ec4b8.mp3"; // generic crowd noise loop

const GameDayLive = () => {
  const { user, loading: authLoading } = useAuth();
  const { isPremium, loading: subLoading } = useSubscription();
  const [ambienceOn, setAmbienceOn] = useState(false);
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null);

  useEffect(() => {
    const a = new Audio(STADIUM_AMBIENCE_URL);
    a.loop = true;
    a.volume = 0.15;
    setAudioEl(a);
    return () => {
      a.pause();
      a.src = "";
    };
  }, []);

  useEffect(() => {
    if (!audioEl) return;
    if (ambienceOn) {
      audioEl.play().catch(() => setAmbienceOn(false));
    } else {
      audioEl.pause();
    }
  }, [ambienceOn, audioEl]);

  const loading = authLoading || subLoading;

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-8 space-y-4">
          <Skeleton className="h-12 w-1/2" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  // Gate: not signed in
  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <SEOHead
          title="Game Day Live | Watch Party for Premium Members"
          description="Join Mets fans in real-time. Live reactions, prediction polls, voice rooms, and premium chat — only for paid members."
        />
        <Navigation />
        <div className="container mx-auto px-4 py-16 max-w-2xl text-center">
          <Lock className="w-12 h-12 mx-auto text-primary mb-4" />
          <h1 className="text-3xl font-bold mb-3">Game Day Live</h1>
          <p className="text-muted-foreground mb-6">
            Sign in to join the watch party with other premium fans.
          </p>
          <div className="flex gap-2 justify-center">
            <Button asChild>
              <Link to="/auth">Sign In</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/pricing">View Plans</Link>
            </Button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // Gate: not premium
  if (!isPremium) {
    return (
      <div className="min-h-screen bg-background">
        <SEOHead
          title="Game Day Live | Premium Members Only"
          description="Upgrade to access Game Day Live — voice rooms, live reactions, and prediction polls during every Mets game."
        />
        <Navigation />
        <div className="container mx-auto px-4 py-16 max-w-2xl text-center">
          <Sparkles className="w-12 h-12 mx-auto text-primary mb-4" />
          <h1 className="text-3xl font-bold mb-3">Game Day Live is for Premium Members</h1>
          <p className="text-muted-foreground mb-6">
            Voice rooms, live reactions, prediction polls, and exclusive chat — all in one place
            during every game.
          </p>
          <Button asChild size="lg">
            <Link to="/pricing">Upgrade to Premium</Link>
          </Button>
        </div>
        <Footer />
      </div>
    );
  }

  // Premium experience
  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Game Day Live | MetsXMFanZone Watch Party"
        description="Live watch party for Mets premium members — voice rooms, reactions, polls, and chat."
      />
      <Navigation />

      <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              Game Day Live
            </h1>
            <p className="text-sm text-muted-foreground">
              The premium watch party. Make some noise.
            </p>
          </div>
          <Button
            variant={ambienceOn ? "default" : "outline"}
            size="sm"
            onClick={() => setAmbienceOn((v) => !v)}
            className="text-xs"
          >
            {ambienceOn ? <Volume2 className="w-4 h-4 mr-1.5" /> : <VolumeX className="w-4 h-4 mr-1.5" />}
            Stadium {ambienceOn ? "On" : "Off"}
          </Button>
        </div>

        <GameDayAnnouncements />

        {/* Main grid: stream + sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Stream + reactions */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="overflow-hidden border-border bg-card/50 backdrop-blur-sm">
              <div className="relative">
                <ClapprPlayer
                  pageTitle="Game Day Live"
                  pageDescription="The premium watch party"
                />
                <GameDayReactions />
              </div>
            </Card>

            {/* Polls under the stream on desktop, full width on mobile */}
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Polls & Predictions
              </h2>
              <GameDayPolls />
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto lg:pr-1">
            <GameDayVoiceRooms />
            <div className="h-[400px] lg:h-[500px]">
              <GameDayChat />
            </div>
            <GameDayLeaderboard />
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default GameDayLive;
