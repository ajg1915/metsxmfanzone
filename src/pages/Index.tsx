import { lazy, Suspense, useState } from "react";
import SEOHead from "@/components/SEOHead";
import Navigation from "@/components/Navigation";
import Hero from "@/components/Hero";

import Footer from "@/components/Footer";
import { Skeleton } from "@/components/ui/skeleton";
import LazySection from "@/components/LazySection";

import { useAuth } from "@/hooks/useAuth";

// Lazy load heavy components that are below the fold
const ImmersiveBackground = lazy(() => import("@/components/ImmersiveBackground"));
const FreeTrialExpiryBanner = lazy(() => import("@/components/FreeTrialExpiryBanner"));
const LiveNetworks = lazy(() => import("@/components/LiveNetworks"));
const LiveStreamsSection = lazy(() => import("@/components/LiveStreamsSection"));
const SpringTrainingGamesSection = lazy(() => import("@/components/SpringTrainingGamesSection"));
const GameHighlightsSection = lazy(() => import("@/components/GameHighlightsSection"));
const ReplayGamesSection = lazy(() => import("@/components/ReplayGamesSection"));
const PlayerOfTheMonthSection = lazy(() => import("@/components/PlayerOfTheMonthSection"));
const PlayersToWatch = lazy(() => import("@/components/PlayersToWatch"));
const RegularSeasonSeriesSection = lazy(() => import("@/components/RegularSeasonSeriesSection"));

const BlogSection = lazy(() => import("@/components/BlogSection"));
const HomeLineupCard = lazy(() => import("@/components/HomeLineupCard"));
const PodcastSection = lazy(() => import("@/components/PodcastSection"));
const JoinPodcastSection = lazy(() => import("@/components/JoinPodcastSection"));
const HotStoveGuide = lazy(() => import("@/components/HotStoveGuide"));
const StoriesSection = lazy(() => import("@/components/StoriesSection"));
const GamecastBanner = lazy(() => import("@/components/GamecastBanner"));
const FAQSection = lazy(() => import("@/components/FAQSection"));
const TestimonialsSection = lazy(() => import("@/components/TestimonialsSection"));
const AppInstallSection = lazy(() => import("@/components/AppInstallSection"));
const CommunityPreviewSection = lazy(() => import("@/components/CommunityPreviewSection"));
const InstallPrompt = lazy(() => import("@/components/InstallPrompt"));
const OnboardingWalkthrough = lazy(() => import("@/components/OnboardingWalkthrough"));
const NotificationPrompt = lazy(() => import("@/components/NotificationPrompt"));
const ToastPoll = lazy(() => import("@/components/ToastPoll"));
const PopupNotification = lazy(() => import("@/components/PopupNotification"));


// Section loading skeleton
const SectionSkeleton = ({ height = "h-64" }: { height?: string }) => (
  <div className={`w-full ${height} px-4`}>
    <div className="container mx-auto max-w-7xl">
      <Skeleton className="h-8 w-48 mb-4" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    </div>
  </div>
);

// Homepage structured data with AEO optimization
const homepageSchema = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  "@id": "https://www.metsxmfanzone.com/#webpage",
  url: "https://www.metsxmfanzone.com/",
  name: "MetsXMFanZone - The Ultimate Destination Where the Fans Go",
  description:
    "The ultimate Mets fan community. Watch live game streams, highlights, podcasts, and exclusive Mets coverage. Join thousands of passionate New York Mets fans.",
  isPartOf: {
    "@id": "https://www.metsxmfanzone.com/#website",
  },
  about: {
    "@type": "SportsTeam",
    name: "New York Mets",
    sport: "Baseball",
    memberOf: {
      "@type": "SportsOrganization",
      name: "Major League Baseball",
    },
  },
  primaryImageOfPage: {
    "@type": "ImageObject",
    url: "https://www.metsxmfanzone.com/og-image.png",
  },
  speakable: {
    "@type": "SpeakableSpecification",
    cssSelector: ["h1", ".hero-description", "section h2"],
  },
};

// AEO: Organization Schema for AI assistants
const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "https://www.metsxmfanzone.com/#organization",
  name: "MetsXMFanZone",
  alternateName: "MetsXMFanZone",
  url: "https://www.metsxmfanzone.com",
  logo: "https://www.metsxmfanzone.com/logo-512.png",
  description: "The ultimate fan-created platform for New York Mets fans featuring live streams, podcasts, news, and community.",
  foundingDate: "2024",
  sameAs: [
    "https://twitter.com/metsxmfanzone",
    "https://facebook.com/metsxmfanzone",
    "https://instagram.com/metsxmfanzone"
  ],
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer support",
    url: "https://www.metsxmfanzone.com/contact"
  }
};

// AEO: WebSite schema for sitelinks search
const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": "https://www.metsxmfanzone.com/#website",
  url: "https://www.metsxmfanzone.com",
  name: "MetsXMFanZone",
  description: "The ultimate destination for New York Mets fans - live streams, podcasts, news, and community.",
  publisher: {
    "@id": "https://www.metsxmfanzone.com/#organization"
  },
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: "https://www.metsxmfanzone.com/blog?search={search_term_string}"
    },
    "query-input": "required name=search_term_string"
  }
};

// Combined schemas for AEO
const combinedSchemas = [homepageSchema, organizationSchema, websiteSchema];

