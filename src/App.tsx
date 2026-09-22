import { useEffect, Suspense } from "react";
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
import { SweepstakesWheel } from "@/components/SweepstakesWheel";
import { DesktopWelcomeGate } from "@/components/DesktopWelcomeGate";
import { UpdatePrompt } from "@/components/UpdatePrompt";



import { useMaintenanceMode } from "@/hooks/useMaintenanceMode";

import { Skeleton } from "@/components/ui/skeleton";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import RouteShareMetadata from "@/components/RouteShareMetadata";

// Eager load critical pages
import Index from "./pages/Index";
import Maintenance from "./pages/Maintenance";
import Auth from "./pages/Auth";

// Lazy load all other pages
const Community = lazyWithRetry(() => import("./pages/Community"), "page-community");
const PaymentSuccess = lazyWithRetry(() => import("./pages/PaymentSuccess"), "page-payment-success");
const PaymentError = lazyWithRetry(() => import("./pages/PaymentError"), "page-payment-error");
const Gallery = lazyWithRetry(() => import("./pages/Gallery"), "page-gallery");
const Plans = lazyWithRetry(() => import("./pages/Plans"), "page-plans");
const ConfirmAccount = lazyWithRetry(() => import("./pages/ConfirmAccount"), "page-confirm-account");
const AdminSetup = lazyWithRetry(() => import("./pages/AdminSetup"), "page-admin-setup");
const AdminLayout = lazyWithRetry(() => import("./components/AdminLayout").then(m => ({ default: m.AdminLayout })), "component-admin-layout");
const AdminDashboard = lazyWithRetry(() => import("./pages/admin/Dashboard"), "page-admin-dashboard");
const PostsManagement = lazyWithRetry(() => import("./pages/admin/PostsManagement"), "page-admin-posts-management");
const UserRoles = lazyWithRetry(() => import("./pages/admin/UserRoles"), "page-admin-user-roles");
const AdminSettings = lazyWithRetry(() => import("./pages/admin/AdminSettings"), "page-admin-settings");
const WelcomeScreenManagement = lazyWithRetry(() => import("./pages/admin/WelcomeScreenManagement"), "page-admin-welcome-screen");
const PrivatePlayer = lazyWithRetry(() => import("./pages/admin/PrivatePlayer"), "page-admin-private-player");
const PrivateLivePlayer = lazyWithRetry(() => import("./pages/PrivateLivePlayer"), "page-private-live-player");
const MetsXMPlayer = lazyWithRetry(() => import("./pages/MetsXMPlayer"), "page-metsxm-player");
const BlogManagement = lazyWithRetry(() => import("./pages/admin/BlogManagement"), "page-admin-blog-management");
const ArticleEditor = lazyWithRetry(() => import("./pages/admin/ArticleEditor"), "page-admin-article-editor");
const VideoGalleryManagement = lazyWithRetry(() => import("./pages/admin/VideoGalleryManagement"), "page-admin-video-gallery-management");
const PodcastManagement = lazyWithRetry(() => import("./pages/admin/PodcastManagement"), "page-admin-podcast-management");
const ClubhouseStudio = lazyWithRetry(() => import("./pages/admin/ClubhouseStudio"), "page-admin-clubhouse-studio");
const PodcastLiveStreamManagement = lazyWithRetry(() => import("./pages/admin/PodcastLiveStreamManagement"), "page-admin-podcast-live-stream-management");


const LiveStreamManagement = lazyWithRetry(() => import("./pages/admin/LiveStreamManagement"), "page-admin-live-stream-management");
const LiveNotificationManagement = lazyWithRetry(() => import("./pages/admin/LiveNotificationManagement"), "page-admin-live-notification-management");
const TrialManagement = lazyWithRetry(() => import("./pages/admin/TrialManagement"), "page-admin-trial-management");
const SubscriptionManagement = lazyWithRetry(() => import("./pages/admin/SubscriptionManagement"), "page-admin-subscription-management");
const StoriesManagement = lazyWithRetry(() => import("./pages/admin/StoriesManagement"), "page-admin-stories-management");
const TutorialManagement = lazyWithRetry(() => import("./pages/admin/TutorialManagement"), "page-admin-tutorial-management");
const FeedbackManagement = lazyWithRetry(() => import("./pages/admin/FeedbackManagement"), "page-admin-feedback-management");

const NewsletterGenerator = lazyWithRetry(() => import("./pages/admin/NewsletterGenerator"), "page-admin-newsletter-generator");
const EmailEditor = lazyWithRetry(() => import("./pages/admin/EmailEditor"), "page-admin-email-editor");

