import {
  Home, FileText, Video, Radio, Bell, Mic, TrendingUp,
  MessageSquare, Users, Mail, Palette,
  Megaphone, BookOpen, Trophy, Send, Wallpaper,
  Activity, AlertTriangle, PenLine, HeartPulse, Settings, Layers, Sparkles, Monitor,
  ClipboardList, Star, BarChart3, Share2, FolderOpen, Gift, Bot, Search,
  Calendar, ShieldCheck, CreditCard,
} from "lucide-react";

type Icon = React.ComponentType<{ className?: string }>;

export type AdminNavItem = {
  title: string;
  url: string;
  icon: Icon;
};

export type AdminNavSection = {
  title: string;
  icon: Icon;
  items: AdminNavItem[];
};

/** A tab inside a hub. A group with several pages shows them as pills under the tab. */
export type AdminHubGroup = {
  title: string;
  items: AdminNavItem[];
};

export type AdminHub = {
  key: string;
  title: string;
  icon: Icon;
  hint: string;
  groups: AdminHubGroup[];
};

export const ADMIN_HUBS: AdminHub[] = [
  {
    key: "home",
    title: "Home",
    icon: Home,
    hint: "Dashboard",
    groups: [
      { title: "Dashboard", items: [{ title: "Dashboard", url: "/admin", icon: Home }] },
    ],
  },
  {
    key: "live",
    title: "Live",
    icon: Radio,
    hint: "Streams, health, players",
    groups: [
      { title: "Live Streams", items: [{ title: "Live Streams", url: "/admin/live-streams", icon: Radio }] },
      { title: "Stream Issues", items: [{ title: "Stream Issues", url: "/admin/stream-issues", icon: AlertTriangle }] },
      {
        title: "Health & Tests",
        items: [
          { title: "Stream Health", url: "/admin/stream-health", icon: HeartPulse },
          { title: "Feed Health", url: "/admin/feed-health", icon: Activity },
          { title: "Stream Tester", url: "/admin/stream-tester", icon: Monitor },
        ],
      },
      {
        title: "Players & Radio",
        items: [
          { title: "Radio Network", url: "/admin/gameday-live", icon: Radio },
          { title: "Podcast Live", url: "/admin/podcast-live-stream", icon: Mic },
          { title: "Private Player", url: "/admin/private-player", icon: Monitor },
          { title: "MetsXM Player", url: "/metsxm-player", icon: Monitor },
        ],
      },
    ],
  },
  {
    key: "content",
    title: "Content",
    icon: FileText,
    hint: "Articles, media, podcasts",
    groups: [
      {
        title: "Articles",
        items: [
          { title: "Write Article", url: "/admin/blog/new", icon: PenLine },
          { title: "All Articles", url: "/admin/blog", icon: FileText },
        ],
      },
      {
        title: "Stories & Hero",
        items: [
          { title: "Stories", url: "/admin/stories", icon: Sparkles },
          { title: "Hero Slides", url: "/admin/hero", icon: Layers },
        ],
      },
      {
        title: "Media",
        items: [
          { title: "Media Library", url: "/admin/media-library", icon: FolderOpen },
          { title: "Highlights", url: "/admin/video-gallery-management", icon: Video },
          { title: "Game Recaps", url: "/admin/game-recaps", icon: Trophy },
        ],
      },
      {
        title: "Podcasts",
        items: [
          { title: "Podcasts", url: "/admin/podcasts", icon: Mic },
          { title: "Clubhouse Studio", url: "/admin/studio", icon: Radio },
          { title: "Podcast Outlines", url: "/admin/podcast-outlines", icon: ClipboardList },
        ],
      },
      { title: "Community Posts", items: [{ title: "Community Posts", url: "/admin/posts", icon: FileText }] },
      { title: "Tutorials", items: [{ title: "Tutorials", url: "/admin/tutorials", icon: BookOpen }] },
    ],
  },
  {
    key: "members",
    title: "Members",
    icon: Users,
    hint: "People, plans, rewards",
    groups: [
      {
        title: "People",
        items: [
          { title: "Member Center", url: "/admin/user-management", icon: Users },
          { title: "Access Roles", url: "/admin/roles", icon: ShieldCheck },
        ],
      },
      {
        title: "Plans",
        items: [
          { title: "Subscriptions", url: "/admin/subscriptions", icon: CreditCard },
          { title: "Trials & Promos", url: "/admin/trials", icon: Star },
        ],
      },
      {
        title: "Rewards",
        items: [
          { title: "Loyalty Rewards", url: "/admin/loyalty-rewards", icon: Gift },
          { title: "Sweepstakes", url: "/admin/sweepstakes", icon: Gift },
        ],
      },
      {
        title: "Applications",
        items: [
          { title: "Podcaster Apps", url: "/admin/podcaster-applications", icon: Mic },
          { title: "Writer Apps", url: "/admin/writer-applications", icon: ClipboardList },
        ],
      },
    ],
  },
  {
    key: "engage",
    title: "Engage",
    icon: Bell,
    hint: "Polls, chat, alerts",
    groups: [
      {
        title: "Fan Features",
        items: [
          { title: "Polls", url: "/admin/polls", icon: BarChart3 },
          { title: "Predictions", url: "/admin/predictions", icon: Star },
          { title: "Events", url: "/admin/events", icon: Calendar },
          { title: "Player of Month", url: "/admin/player-of-the-month", icon: Trophy },
        ],
      },
      { title: "Chat", items: [{ title: "Chat", url: "/admin/chat", icon: MessageSquare }] },
      {
        title: "Alerts",
        items: [
          { title: "Push Notifications", url: "/admin/game-notifications", icon: Bell },
          { title: "Game Alerts", url: "/admin/game-alerts", icon: Megaphone },
          { title: "Popup Alerts", url: "/admin/popup-notifications", icon: Megaphone },
          { title: "Toast Prompts", url: "/admin/toast-prompts", icon: Bell },
        ],
      },
    ],
  },
  {
    key: "marketing",
    title: "Marketing",
    icon: Mail,
    hint: "Email, ads, social, SEO",
    groups: [
      {
        title: "Email",
        items: [
          { title: "Newsletter", url: "/admin/newsletter", icon: Mail },
          { title: "Email Editor", url: "/admin/email-editor", icon: Send },
          { title: "Email Templates", url: "/admin/email-templates", icon: Palette },
        ],
      },
      { title: "Business Ads", items: [{ title: "Business Ads", url: "/admin/business-ads", icon: Megaphone }] },
      { title: "Social Media", items: [{ title: "Social Media", url: "/admin/social-media", icon: Share2 }] },
      { title: "SEO Settings", items: [{ title: "SEO Settings", url: "/admin/seo", icon: Search }] },
    ],
  },
  {
    key: "insights",
    title: "Insights",
    icon: BarChart3,
    hint: "Stats, reports, AI",
    groups: [
      { title: "Real-Time Stats", items: [{ title: "Real-Time Stats", url: "/admin/realtime-analytics", icon: TrendingUp }] },
      { title: "Daily Reports", items: [{ title: "Daily Reports", url: "/admin/daily-reports", icon: ClipboardList }] },
      { title: "Activity & Logins", items: [{ title: "Activity & Logins", url: "/admin/activity", icon: Activity }] },
      { title: "AI Assistant", items: [{ title: "AI Assistant", url: "/admin/ai-assistant", icon: Bot }] },
    ],
  },
  {
    key: "settings",
    title: "Settings",
    icon: Settings,
    hint: "Welcome screen, front page, backgrounds",
    groups: [
      { title: "Admin Settings", items: [{ title: "Admin Settings", url: "/admin/settings", icon: Settings }] },
      { title: "Welcome Screen", items: [{ title: "Welcome Screen", url: "/admin/welcome-screen", icon: Monitor }] },
      { title: "Front Page", items: [{ title: "Front Page sections", url: "/admin/front-page", icon: Wallpaper }] },
      { title: "Backgrounds", items: [{ title: "Backgrounds", url: "/admin/backgrounds", icon: Wallpaper }] },
    ],
  },
];