const Index = () => {
  const { user } = useAuth();
  const [onboardingShown, setOnboardingShown] = useState(false);
  const [lineupLoaded, setLineupLoaded] = useState(false);
  const [lineupGameDate, setLineupGameDate] = useState<string | null>(null);

  // Auto lineup fetch removed from homepage to reduce load — triggered by admin instead

  return (
    <div className="min-h-screen bg-background relative">
      {/* Popup notification modal */}
      <Suspense fallback={null}>
        <PopupNotification />
      </Suspense>

      {/* Poll Toast notification */}
      <Suspense fallback={null}>
        <ToastPoll />
      </Suspense>

      {/* Immersive animated background - lazy loaded */}
      <Suspense fallback={null}>
        <ImmersiveBackground />
      </Suspense>

      <SEOHead
        title="MetsXMFanZone - The Ultimate Destination Where The Fans Go | Live Games, News & Podcasts"
        description="The ultimate Mets fan community. Watch live game streams, highlights, podcasts, and exclusive Mets coverage. Join thousands of passionate New York Mets fans."
        keywords="Mets live streams, New York Mets, Mets highlights, Mets podcast, Mets fan community, MLB streams, Mets games, baseball live stream, Spring Training, Francisco Lindor, Pete Alonso, Citi Field"
        canonical="https://www.metsxmfanzone.com/"
        ogType="website"
        ogImage="https://www.metsxmfanzone.com/og-image.png"
        ogImageAlt="MetsXMFanZone - The Ultimate Destination Where The Fans Go"
        structuredData={combinedSchemas}
        pageType="home"
        breadcrumbs={[{ name: "Home", url: "/" }]}
      />
      <Navigation />
      <Suspense fallback={null}>
          <FreeTrialExpiryBanner />
        </Suspense>
      <main className="relative z-10">
        <Hero />

        {/* Above-the-fold: mount immediately */}
        <Suspense fallback={<SectionSkeleton height="h-16" />}>
          <GamecastBanner />
        </Suspense>

        <Suspense fallback={<SectionSkeleton height="h-32" />}>
          <StoriesSection />
        </Suspense>

        <Suspense fallback={<SectionSkeleton />}>
          <LiveNetworks />
        </Suspense>

        <Suspense fallback={<SectionSkeleton />}>
          <LiveStreamsSection />
        </Suspense>

        {/* Below-the-fold: only mount when scrolled into view */}
        <LazySection fallback={<SectionSkeleton />}>
          <Suspense fallback={<SectionSkeleton />}>
            <SpringTrainingGamesSection />
          </Suspense>
        </LazySection>

        <LazySection fallback={<SectionSkeleton />}>
          <Suspense fallback={<SectionSkeleton />}>
            <GameHighlightsSection />
          </Suspense>
        </LazySection>

        <LazySection fallback={<SectionSkeleton />}>
          <Suspense fallback={<SectionSkeleton />}>
            <ReplayGamesSection />
          </Suspense>
        </LazySection>

        <div className="section-divider my-1" />

        <LazySection fallback={<SectionSkeleton />}>
          <Suspense fallback={<SectionSkeleton />}>
            <BlogSection />
          </Suspense>
        </LazySection>

        <LazySection fallback={<SectionSkeleton height="h-48" />}>
          <Suspense fallback={<SectionSkeleton height="h-48" />}>
            <HomeLineupCard onLineupLoaded={(gameDate) => {
              setLineupLoaded(true);
              setLineupGameDate(gameDate ?? null);
            }} />
          </Suspense>
        </LazySection>

        {lineupLoaded && (
          <>
            <div className="section-divider my-1" />
            <LazySection fallback={<SectionSkeleton />}>
              <Suspense fallback={<SectionSkeleton />}>
                <PlayersToWatch lineupGameDate={lineupGameDate} />
              </Suspense>
            </LazySection>
          </>
        )}

        <div className="section-divider my-1" />
        <LazySection fallback={<SectionSkeleton />}>
          <Suspense fallback={<SectionSkeleton />}>
            <PodcastSection />
          </Suspense>
        </LazySection>

        <div className="section-divider my-1" />

        <div id="social">
        <LazySection fallback={<SectionSkeleton />}>
          <Suspense fallback={<SectionSkeleton />}>
            <PlayerOfTheMonthSection />
          </Suspense>
        </LazySection>
        </div>

        <div className="section-divider my-1" />

        <LazySection fallback={<SectionSkeleton />}>
          <Suspense fallback={<SectionSkeleton />}>
            <CommunityPreviewSection />
          </Suspense>
        </LazySection>

        <div className="section-divider my-1" />

        <LazySection fallback={<SectionSkeleton height="h-48" />}>
          <Suspense fallback={<SectionSkeleton height="h-48" />}>
            <JoinPodcastSection />
          </Suspense>
        </LazySection>

        <div className="section-divider my-1" />

        {!user && (
          <LazySection fallback={<SectionSkeleton />}>
            <Suspense fallback={<SectionSkeleton />}>
              <FAQSection />
            </Suspense>
          </LazySection>
        )}

        <div className="section-divider my-1" />

        <LazySection fallback={<SectionSkeleton />}>
          <Suspense fallback={<SectionSkeleton />}>
            <TestimonialsSection />
          </Suspense>
        </LazySection>

        <div className="section-divider my-1" />

        <LazySection fallback={<SectionSkeleton height="h-48" />}>
          <Suspense fallback={<SectionSkeleton height="h-48" />}>
            <AppInstallSection />
          </Suspense>
        </LazySection>

        <div className="section-divider my-1" />

        <LazySection fallback={<SectionSkeleton />}>
          <Suspense fallback={<SectionSkeleton />}>
            <HotStoveGuide />
          </Suspense>
        </LazySection>

      </main>
      <Footer />
      
      
      {/* Install prompt */}
      <Suspense fallback={null}>
        <InstallPrompt />
      </Suspense>
    </div>
  );
};

export default Index;