const BusinessAdsManagement = lazyWithRetry(() => import("./pages/admin/BusinessAdsManagement"), "page-admin-business-ads-management");
const Unsubscribe = lazyWithRetry(() => import("./pages/Unsubscribe"), "page-unsubscribe");
const MetsXMFanZone = lazyWithRetry(() => import("./pages/MetsXMFanZone"), "page-metsxmfanzone");
const MetsGameRecaps = lazyWithRetry(() => import("./pages/MetsGameRecaps"), "page-mets-game-recaps");
const GameRecapsManagement = lazyWithRetry(() => import("./pages/admin/GameRecapsManagement"), "page-admin-game-recaps");
const PodcastOutlineTemplates = lazyWithRetry(() => import("./pages/admin/PodcastOutlineTemplates"), "page-admin-podcast-outline-templates");
const MLBNetwork = lazyWithRetry(() => import("./pages/MLBNetwork"), "page-mlb-network");
const ESPNNetwork = lazyWithRetry(() => import("./pages/ESPNNetwork"), "page-espn-network");
const PIX11Network = lazyWithRetry(() => import("./pages/PIX11Network"), "page-pix11-network");
const MSGNetwork = lazyWithRetry(() => import("./pages/MSGNetwork"), "page-msg-network");
const MSGPlus = lazyWithRetry(() => import("./pages/MSGPlus"), "page-msg-plus");
const LiveStream = lazyWithRetry(() => import("./pages/LiveStream"), "page-live-stream");
const NotFound = lazyWithRetry(() => import("./pages/NotFound"), "page-not-found");
const Blog = lazyWithRetry(() => import("./pages/Blog"), "page-blog");
const BlogPost = lazyWithRetry(() => import("./pages/BlogPost"), "page-blog-post");
const BlogRSS = lazyWithRetry(() => import("./pages/BlogRSS"), "page-blog-rss");
const HelpCenter = lazyWithRetry(() => import("./pages/HelpCenter"), "page-help-center");
const Contact = lazyWithRetry(() => import("./pages/Contact"), "page-contact");
const FAQs = lazyWithRetry(() => import("./pages/FAQs"), "page-faqs");
const Privacy = lazyWithRetry(() => import("./pages/Privacy"), "page-privacy");
const Terms = lazyWithRetry(() => import("./pages/Terms"), "page-terms");
const Podcast = lazyWithRetry(() => import("./pages/Podcast"), "page-podcast");
const CommunityPodcast = lazyWithRetry(() => import("./pages/CommunityPodcast"), "page-community-podcast");
const BusinessPartner = lazyWithRetry(() => import("./pages/BusinessPartner"), "page-business-partner");
const Dashboard = lazyWithRetry(() => import("./pages/Dashboard"), "page-dashboard");
const CancellationStatus = lazyWithRetry(() => import("./pages/CancellationStatus"), "page-cancellation-status");

const Feedback = lazyWithRetry(() => import("./pages/Feedback"), "page-feedback");
const Sitemap = lazyWithRetry(() => import("./pages/SitemapRedirect"), "page-sitemap-redirect");
const DynamicMatchup = lazyWithRetry(() => import("./pages/matchups/DynamicMatchup"), "page-dynamic-matchup");
const PayPalSuccess = lazyWithRetry(() => import("./pages/PayPalSuccess"), "page-paypal-success");

