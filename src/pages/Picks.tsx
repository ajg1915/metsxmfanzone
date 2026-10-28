import { Suspense, useState } from "react";
import { Link } from "react-router-dom";
import { Mic, ShieldAlert } from "lucide-react";
import SEOHead from "@/components/SEOHead";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import LazySection from "@/components/LazySection";
import { Skeleton } from "@/components/ui/skeleton";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { SHOW_METS_GAME_CENTER } from "@/config/season";

// Everything here is reused from the Game Center, so a change there shows up here too.
const HomeLineupCard = lazyWithRetry(() => import("@/components/HomeLineupCard"), "picks-lineup-card");
const PlayersToWatch = lazyWithRetry(() => import("@/components/PlayersToWatch"), "picks-players-to-watch");
const PodcastRadioSection = lazyWithRetry(() => import("@/components/PodcastRadioSection"), "picks-podcast");

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

const Picks = () => {
  const [lineupLoaded, setLineupLoaded] = useState(false);
  const [lineupGameDate, setLineupGameDate] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Mets Picks & Predictions — Today's Game, Lineup and Podcast Review | MetsXMFanZone"
        description="Anthony's Mets picks and predictions before every game, with the lineup, the matchup and the podcast review, all in one place."
        keywords="Mets picks, Mets predictions, Mets player props, Mets lineup, Mets podcast"
        canonical="https://metsxmfanzone.com/picks"
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Picks", url: "/picks" },
        ]}
      />
      <Navigation />
      <main className="pt-12">
        <div className="container mx-auto max-w-7xl px-4 pb-2 pt-8 sm:px-6 lg:px-8">
          <h1 className="font-display text-4xl font-bold uppercase tracking-wide text-foreground sm:text-5xl">
            Picks <span className="text-primary">&amp; Predictions</span>
          </h1>
          <p className="mt-2 max-w-2xl text-base text-muted-foreground">
            See what Anthony is picking before game time, with the game, the lineup and the podcast review in one place.
          </p>
          <p className="mt-3 inline-flex max-w-2xl items-start gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              For entertainment only. These are opinions, not guarantees, and MetsXMFanZone is not a sportsbook. 21+ where
              applicable. Problem gambling? Call 1-800-GAMBLER.{" "}
              <Link to="/responsible-gambling" className="text-primary underline underline-offset-2">
                Read our disclosure
              </Link>
              .
            </span>
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

        {/* Swipeable pick cards. In the off-season they show the NY team picks instead. */}
        {(lineupLoaded || !SHOW_METS_GAME_CENTER) && (
          <LazySection fallback={<SectionSkeleton />}>
            <Suspense fallback={<SectionSkeleton />}>
              <PlayersToWatch lineupGameDate={lineupGameDate} />
            </Suspense>
          </LazySection>
        )}

        <div className="container mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
          <h2 className="flex items-center gap-2 font-display text-2xl font-bold uppercase tracking-wide text-foreground sm:text-3xl">
            <Mic className="h-6 w-6 text-primary" /> Podcast Review
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Hear the breakdown of the games and the picks.</p>
        </div>
        <LazySection fallback={<SectionSkeleton height="h-80" />}>
          <Suspense fallback={<SectionSkeleton height="h-80" />}>
            <PodcastRadioSection />
          </Suspense>
        </LazySection>
      </main>
      <Footer />
    </div>
  );
};

export default Picks;
