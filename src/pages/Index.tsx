import { Suspense, useState } from "react";
import SEOHead from "@/components/SEOHead";
import Navigation from "@/components/Navigation";
import Hero from "@/components/Hero";


import Footer from "@/components/Footer";
import { Skeleton } from "@/components/ui/skeleton";
import LazySection from "@/components/LazySection";
import { lazyWithRetry } from "@/lib/lazyWithRetry";

import { useAuth } from "@/hooks/useAuth";

// Lazy load heavy components that are below the fold
const ImmersiveBackground = lazyWithRetry(() => import("@/components/ImmersiveBackground"), "home-immersive-background");
const FreeTrialExpiryBanner = lazyWithRetry(() => import("@/components/FreeTrialExpiryBanner"), "home-free-trial-expiry-banner");
const LiveNetworks = lazyWithRetry(() => import("@/components/LiveNetworks"), "home-live-networks");
const LiveStreamsSection = lazyWithRetry(() => import("@/components/LiveStreamsSection"), "home-live-streams-section-v2");
const RelatedStreamsSection = lazyWithRetry(() => import("@/components/RelatedStreamsSection"), "home-related-streams-section");
const OffseasonNYTeamsSection = lazyWithRetry(() => import("@/components/OffseasonNYTeamsSection"), "home-offseason-ny-teams-section");

const SpringTrainingGamesSection = lazyWithRetry(() => import("@/components/SpringTrainingGamesSection"), "home-spring-training-games-section");
const ReplayGamesSection = lazyWithRetry(() => import("@/components/ReplayGamesSection"), "home-replay-games-section");
const PlayerOfTheMonthSection = lazyWithRetry(() => import("@/components/PlayerOfTheMonthSection"), "home-player-of-the-month-section");
const PlayersToWatch = lazyWithRetry(() => import("@/components/PlayersToWatch"), "home-players-to-watch");
const RegularSeasonSeriesSection = lazyWithRetry(() => import("@/components/RegularSeasonSeriesSection"), "home-regular-season-series-section");

const BlogSection = lazyWithRetry(() => import("@/components/BlogSection"), "home-blog-section");
const HomeLineupCard = lazyWithRetry(() => import("@/components/HomeLineupCard"), "home-lineup-card");
const FindUsSection = lazyWithRetry(() => import("@/components/FindUsSection"), "home-find-us-section");
const TikTokFeedSection = lazyWithRetry(() => import("@/components/TikTokFeedSection"), "home-tiktok-feed-section");


const GamecastBanner = lazyWithRetry(() => import("@/components/GamecastBanner"), "home-gamecast-banner");
const FAQSection = lazyWithRetry(() => import("@/components/FAQSection"), "home-faq-section");
const TestimonialsSection = lazyWithRetry(() => import("@/components/TestimonialsSection"), "home-testimonials-section");
const MetsStatsSection = lazyWithRetry(() => import("@/components/MetsStatsSection"), "home-mets-stats-section");
const AppInstallSection = lazyWithRetry(() => import("@/components/AppInstallSection"), "home-app-install-section");
const CommunityPreviewSection = lazyWithRetry(() => import("@/components/CommunityPreviewSection"), "home-community-preview-section");
const InstallPrompt = lazyWithRetry(() => import("@/components/InstallPrompt"), "home-install-prompt");
const OnboardingWalkthrough = lazyWithRetry(() => import("@/components/OnboardingWalkthrough"), "home-onboarding-walkthrough");
const NotificationPrompt = lazyWithRetry(() => import("@/components/NotificationPrompt"), "home-notification-prompt");
const ToastPoll = lazyWithRetry(() => import("@/components/ToastPoll"), "home-toast-poll");
const PopupNotification = lazyWithRetry(() => import("@/components/PopupNotification"), "home-popup-notification");


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
        title="MetsXMFanZone — NY Mets Live Games, News & Podcasts"
        description="The ultimate Mets fan community. Watch live game streams, highlights, podcasts, and exclusive Mets coverage. Join thousands of passionate New York Mets fans."
        keywords="Mets live streams, New York Mets, Mets highlights, Mets podcast, Mets fan community, MLB streams, Mets games, baseball live stream, Spring Training, Francisco Lindor, Pete Alonso, Citi Field"
        canonical="https://metsxmfanzone.com/"
        ogType="website"
        ogImage="https://metsxmfanzone.com/share/home.jpg"
        ogImageAlt="MetsXMFanZone - The Ultimate Destination Where The Fans Go"
        structuredData={combinedSchemas}
        pageType="home"
        breadcrumbs={[{ name: "Home", url: "/" }]}
      />
      <Navigation />
      <Suspense fallback={null}>
          <FreeTrialExpiryBanner />
        </Suspense>
      <main className="relative z-10 homepage-broadcast-feed">
        <Hero />


        {/* Above-the-fold: mount immediately */}
        <Suspense fallback={<SectionSkeleton height="h-16" />}>
          <GamecastBanner />
        </Suspense>


        <Suspense fallback={<SectionSkeleton />}>
          <LiveNetworks />
        </Suspense>

        <Suspense fallback={<SectionSkeleton />}>
          <LiveStreamsSection />
        </Suspense>

        <LazySection fallback={<SectionSkeleton />}>
          <Suspense fallback={<SectionSkeleton />}>
            <OffseasonNYTeamsSection />
          </Suspense>
        </LazySection>

        <LazySection fallback={<SectionSkeleton />}>
          <Suspense fallback={<SectionSkeleton />}>
            <RelatedStreamsSection />
          </Suspense>
        </LazySection>

        <LazySection fallback={<SectionSkeleton />}>
          <Suspense fallback={<SectionSkeleton />}>
            <RegularSeasonSeriesSection />
          </Suspense>
        </LazySection>

        {/* Below-the-fold: only mount when scrolled into view */}
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

        {user && (
          <>
            <div className="section-divider my-1" />
            <LazySection fallback={<SectionSkeleton />}>
              <Suspense fallback={<SectionSkeleton />}>
                <MetsStatsSection />
              </Suspense>
            </LazySection>
          </>
        )}

        <div className="section-divider my-1" />
        <LazySection fallback={<SectionSkeleton />}>
          <Suspense fallback={<SectionSkeleton />}>
            <TikTokFeedSection />
          </Suspense>
        </LazySection>

        <div className="section-divider my-1" />
        <LazySection fallback={<SectionSkeleton />}>
          <Suspense fallback={<SectionSkeleton />}>
            <FindUsSection />
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

        {!user && (
          <LazySection fallback={<SectionSkeleton />}>
            <Suspense fallback={<SectionSkeleton />}>
              <TestimonialsSection />
            </Suspense>
          </LazySection>
        )}

        <div className="section-divider my-1" />

        <LazySection fallback={<SectionSkeleton height="h-48" />}>
          <Suspense fallback={<SectionSkeleton height="h-48" />}>
            <AppInstallSection />
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