const SpringTrainingLive = lazyWithRetry(() => import("./pages/SpringTrainingLive"), "page-spring-training-live");
const ReplayGames = lazyWithRetry(() => import("./pages/ReplayGames"), "page-replay-games");
const MetsSchedule2026 = lazyWithRetry(() => import("./pages/MetsSchedule2026"), "page-mets-schedule-2026");
const TVBroadcastSchedule = lazyWithRetry(() => import("./pages/TVBroadcastSchedule"), "page-tv-broadcast-schedule");
const TVDashboard = lazyWithRetry(() => import("./pages/TVDashboard"), "page-tv-dashboard");
const MetsLineupCard = lazyWithRetry(() => import("./pages/MetsLineupCard"), "page-mets-lineup-card");
const MetsScores = lazyWithRetry(() => import("./pages/MetsScores"), "page-mets-scores");
const MetsGamecast = lazyWithRetry(() => import("./pages/MetsGamecast"), "page-mets-gamecast");
const VideoGallery = lazyWithRetry(() => import("./pages/VideoGallery"), "page-video-gallery");
const SocialMediaHub = lazyWithRetry(() => import("./pages/SocialMediaHub"), "page-social-media-hub");
const NLScores = lazyWithRetry(() => import("./pages/NLScores"), "page-nl-scores");
const Events = lazyWithRetry(() => import("./pages/Events"), "page-events");
const MetsRoster = lazyWithRetry(() => import("./pages/MetsRoster"), "page-mets-roster");
const PlayerStats = lazyWithRetry(() => import("./pages/PlayerStats"), "page-player-stats");
const MetsHistory = lazyWithRetry(() => import("./pages/MetsHistory"), "page-mets-history");
const UserManagement = lazyWithRetry(() => import("./pages/admin/UserManagement"), "page-admin-user-management");
const BackgroundManagement = lazyWithRetry(() => import("./pages/admin/BackgroundManagement"), "page-admin-background-management");
const ActivityDashboard = lazyWithRetry(() => import("./pages/admin/ActivityDashboard"), "page-admin-activity-dashboard");
const WriterApplications = lazyWithRetry(() => import("./pages/admin/WriterApplications"), "page-admin-writer-applications");
const RealtimeAnalytics = lazyWithRetry(() => import("./pages/admin/RealtimeAnalytics"), "page-admin-realtime-analytics");
const StreamHealthDashboard = lazyWithRetry(() => import("./pages/admin/StreamHealthDashboard"), "page-admin-stream-health-dashboard");
const StreamTester = lazyWithRetry(() => import("./pages/admin/StreamTester"), "page-admin-stream-tester");
const FeedHealth = lazyWithRetry(() => import("./pages/admin/FeedHealth"), "page-admin-feed-health");
const SEOManagement = lazyWithRetry(() => import("./pages/admin/SEOManagement"), "page-admin-seo-management");
const HeroManagement = lazyWithRetry(() => import("./pages/admin/HeroManagement"), "page-admin-hero-management");

