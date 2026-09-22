import {
  Home, FileText, Video, Radio, Bell, Mic, TrendingUp,
  MessageSquare, Users, Mail, Palette,
  Megaphone, BookOpen, Trophy, UserCog, Send, Wallpaper, ShoppingBag,
  Activity, AlertTriangle, PenLine, HeartPulse, Settings, Layers, Sparkles, Monitor,
  ClipboardList, Star, BarChart3, Share2, FolderOpen, Gift, Bot, Search,
  Calendar, ShieldCheck, CreditCard, MousePointerClick
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
    title: "Dashboard",
    icon: Home,
    items: [
      { title: "Dashboard", url: "/admin", icon: Home },
    ],
  },
  {
    title: "Streaming",
    icon: Radio,
    items: [
      { title: "Live Streams", url: "/admin/live-streams", icon: Radio },
      { title: "Stream Issues", url: "/admin/stream-issues", icon: AlertTriangle },
    ],
  },
  {
    title: "Articles",
    icon: PenLine,
    items: [
      { title: "Write Article", url: "/admin/blog/new", icon: PenLine },
      { title: "All Articles", url: "/admin/blog", icon: FileText },
    ],
  },
  {
    title: "Content",
    icon: Layers,
    items: [
      { title: "Stories", url: "/admin/stories", icon: Sparkles },
      { title: "Hero Slides", url: "/admin/hero", icon: Layers },
      { title: "Media Library", url: "/admin/media-library", icon: FolderOpen },
    ],
  },
  {
    title: "Members",
    icon: Users,
    items: [
      { title: "Member Center", url: "/admin/user-management", icon: Users },
      { title: "Subscriptions", url: "/admin/subscriptions", icon: CreditCard },
    ],
  },
  {
    title: "Notifications",
    icon: Bell,
    items: [
      { title: "Push Notifications", url: "/admin/game-notifications", icon: Bell },
      { title: "Game Alerts", url: "/admin/game-alerts", icon: Megaphone },
      { title: "Popup Alerts", url: "/admin/popup-notifications", icon: Megaphone },
    ],
  },
  {
    title: "More",
    icon: Settings,
    items: [
      { title: "AI Assistant", url: "/admin/ai-assistant", icon: Bot },
      { title: "Activity & Logins", url: "/admin/activity", icon: Activity },
      { title: "Real-Time Stats", url: "/admin/realtime-analytics", icon: TrendingUp },
      { title: "Daily Reports", url: "/admin/daily-reports", icon: ClipboardList },
      { title: "Stream Health", url: "/admin/stream-health", icon: HeartPulse },
      { title: "Feed Health", url: "/admin/feed-health", icon: Activity },
      { title: "Stream Tester", url: "/admin/stream-tester", icon: Monitor },
      { title: "Radio Network", url: "/admin/gameday-live", icon: Radio },
      { title: "Podcast Live", url: "/admin/podcast-live-stream", icon: Mic },
      { title: "Private Player", url: "/admin/private-player", icon: Monitor },
      { title: "MetsXM Player", url: "/metsxm-player", icon: Monitor },
      { title: "Podcasts", url: "/admin/podcasts", icon: Mic },
      { title: "Clubhouse Studio", url: "/admin/studio", icon: Radio },
      { title: "Podcast Outlines", url: "/admin/podcast-outlines", icon: ClipboardList },
      { title: "Podcaster Apps", url: "/admin/podcaster-applications", icon: Mic },
      { title: "Game Recaps", url: "/admin/game-recaps", icon: Trophy },
      { title: "Highlights", url: "/admin/video-gallery-management", icon: Video },
      { title: "Community Posts", url: "/admin/posts", icon: FileText },
      { title: "Events", url: "/admin/events", icon: Calendar },
      { title: "Polls", url: "/admin/polls", icon: BarChart3 },
      { title: "Predictions", url: "/admin/predictions", icon: Star },
      { title: "Feedback", url: "/admin/feedbacks", icon: MessageSquare },
      { title: "Player of Month", url: "/admin/player-of-the-month", icon: Trophy },
      { title: "Business Ads", url: "/admin/business-ads", icon: Megaphone },
      { title: "Sweepstakes", url: "/admin/sweepstakes", icon: Gift },
      { title: "Loyalty Rewards", url: "/admin/loyalty-rewards", icon: Gift },
      { title: "Trials & Promos", url: "/admin/trials", icon: Star },
      { title: "Newsletter", url: "/admin/newsletter", icon: Mail },
      { title: "Writer Apps", url: "/admin/writer-applications", icon: ClipboardList },
      { title: "Toast Prompts", url: "/admin/toast-prompts", icon: Bell },
      { title: "Email Editor", url: "/admin/email-editor", icon: Send },
      { title: "Email Templates", url: "/admin/email-templates", icon: Palette },
      { title: "Access Roles", url: "/admin/roles", icon: ShieldCheck },
      { title: "SEO Settings", url: "/admin/seo", icon: Search },
      { title: "Admin Settings", url: "/admin/settings", icon: Settings },
      { title: "Welcome Screen", url: "/admin/welcome-screen", icon: Monitor },
      { title: "Backgrounds", url: "/admin/backgrounds", icon: Wallpaper },
      { title: "Social Media", url: "/admin/social-media", icon: Share2 },
      { title: "Tutorials", url: "/admin/tutorials", icon: BookOpen },
    ],
  },
];

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
