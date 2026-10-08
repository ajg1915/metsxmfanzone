import { Suspense, useState } from "react";
import SEOHead from "@/components/SEOHead";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import LazySection from "@/components/LazySection";
import { Skeleton } from "@/components/ui/skeleton";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { useAuth } from "@/hooks/useAuth";
import { SHOW_METS_GAME_CENTER } from "@/config/season";

// Sections that used to sit on the home page. They live here now.
const HomeLineupCard = lazyWithRetry(() => import("@/components/HomeLineupCard"), "game-center-lineup-card");
const PlayersToWatch = lazyWithRetry(() => import("@/components/PlayersToWatch"), "game-center-players-to-watch");
const MetsStatsSection = lazyWithRetry(() => import("@/components/MetsStatsSection"), "game-center-mets-stats-section");
const RegularSeasonSeriesSection = lazyWithRetry(() => import("@/components/RegularSeasonSeriesSection"), "game-center-regular-season-series");
const SpringTrainingGamesSection = lazyWithRetry(() => import("@/components/SpringTrainingGamesSection"), "game-center-spring-training-games");
const ReplayGamesSection = lazyWithRetry(() => import("@/components/ReplayGamesSection"), "game-center-replay-games");

const SectionSkeleton = ({ height = "h-64" }: { height?: string }) => (
  <div className={`w-full ${height} px-4`}>
    <div className="container mx-auto max-w-7xl">
      <Skeleton className="mb-4 h-8 w-48" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    </div>
  </div>
);

const GameCenter = () => {
  const { user } = useAuth();
  const [lineupLoaded, setLineupLoaded] = useState(false);
  const [lineupGameDate, setLineupGameDate] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Mets Game Center — Lineups, Players to Watch, Stats & Replays"
        description="Everything for game day in one place: Mets lineups, players to watch, stats, series, Spring Training games and full-game replays."
        keywords="Mets game center, Mets lineup, Mets players to watch, Mets stats, Mets replays, Spring Training"
        canonical="https://metsxmfanzone.com/game-center"
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Game Center", url: "/game-center" },
        ]}
      />
      <Navigation />
      <main className="pt-12">
        <div className="container mx-auto max-w-7xl px-4 pb-2 pt-8 sm:px-6 lg:px-8">
          <h1 className="font-display text-4xl font-bold uppercase tracking-wide text-foreground sm:text-5xl">
            Game Center
          </h1>
          <p className="mt-2 max-w-2xl text-base text-muted-foreground">
            Lineups, players to watch, stats, series and replays in one place.
          </p>
        </div>

        {SHOW_METS_GAME_CENTER && (
          <LazySection fallback={<SectionSkeleton height="h-48" />}>
            <Suspense fallback={<SectionSkeleton height="h-48" />}>
              <HomeLineupCard
                onLineupLoaded={(gameDate) => {
                  setLineupLoaded(true);
                  setLineupGameDate(gameDate ?? null);
                }}
              />
            </Suspense>
          </LazySection>
        )}

        {/* With the Game Center hidden, predictions still show (NY team picks in the off-season). */}
        {(lineupLoaded || !SHOW_METS_GAME_CENTER) && (
          <LazySection fallback={<SectionSkeleton />}>
            <Suspense fallback={<SectionSkeleton />}>
              <PlayersToWatch lineupGameDate={lineupGameDate} />
            </Suspense>
          </LazySection>
        )}

        {user && (
          <LazySection fallback={<SectionSkeleton />}>
            <Suspense fallback={<SectionSkeleton />}>
              <MetsStatsSection />
            </Suspense>
          </LazySection>
        )}

        <LazySection fallback={<SectionSkeleton />}>
          <Suspense fallback={<SectionSkeleton />}>
            <RegularSeasonSeriesSection />
          </Suspense>
        </LazySection>

        <LazySection fallback={<SectionSkeleton />}>
          <Suspense fallback={<SectionSkeleton />}>
            <SpringTrainingGamesSection />
          </Suspense>
        </LazySection>

        <LazySection fallback={<SectionSkeleton />}>
          <Suspense fallback={<SectionSkeleton />}>
            <ReplayGamesSection />
          </Suspense>
        </LazySection>
      </main>
      <Footer />
    </div>
  );
};

export default GameCenter;