const GameNotifications = lazyWithRetry(() => import("./pages/admin/GameNotifications"), "page-admin-game-notifications");
const GameAlertsManagement = lazyWithRetry(() => import("./pages/admin/GameAlertsManagement"), "page-admin-game-alerts-management");
const WriterRegister = lazyWithRetry(() => import("./pages/WriterRegister"), "page-writer-register");
const CreateAccount = lazyWithRetry(() => import("./pages/help/CreateAccount"), "page-help-create-account");
const BiometricLogin = lazyWithRetry(() => import("./pages/help/BiometricLogin"), "page-help-biometric-login");
const NavigatePlatform = lazyWithRetry(() => import("./pages/help/NavigatePlatform"), "page-help-navigate-platform");
const WatchStreams = lazyWithRetry(() => import("./pages/help/WatchStreams"), "page-help-watch-streams");
const CommunityGuidelines = lazyWithRetry(() => import("./pages/help/CommunityGuidelines"), "page-help-community-guidelines");
const VideoQuality = lazyWithRetry(() => import("./pages/help/VideoQuality"), "page-help-video-quality");
const PremiumContent = lazyWithRetry(() => import("./pages/help/PremiumContent"), "page-help-premium-content");
const OfflineViewing = lazyWithRetry(() => import("./pages/help/OfflineViewing"), "page-help-offline-viewing");
const PlaybackIssues = lazyWithRetry(() => import("./pages/help/PlaybackIssues"), "page-help-playback-issues");
const PostCommunity = lazyWithRetry(() => import("./pages/help/PostCommunity"), "page-help-post-community");
const CommentsReactions = lazyWithRetry(() => import("./pages/help/CommentsReactions"), "page-help-comments-reactions");
const FollowFans = lazyWithRetry(() => import("./pages/help/FollowFans"), "page-help-follow-fans");
const ReportContent = lazyWithRetry(() => import("./pages/help/ReportContent"), "page-help-report-content");
const UpdateProfile = lazyWithRetry(() => import("./pages/help/UpdateProfile"), "page-help-update-profile");
const SubscriptionPlans = lazyWithRetry(() => import("./pages/help/SubscriptionPlans"), "page-help-subscription-plans");
const PaymentMethods = lazyWithRetry(() => import("./pages/help/PaymentMethods"), "page-help-payment-methods");
const CancelSubscription = lazyWithRetry(() => import("./pages/help/CancelSubscription"), "page-help-cancel-subscription");
const ReturnPolicy = lazyWithRetry(() => import("./pages/help/ReturnPolicy"), "page-help-return-policy");
const Logout = lazyWithRetry(() => import("./pages/Logout"), "page-logout");
const WriterAuth = lazyWithRetry(() => import("./pages/WriterAuth"), "page-writer-auth");
const WriterDashboard = lazyWithRetry(() => import("./pages/writer/WriterDashboard"), "page-writer-dashboard");
const WriterArticleEditor = lazyWithRetry(() => import("./pages/writer/WriterArticleEditor"), "page-writer-article-editor");
const AdminPortal = lazyWithRetry(() => import("./pages/AdminPortal"), "page-admin-portal");
const AdminPinReset = lazyWithRetry(() => import("./pages/AdminPinReset"), "page-admin-pin-reset");
const PodcasterApplication = lazyWithRetry(() => import("./pages/PodcasterApplication"), "page-podcaster-application");
const PodcasterApplicationsManagement = lazyWithRetry(() => import("./pages/admin/PodcasterApplicationsManagement"), "page-admin-podcaster-applications-management");
const DailyReports = lazyWithRetry(() => import("./pages/admin/DailyReports"), "page-admin-daily-reports");
const PredictionsManagement = lazyWithRetry(() => import("./pages/admin/PredictionsManagement"), "page-admin-predictions-management");
const PollManagement = lazyWithRetry(() => import("./pages/admin/PollManagement"), "page-admin-poll-management");
const PlayerOfTheMonthManagement = lazyWithRetry(() => import("./pages/admin/PlayerOfTheMonthManagement"), "page-admin-player-of-the-month-management");
const SocialMediaSettings = lazyWithRetry(() => import("./pages/admin/SocialMediaSettings"), "page-admin-social-media-settings");
const MediaLibrary = lazyWithRetry(() => import("./pages/admin/MediaLibrary"), "page-admin-media-library");
const ToastPromptManagement = lazyWithRetry(() => import("./pages/admin/ToastPromptManagement"), "page-admin-toast-prompt-management");
const PopupNotificationsManagement = lazyWithRetry(() => import("./pages/admin/PopupNotificationsManagement"), "page-admin-popup-notifications-management");
const SweepstakesManagement = lazyWithRetry(() => import("./pages/admin/SweepstakesManagement"), "page-admin-sweepstakes-management");
const WhatsNew = lazyWithRetry(() => import("./pages/WhatsNew"), "page-whats-new");
const RewardClaim = lazyWithRetry(() => import("./pages/RewardClaim"), "page-reward-claim");
const LoyaltyRewardsManagement = lazyWithRetry(() => import("./pages/admin/LoyaltyRewardsManagement"), "page-admin-loyalty-rewards");
const Install = lazyWithRetry(() => import("./pages/Install"), "page-install");
const MetsVsAstros = lazyWithRetry(() => import("./pages/matchups/MetsVsAstros"), "page-matchup-astros");
const MetsVsBraves = lazyWithRetry(() => import("./pages/matchups/MetsVsBraves"), "page-matchup-braves");
const MetsVsCardinals = lazyWithRetry(() => import("./pages/matchups/MetsVsCardinals"), "page-matchup-cardinals");
const MetsVsNationals = lazyWithRetry(() => import("./pages/matchups/MetsVsNationals"), "page-matchup-nationals");
const MetsVsRedSox = lazyWithRetry(() => import("./pages/matchups/MetsVsRedSox"), "page-matchup-redsox");
const MetsVsYankees = lazyWithRetry(() => import("./pages/matchups/MetsVsYankees"), "page-matchup-yankees");
const MetsVsBlueJays = lazyWithRetry(() => import("./pages/matchups/MetsVsBlueJays"), "page-matchup-bluejays");
const EmailTemplateSettings = lazyWithRetry(() => import("./pages/admin/EmailTemplateSettings"), "page-admin-email-template-settings");
const AIAssistant = lazyWithRetry(() => import("./pages/admin/AIAssistant"), "page-admin-ai-assistant");
const GameDayLive = lazyWithRetry(() => import("./pages/GameDayLive"), "page-gameday-live");
const GameDayLiveAdmin = lazyWithRetry(() => import("./pages/admin/GameDayLiveAdmin"), "page-admin-gameday-live");



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
        <SweepstakesWheel />
        <DesktopWelcomeGate />
        <UpdatePrompt />
        <RouteShareMetadata />
        
        <RouteErrorBoundary resetKey={location.pathname}>
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
            <Route path="/dashboard/cancellation-status" element={<CancellationStatus />} />

            <Route path="/blog" element={<Blog />} />
            <Route path="/blog/:slug" element={<BlogPost />} />
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
            <Route path="/unsubscribe" element={<Unsubscribe />} />
            <Route path="/rewards/claim" element={<RewardClaim />} />
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
            <Route path="/private-player" element={<PrivateLivePlayer />} />
            <Route path="/metsxm-player" element={<MetsXMPlayer />} />
            <Route path="/admin-pin-reset" element={<AdminPinReset />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="hero" element={<HeroManagement />} />
              <Route path="blog" element={<BlogManagement />} />
              <Route path="blog/new" element={<ArticleEditor />} />
              <Route path="blog/edit/:id" element={<ArticleEditor />} />
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
              <Route path="trials" element={<TrialManagement />} />
              <Route path="backgrounds" element={<BackgroundManagement />} />
              <Route path="activity" element={<ActivityDashboard />} />
              <Route path="writer-applications" element={<WriterApplications />} />
              <Route path="realtime-analytics" element={<RealtimeAnalytics />} />
              <Route path="stream-health" element={<StreamHealthDashboard />} />
              <Route path="stream-tester" element={<StreamTester />} />
              <Route path="feed-health" element={<FeedHealth />} />
              <Route path="seo" element={<SEOManagement />} />
              <Route path="game-notifications" element={<GameNotifications />} />
              <Route path="game-alerts" element={<GameAlertsManagement />} />
              <Route path="podcaster-applications" element={<PodcasterApplicationsManagement />} />
              <Route path="daily-reports" element={<DailyReports />} />
              <Route path="daily-reports" element={<DailyReports />} />
              <Route path="predictions" element={<PredictionsManagement />} />
              <Route path="polls" element={<PollManagement />} />
              <Route path="settings" element={<AdminSettings />} />
              <Route path="welcome-screen" element={<WelcomeScreenManagement />} />
              <Route path="private-player" element={<PrivatePlayer />} />
              <Route path="social-media" element={<SocialMediaSettings />} />
              <Route path="tutorials" element={<TutorialManagement />} />
              <Route path="media-library" element={<MediaLibrary />} />
              <Route path="toast-prompts" element={<ToastPromptManagement />} />
              <Route path="popup-notifications" element={<PopupNotificationsManagement />} />
              
              <Route path="player-of-the-month" element={<PlayerOfTheMonthManagement />} />
              <Route path="sweepstakes" element={<SweepstakesManagement />} />
              <Route path="gameday-live" element={<GameDayLiveAdmin />} />
              <Route path="game-recaps" element={<GameRecapsManagement />} />
              <Route path="podcast-outlines" element={<PodcastOutlineTemplates />} />
              <Route path="ai-assistant" element={<AIAssistant />} />
              <Route path="loyalty-rewards" element={<LoyaltyRewardsManagement />} />
            </Route>
            {/* Writer Portal Routes */}
            <Route path="/writer" element={<WriterDashboard />} />
            <Route path="/writer/new-article" element={<WriterArticleEditor />} />
            <Route path="/writer/edit/:id" element={<WriterArticleEditor />} />
            {/* Spring Training page removed */}
            <Route path="/replay-games" element={<ReplayGames />} />
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
            <Route path="/mets-game-recaps" element={<MetsGameRecaps />} />
            <Route path="/mets-game-recaps/:slug" element={<MetsGameRecaps />} />
            <Route path="/gameday-live" element={<GameDayLive />} />
            <Route path="/mlb-network" element={<MLBNetwork />} />
            <Route path="/espn-network" element={<ESPNNetwork />} />
            <Route path="/pix11-network" element={<PIX11Network />} />
            <Route path="/msg-network" element={<MSGNetwork />} />
            <Route path="/msg-plus" element={<MSGPlus />} />
            <Route path="/live/:streamId" element={<LiveStream />} />
            <Route path="/matchup/astros" element={<MetsVsAstros />} />
            <Route path="/matchup/braves" element={<MetsVsBraves />} />
            <Route path="/matchup/cardinals" element={<MetsVsCardinals />} />
            <Route path="/matchup/nationals" element={<MetsVsNationals />} />
            <Route path="/matchup/redsox" element={<MetsVsRedSox />} />
            <Route path="/matchup/yankees" element={<MetsVsYankees />} />
            <Route path="/matchup/bluejays" element={<MetsVsBlueJays />} />
            {/* Programmatic SEO: auto-generated matchup pages for every opponent */}
            <Route path="/matchup/:opponent" element={<DynamicMatchup />} />
            <Route path="/sitemap.xml" element={<Sitemap />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
        </RouteErrorBoundary>

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
