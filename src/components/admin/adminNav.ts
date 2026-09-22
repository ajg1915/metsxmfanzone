import {
  Home, FileText, Video, Radio, Bell, Mic, TrendingUp,
  MessageSquare, Users, Mail, Palette,
  Megaphone, BookOpen, Trophy, UserCog, Send, Wallpaper, ShoppingBag,
  Activity, AlertTriangle, PenLine, HeartPulse, Settings, Layers, Sparkles, Monitor,
  ClipboardList, Star, BarChart3, Share2, FolderOpen, Gift, Bot,
} from "lucide-react";

export type AdminNavItem = {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
};

export type AdminNavSection = {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: AdminNavItem[];
};

export const ADMIN_NAV: AdminNavSection[] = [
  {
    title: "Overview",
    icon: Home,
    items: [
      { title: "Dashboard", url: "/admin", icon: Home },
      { title: "AI Assistant", url: "/admin/ai-assistant", icon: Bot },
      { title: "Real-Time Stats", url: "/admin/realtime-analytics", icon: TrendingUp },
      { title: "Daily Reports", url: "/admin/daily-reports", icon: ClipboardList },
      { title: "Activity Logs", url: "/admin/activity", icon: Activity },
    ],
  },
  {
    title: "Streaming",
    icon: Radio,
    items: [
      { title: "Live Streams", url: "/admin/live-streams", icon: Radio },
      { title: "Stream Health", url: "/admin/stream-health", icon: HeartPulse },
      { title: "Stream Issues", url: "/admin/stream-issues", icon: AlertTriangle },
      { title: "Feed Health", url: "/admin/feed-health", icon: Activity },
      { title: "Stream Tester", url: "/admin/stream-tester", icon: Activity },
      { title: "Private Player", url: "/admin/private-player", icon: Monitor },
      { title: "MetsXM Player", url: "/metsxm-player", icon: Monitor },
      { title: "Radio Network", url: "/admin/gameday-live", icon: Sparkles },
      { title: "Podcast Live", url: "/admin/podcast-live-stream", icon: Mic },
    ],
  },
  {
    title: "Articles",
    icon: PenLine,
    items: [
      { title: "Write Article", url: "/admin/blog/new", icon: PenLine },
      { title: "All Articles", url: "/admin/blog", icon: FileText },
      { title: "Writer Apps", url: "/admin/writer-applications", icon: ClipboardList },
    ],
  },
  {
    title: "Content",
    icon: FolderOpen,
    items: [
      { title: "Hero Slides", url: "/admin/hero", icon: Layers },
      { title: "Stories", url: "/admin/stories", icon: Sparkles },
      { title: "Game Recaps", url: "/admin/game-recaps", icon: Trophy },
      { title: "Highlights", url: "/admin/video-gallery-management", icon: Video },
      { title: "Media Library", url: "/admin/media-library", icon: FolderOpen },
    ],
  },
  {
    title: "Podcasts",
    icon: Mic,
    items: [
      { title: "Podcasts", url: "/admin/podcasts", icon: Mic },
      { title: "Podcast Outlines", url: "/admin/podcast-outlines", icon: ClipboardList },
      { title: "Clubhouse Studio", url: "/admin/studio", icon: Radio },
      { title: "Podcaster Apps", url: "/admin/podcaster-applications", icon: Mic },
    ],
  },
  {
    title: "Community",
    icon: MessageSquare,
    items: [
      { title: "Posts", url: "/admin/posts", icon: FileText },
      { title: "Feedback", url: "/admin/feedbacks", icon: MessageSquare },
      { title: "Polls", url: "/admin/polls", icon: BarChart3 },
      { title: "Predictions", url: "/admin/predictions", icon: Star },
      { title: "Player of the Month", url: "/admin/player-of-the-month", icon: Trophy },
      { title: "Sweepstakes", url: "/admin/sweepstakes", icon: Gift },
      { title: "Loyalty Rewards", url: "/admin/loyalty-rewards", icon: Gift },
    ],
  },
  {
    title: "Commerce",
    icon: ShoppingBag,
    items: [{ title: "Business Ads", url: "/admin/business-ads", icon: Megaphone }],
  },
  {
    title: "Members",
    icon: Users,
    items: [
      { title: "Members", url: "/admin/user-management", icon: UserCog },
      { title: "Free Trials & Promos", url: "/admin/trials", icon: Gift },
      { title: "Writer Apps", url: "/admin/writer-applications", icon: PenLine },
    ],
  },
  {
    title: "Notifications",
    icon: Bell,
    items: [
      { title: "Push Notifications", url: "/admin/game-notifications", icon: Bell },
      { title: "Game Alerts", url: "/admin/game-alerts", icon: Megaphone },
      { title: "Popup Alerts", url: "/admin/popup-notifications", icon: Megaphone },
      { title: "Toast Prompts", url: "/admin/toast-prompts", icon: Bell },
    ],
  },
  {
    title: "Email",
    icon: Mail,
    items: [
      { title: "Newsletter", url: "/admin/newsletter", icon: Mail },
      { title: "Email Editor", url: "/admin/email-editor", icon: Send },
      { title: "Email Templates", url: "/admin/email-templates", icon: Palette },
    ],
  },
  {
    title: "Settings",
    icon: Settings,
    items: [
      { title: "Admin Settings", url: "/admin/settings", icon: Settings },
      { title: "Welcome Screen", url: "/admin/welcome-screen", icon: Monitor },
      { title: "Backgrounds", url: "/admin/backgrounds", icon: Wallpaper },
      { title: "Social Media", url: "/admin/social-media", icon: Share2 },
      { title: "Tutorials", url: "/admin/tutorials", icon: BookOpen },
    ],
  },
];

// Shortcuts shown in the mobile bottom bar.
export const ADMIN_QUICK_NAV: AdminNavItem[] = [
  { title: "Home", url: "/admin", icon: Home },
  { title: "Live", url: "/admin/live-streams", icon: Radio },
  { title: "Blog", url: "/admin/blog", icon: FileText },
  { title: "Media", url: "/admin/media-library", icon: FolderOpen },
  { title: "Members", url: "/admin/user-management", icon: UserCog },
];

export const ADMIN_NAV_ITEMS: Array<AdminNavItem & { section: string }> = ADMIN_NAV.flatMap(
  (section) => section.items.map((item) => ({ ...item, section: section.title }))
);