/** Where tapping a hub in the sidebar or bottom bar lands: its first page. */
export const hubLandingUrl = (hub: AdminHub) => hub.groups[0].items[0].url;

export const hubPageCount = (hub: AdminHub) =>
  hub.groups.reduce((n, g) => n + g.items.length, 0);

/** Flat page list for a hub. */
export const hubItems = (hub: AdminHub): AdminNavItem[] => hub.groups.flatMap((g) => g.items);

/** Same pages as before, grouped by hub. Used by search (command palette and sidebar). */
export const ADMIN_NAV: AdminNavSection[] = ADMIN_HUBS.map((hub) => ({
  title: hub.title,
  icon: hub.icon,
  items: hubItems(hub),
}));

export const ADMIN_NAV_ITEMS: Array<AdminNavItem & { section: string }> = ADMIN_NAV.flatMap(
  (section) => section.items.map((item) => ({ ...item, section: section.title }))
);

const isUrlActive = (url: string, path: string) =>
  url === "/admin" ? path === url : path === url || path.startsWith(url + "/");

/** The hub that owns the current path. Longest matching page url wins. */
export const findActiveHub = (path: string): AdminHub | undefined => {
  let best: { hub: AdminHub; len: number } | undefined;
  for (const hub of ADMIN_HUBS) {
    for (const item of hubItems(hub)) {
      if (isUrlActive(item.url, path) && (!best || item.url.length > best.len)) {
        best = { hub, len: item.url.length };
      }
    }
  }
  return best?.hub;
};

/** The tab group that owns the current path inside a hub. */
export const findActiveGroup = (hub: AdminHub, path: string): AdminHubGroup | undefined => {
  let best: { group: AdminHubGroup; len: number } | undefined;
  for (const group of hub.groups) {
    for (const item of group.items) {
      if (isUrlActive(item.url, path) && (!best || item.url.length > best.len)) {
        best = { group, len: item.url.length };
      }
    }
  }
  return best?.group;
};

export { isUrlActive };

/** Bottom bar on phones: four hubs plus a Menu button that opens every hub. */
export const ADMIN_QUICK_HUBS = ["home", "live", "content", "members"];
