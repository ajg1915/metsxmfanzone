import { useEffect, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { PullToRefresh } from "@/components/PullToRefresh";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { useSessionExpiryWarning } from "@/hooks/useSessionExpiryWarning";
import { AuthProvider } from "@/hooks/useAuth";
import { setupNotificationListeners } from "@/utils/notificationTriggers";
import { usePresenceTracking } from "@/hooks/usePresenceTracking";
// ExitIntentPopup removed per user request
import { StreamExitDialog } from "@/components/StreamExitDialog";
import { LiveStreamToast } from "@/components/LiveStreamToast";
import SocialMediaBar from "@/components/SocialMediaBar";
import { TVModeWrapper } from "@/components/TVModeWrapper";
import ForceNotificationPrompt from "@/components/ForceNotificationPrompt";

import { useMaintenanceMode } from "@/hooks/useMaintenanceMode";

import { Skeleton } from "@/components/ui/skeleton";

// Eager load critical pages
import Index from "./pages/Index";
import Maintenance from "./pages/Maintenance";
import Auth from "./pages/Auth";

// Lazy load all other pages
const Community = lazy(() => import("./pages/Community"));
const PaymentSuccess = lazy(() => import("./pages/PaymentSuccess"));
const PaymentError = lazy(() => import("./pages/PaymentError"));
const Gallery = lazy(() => import("./pages/Gallery"));
const Plans = lazy(() => import("./pages/Plans"));
const ConfirmAccount = lazy(() => import("./pages/ConfirmAccount"));
const AdminSetup = lazy(() => import("./pages/AdminSetup"));
const AdminLayout = lazy(() => import("./components/AdminLayout").then(m => ({ default: m.AdminLayout })));
const AdminDashboard = lazy(() => import("./pages/admin/Dashboard"));
const PostsManagement = lazy(() => import("./pages/admin/PostsManagement"));
const UserRoles = lazy(() => import("./pages/admin/UserRoles"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const BlogManagement = lazy(() => import("./pages/admin/BlogManagement"));
const VideoGalleryManagement = lazy(() => import("./pages/admin/VideoGalleryManagement"));
const PodcastManagement = lazy(() => import("./pages/admin/PodcastManagement"));
const ClubhouseStudio = lazy(() => import("./pages/admin/ClubhouseStudio"));
const PodcastLiveStreamManagement = lazy(() => import("./pages/admin/PodcastLiveStreamManagement"));


const LiveStreamManagement = lazy(() => import("./pages/admin/LiveStreamManagement"));
const LiveNotificationManagement = lazy(() => import("./pages/admin/LiveNotificationManagement"));
const SubscriptionManagement = lazy(() => import("./pages/admin/SubscriptionManagement"));
const StoriesManagement = lazy(() => import("./pages/admin/StoriesManagement"));
const TutorialManagement = lazy(() => import("./pages/admin/TutorialManagement"));
const FeedbackManagement = lazy(() => import("./pages/admin/FeedbackManagement"));

const NewsletterGenerator = lazy(() => import("./pages/admin/NewsletterGenerator"));
const EmailEditor = lazy(() => import("./pages/admin/EmailEditor"));

const BusinessAdsManagement = lazy(() => import("./pages/admin/BusinessAdsManagement"));
const MetsXMFanZone = lazy(() => import("./pages/MetsXMFanZone"));
const MLBNetwork = lazy(() => import("./pages/MLBNetwork"));
const ESPNNetwork = lazy(() => import("./pages/ESPNNetwork"));
const PIX11Network = lazy(() => import("./pages/PIX11Network"));
const MSGNetwork = lazy(() => import("./pages/MSGNetwork"));
const LiveStream = lazy(() => import("./pages/LiveStream"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Blog = lazy(() => import("./pages/Blog"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
const OGBlogPost = lazy(() => import("./pages/OGBlogPost"));
const BlogRSS = lazy(() => import("./pages/BlogRSS"));
const HelpCenter = lazy(() => import("./pages/HelpCenter"));
const Contact = lazy(() => import("./pages/Contact"));
const FAQs = lazy(() => import("./pages/FAQs"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const Podcast = lazy(() => import("./pages/Podcast"));
const CommunityPodcast = lazy(() => import("./pages/CommunityPodcast"));
const BusinessPartner = lazy(() => import("./pages/BusinessPartner"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Feedback = lazy(() => import("./pages/Feedback"));
const Sitemap = lazy(() => import("./pages/Sitemap"));
const PayPalSuccess = lazy(() => import("./pages/PayPalSuccess"));

const SpringTrainingLive = lazy(() => import("./pages/SpringTrainingLive"));
const ReplayGames = lazy(() => import("./pages/ReplayGames"));
const Merch = lazy(() => import("./pages/Merch"));
const Product = lazy(() => import("./pages/Product"));
const MetsSchedule2026 = lazy(() => import("./pages/MetsSchedule2026"));
const TVBroadcastSchedule = lazy(() => import("./pages/TVBroadcastSchedule"));
const TVDashboard = lazy(() => import("./pages/TVDashboard"));
const MetsLineupCard = lazy(() => import("./pages/MetsLineupCard"));
const MetsScores = lazy(() => import("./pages/MetsScores"));
const MetsGamecast = lazy(() => import("./pages/MetsGamecast"));
const VideoGallery = lazy(() => import("./pages/VideoGallery"));
const SocialMediaHub = lazy(() => import("./pages/SocialMediaHub"));
const NLScores = lazy(() => import("./pages/NLScores"));
const Events = lazy(() => import("./pages/Events"));
const MetsRoster = lazy(() => import("./pages/MetsRoster"));
const PlayerStats = lazy(() => import("./pages/PlayerStats"));
const MetsHistory = lazy(() => import("./pages/MetsHistory"));
const UserManagement = lazy(() => import("./pages/admin/UserManagement"));
const BackgroundManagement = lazy(() => import("./pages/admin/BackgroundManagement"));
const ActivityDashboard = lazy(() => import("./pages/admin/ActivityDashboard"));
const WriterApplications = lazy(() => import("./pages/admin/WriterApplications"));
const RealtimeAnalytics = lazy(() => import("./pages/admin/RealtimeAnalytics"));
const StreamHealthDashboard = lazy(() => import("./pages/admin/StreamHealthDashboard"));
const StreamTester = lazy(() => import("./pages/admin/StreamTester"));
const SEOManagement = lazy(() => import("./pages/admin/SEOManagement"));
const HeroManagement = lazy(() => import("./pages/admin/HeroManagement"));

const GameNotifications = lazy(() => import("./pages/admin/GameNotifications"));
const GameAlertsManagement = lazy(() => import("./pages/admin/GameAlertsManagement"));
const WriterRegister = lazy(() => import("./pages/WriterRegister"));
const CreateAccount = lazy(() => import("./pages/help/CreateAccount"));
const BiometricLogin = lazy(() => import("./pages/help/BiometricLogin"));
const NavigatePlatform = lazy(() => import("./pages/help/NavigatePlatform"));
const WatchStreams = lazy(() => import("./pages/help/WatchStreams"));
const CommunityGuidelines = lazy(() => import("./pages/help/CommunityGuidelines"));
const VideoQuality = lazy(() => import("./pages/help/VideoQuality"));
const PremiumContent = lazy(() => import("./pages/help/PremiumContent"));
const OfflineViewing = lazy(() => import("./pages/help/OfflineViewing"));
const PlaybackIssues = lazy(() => import("./pages/help/PlaybackIssues"));
const PostCommunity = lazy(() => import("./pages/help/PostCommunity"));
const CommentsReactions = lazy(() => import("./pages/help/CommentsReactions"));
const FollowFans = lazy(() => import("./pages/help/FollowFans"));
const ReportContent = lazy(() => import("./pages/help/ReportContent"));
const UpdateProfile = lazy(() => import("./pages/help/UpdateProfile"));
const SubscriptionPlans = lazy(() => import("./pages/help/SubscriptionPlans"));
const PaymentMethods = lazy(() => import("./pages/help/PaymentMethods"));
const CancelSubscription = lazy(() => import("./pages/help/CancelSubscription"));
const ReturnPolicy = lazy(() => import("./pages/help/ReturnPolicy"));
const Logout = lazy(() => import("./pages/Logout"));
const WriterAuth = lazy(() => import("./pages/WriterAuth"));
const WriterDashboard = lazy(() => import("./pages/writer/WriterDashboard"));
const WriterArticleEditor = lazy(() => import("./pages/writer/WriterArticleEditor"));
const AdminPortal = lazy(() => import("./pages/AdminPortal"));
const PodcasterApplication = lazy(() => import("./pages/PodcasterApplication"));
const PodcasterApplicationsManagement = lazy(() => import("./pages/admin/PodcasterApplicationsManagement"));
const DailyReports = lazy(() => import("./pages/admin/DailyReports"));
const PredictionsManagement = lazy(() => import("./pages/admin/PredictionsManagement"));
const PollManagement = lazy(() => import("./pages/admin/PollManagement"));
const PlayerOfTheMonthManagement = lazy(() => import("./pages/admin/PlayerOfTheMonthManagement"));
const SocialMediaSettings = lazy(() => import("./pages/admin/SocialMediaSettings"));
const MediaLibrary = lazy(() => import("./pages/admin/MediaLibrary"));
const ToastPromptManagement = lazy(() => import("./pages/admin/ToastPromptManagement"));
const PopupNotificationsManagement = lazy(() => import("./pages/admin/PopupNotificationsManagement"));
const ShopManagement = lazy(() => import("./pages/admin/ShopManagement"));
const Shop = lazy(() => import("./pages/Shop"));
const OrderSuccess = lazy(() => import("./pages/OrderSuccess"));
const WhatsNew = lazy(() => import("./pages/WhatsNew"));
const Install = lazy(() => import("./pages/Install"));
const MetsVsAstros = lazy(() => import("./pages/matchups/MetsVsAstros"));
const MetsVsBraves = lazy(() => import("./pages/matchups/MetsVsBraves"));
const MetsVsCardinals = lazy(() => import("./pages/matchups/MetsVsCardinals"));
const MetsVsNationals = lazy(() => import("./pages/matchups/MetsVsNationals"));
const MetsVsRedSox = lazy(() => import("./pages/matchups/MetsVsRedSox"));
const MetsVsYankees = lazy(() => import("./pages/matchups/MetsVsYankees"));
const MetsVsBlueJays = lazy(() => import("./pages/matchups/MetsVsBlueJays"));
const EmailTemplateSettings = lazy(() => import("./pages/admin/EmailTemplateSettings"));



const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes (formerly cacheTime)
      refetchOnWindowFocus: false,
    },
  },
});

// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="space-y-4 w-full max-w-md px-4">
      <Skeleton className="h-8 w-3/4 mx-auto" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-32 w-full rounded-lg" />
    </div>
  </div>
);

// Wrapper to access maintenance mode inside router context
const AppContent = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isEnabled: maintenanceEnabled, message: maintenanceMessage, isLoading } = useMaintenanceMode();
  
  
  useAutoRefresh();
  useSessionExpiryWarning();
  usePresenceTracking();
  
  // Set up notification listeners for real-time alerts
  useEffect(() => {
    const cleanup = setupNotificationListeners();
    return cleanup;
  }, []);
  
  // Disable right-click context menu for non-admin users only
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let mounted = true;
    
    const checkAdminAndSetupContextMenu = async () => {
      try {
        // Check if user is admin - use getUser() which is more reliable
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!mounted) return;
        
        if (user) {
          const { data: roleData } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id)
            .eq("role", "admin")
            .maybeSingle();
          
          if (!mounted) return;
          
          // If admin, don't block context menu
          if (roleData) {
            return;
          }
        }
        
        if (!mounted) return;
        
        // Block context menu for non-admins
        const handleContextMenu = (e: MouseEvent) => {
          e.preventDefault();
          return false;
        };
        
        document.addEventListener("contextmenu", handleContextMenu);
        cleanup = () => document.removeEventListener("contextmenu", handleContextMenu);
      } catch (error) {
        // Silently handle errors - don't let this break the app
        console.error('Context menu setup error:', error);
      }
    };
    
    checkAdminAndSetupContextMenu();
    
    return () => {
      mounted = false;
      if (cleanup) cleanup();
    };
  }, []);




  // Check if current route is admin route (admins should bypass maintenance)
  const isAdminRoute = location.pathname.startsWith("/admin");
  const isAuthRoute = location.pathname === "/auth" || location.pathname === "/logout";
  const isMaintenancePreview = location.pathname === "/maintenance-preview";

  // Show maintenance page for non-admin routes when enabled (or preview route)
  if (isMaintenancePreview) {
    return <Maintenance message={maintenanceMessage || "Preview: We're currently performing scheduled maintenance. Please check back soon!"} />;
  }
  
  if (!isLoading && maintenanceEnabled && !isAdminRoute && !isAuthRoute) {
    return <Maintenance message={maintenanceMessage} />;
  }
  
  return (
    <TooltipProvider>
      <TVModeWrapper>
      <PullToRefresh>
        <Toaster />
        <Sonner />
        {/* Removed: ExitIntentPopup, most toasts. Only Live/Offline kept */}
        <StreamExitDialog />
        <SocialMediaBar />
        <ForceNotificationPrompt />
        
        <Suspense fallback={<PageLoader />}>
          <Routes>


            <Route path="/" element={<Index />} />
            <Route path="/community" element={<Community />} />
            <Route path="/gallery" element={<Gallery />} />
            <Route path="/pricing" element={<Plans />} />
            <Route path="/paypal-success" element={<PayPalSuccess />} />
            
            <Route path="/payment-success" element={<PaymentSuccess />} />
            <Route path="/payment-error" element={<PaymentError />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/writer-auth" element={<WriterAuth />} />
            <Route path="/writer-register" element={<WriterRegister />} />
            <Route path="/confirm-account" element={<ConfirmAccount />} />
            <Route path="/logout" element={<Logout />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/blog/:slug" element={<BlogPost />} />
            <Route path="/og-blog/:slug" element={<OGBlogPost />} />
            <Route path="/blog/rss" element={<BlogRSS />} />
            <Route path="/help-center" element={<HelpCenter />} />
            <Route path="/help/create-account" element={<CreateAccount />} />
            <Route path="/help/biometric-login" element={<BiometricLogin />} />
            <Route path="/help/navigate-platform" element={<NavigatePlatform />} />
            <Route path="/help/watch-streams" element={<WatchStreams />} />
            <Route path="/help/community-guidelines" element={<CommunityGuidelines />} />
            <Route path="/help/video-quality" element={<VideoQuality />} />
            <Route path="/help/premium-content" element={<PremiumContent />} />
            <Route path="/help/offline-viewing" element={<OfflineViewing />} />
            <Route path="/help/playback-issues" element={<PlaybackIssues />} />
            <Route path="/help/post-community" element={<PostCommunity />} />
            <Route path="/help/comments-reactions" element={<CommentsReactions />} />
            <Route path="/help/follow-fans" element={<FollowFans />} />
            <Route path="/help/report-content" element={<ReportContent />} />
            <Route path="/help/update-profile" element={<UpdateProfile />} />
            <Route path="/help/subscription-plans" element={<SubscriptionPlans />} />
            <Route path="/help/payment-methods" element={<PaymentMethods />} />
            <Route path="/help/cancel-subscription" element={<CancelSubscription />} />
            <Route path="/help/return-policy" element={<ReturnPolicy />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/feedback" element={<Feedback />} />
            <Route path="/faqs" element={<FAQs />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/whats-new" element={<WhatsNew />} />
            <Route path="/install" element={<Install />} />
            <Route path="/podcast" element={<Podcast />} />
            <Route path="/community-podcast" element={<CommunityPodcast />} />
            <Route path="/podcaster-application" element={<PodcasterApplication />} />
            <Route path="/business-partner" element={<BusinessPartner />} />
            <Route path="/legal/admin-setup" element={<AdminSetup />} />
            <Route path="/admin-portal" element={<AdminPortal />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="hero" element={<HeroManagement />} />
              <Route path="blog" element={<BlogManagement />} />
              <Route path="video-gallery-management" element={<VideoGalleryManagement />} />
              <Route path="podcasts" element={<PodcastManagement />} />
              <Route path="studio" element={<ClubhouseStudio />} />
              <Route path="live-streams" element={<LiveStreamManagement />} />
              <Route path="podcast-live-stream" element={<PodcastLiveStreamManagement />} />
              
              <Route path="live-notifications" element={<LiveNotificationManagement />} />
              <Route path="stories" element={<StoriesManagement />} />
              <Route path="tutorial" element={<TutorialManagement />} />
              <Route path="newsletter" element={<NewsletterGenerator />} />
              <Route path="email-editor" element={<EmailEditor />} />
              <Route path="email-templates" element={<EmailTemplateSettings />} />
              <Route path="feedbacks" element={<FeedbackManagement />} />
              <Route path="posts" element={<PostsManagement />} />
              <Route path="business-ads" element={<BusinessAdsManagement />} />
              <Route path="roles" element={<UserManagement />} />
              <Route path="user-management" element={<UserManagement />} />
              <Route path="subscriptions" element={<UserManagement />} />
              <Route path="backgrounds" element={<BackgroundManagement />} />
              <Route path="activity" element={<ActivityDashboard />} />
              <Route path="writer-applications" element={<WriterApplications />} />
              <Route path="realtime-analytics" element={<RealtimeAnalytics />} />
              <Route path="stream-health" element={<StreamHealthDashboard />} />
              <Route path="stream-tester" element={<StreamTester />} />
              <Route path="seo" element={<SEOManagement />} />
              <Route path="game-notifications" element={<GameNotifications />} />
              <Route path="game-alerts" element={<GameAlertsManagement />} />
              <Route path="podcaster-applications" element={<PodcasterApplicationsManagement />} />
              <Route path="daily-reports" element={<DailyReports />} />
              <Route path="daily-reports" element={<DailyReports />} />
              <Route path="predictions" element={<PredictionsManagement />} />
              <Route path="polls" element={<PollManagement />} />
              <Route path="settings" element={<AdminSettings />} />
              <Route path="social-media" element={<SocialMediaSettings />} />
              <Route path="tutorials" element={<TutorialManagement />} />
              <Route path="media-library" element={<MediaLibrary />} />
              <Route path="toast-prompts" element={<ToastPromptManagement />} />
              <Route path="popup-notifications" element={<PopupNotificationsManagement />} />
              <Route path="shop" element={<ShopManagement />} />
              <Route path="player-of-the-month" element={<PlayerOfTheMonthManagement />} />
            </Route>
            {/* Writer Portal Routes */}
            <Route path="/writer" element={<WriterDashboard />} />
            <Route path="/writer/new-article" element={<WriterArticleEditor />} />
            <Route path="/writer/edit/:id" element={<WriterArticleEditor />} />
            {/* Spring Training page removed */}
            <Route path="/replay-games" element={<ReplayGames />} />
            <Route path="/merch" element={<Merch />} />
            <Route path="/shop" element={<Shop />} />
            <Route path="/shop/order-success" element={<OrderSuccess />} />
            <Route path="/product/:handle" element={<Product />} />
            <Route path="/mets-schedule-2026" element={<MetsSchedule2026 />} />
            <Route path="/broadcast-schedule" element={<TVBroadcastSchedule />} />
            <Route path="/tv" element={<TVDashboard />} />
            {/* Lineup Card page removed - kept on main page */}
            <Route path="/mets-scores" element={<MetsScores />} />
            <Route path="/mets-gamecast" element={<MetsGamecast />} />
            <Route path="/video-gallery" element={<VideoGallery />} />
            <Route path="/social" element={<SocialMediaHub />} />
            <Route path="/nl-scores" element={<NLScores />} />
            {/* Events standalone page removed - kept in community section */}
            <Route path="/mets-roster" element={<MetsRoster />} />
            <Route path="/player/:playerId" element={<PlayerStats />} />
            <Route path="/mets-history" element={<MetsHistory />} />
            <Route path="/metsxmfanzone" element={<MetsXMFanZone />} />
            <Route path="/mlb-network" element={<MLBNetwork />} />
            <Route path="/espn-network" element={<ESPNNetwork />} />
            <Route path="/pix11-network" element={<PIX11Network />} />
            <Route path="/msg-network" element={<MSGNetwork />} />
            <Route path="/live/:streamId" element={<LiveStream />} />
            <Route path="/matchup/astros" element={<MetsVsAstros />} />
            <Route path="/matchup/braves" element={<MetsVsBraves />} />
            <Route path="/matchup/cardinals" element={<MetsVsCardinals />} />
            <Route path="/matchup/nationals" element={<MetsVsNationals />} />
            <Route path="/matchup/redsox" element={<MetsVsRedSox />} />
            <Route path="/matchup/yankees" element={<MetsVsYankees />} />
            <Route path="/matchup/bluejays" element={<MetsVsBlueJays />} />
            <Route path="/sitemap.xml" element={<Sitemap />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </PullToRefresh>
      </TVModeWrapper>
    </TooltipProvider>
  );
};

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
