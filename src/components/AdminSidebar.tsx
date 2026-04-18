import { 
  Home, FileText, Video, Radio, Bell, Mic, TrendingUp, 
  MessageSquare, ChevronDown, Users, Mail, Palette,
  Megaphone, BookOpen, CalendarDays, Trophy, UserCog, Send, Wallpaper, ShoppingBag, 
  Activity, PenLine, HeartPulse, Globe, Settings, Layers, Sparkles, 
  ClipboardList, Star, BarChart3, Share2, FolderOpen, Gift
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useState } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

// Home / Overview items
const homeItems = [
  { title: "Dashboard", url: "/admin", icon: Home },
  { title: "Hero Slides", url: "/admin/hero", icon: Layers },
  { title: "Media Library", url: "/admin/media-library", icon: FolderOpen },
  { title: "Live Streams", url: "/admin/live-streams", icon: Radio },
  { title: "Radio Network", url: "/admin/gameday-live", icon: Sparkles },
  { title: "Stream Health", url: "/admin/stream-health", icon: HeartPulse },
  { title: "Stream Tester", url: "/admin/stream-tester", icon: Activity },
  { title: "Members", url: "/admin/user-management", icon: UserCog },
];

// Content & Media items - Blog, Stories, Videos, Podcasts, Newsletter
const mediaItems = [
  { title: "Blog", url: "/admin/blog", icon: FileText },
  { title: "Stories", url: "/admin/stories", icon: Sparkles },
  { title: "Highlights", url: "/admin/video-gallery-management", icon: Video },
  { title: "Podcasts", url: "/admin/podcasts", icon: Mic },
  { title: "Clubhouse Studio", url: "/admin/studio", icon: Radio },
  { title: "Newsletter", url: "/admin/newsletter", icon: Mail },
  { title: "Email Editor", url: "/admin/email-editor", icon: Send },
  { title: "Email Templates", url: "/admin/email-templates", icon: Palette },
];

// Settings items (moved to prominent position)
const settingsNavItems = [
  { title: "Admin Settings", url: "/admin/settings", icon: Settings },
  { title: "Backgrounds", url: "/admin/backgrounds", icon: Wallpaper },
  { title: "Social Media", url: "/admin/social-media", icon: Share2 },
  { title: "Toast Prompts", url: "/admin/toast-prompts", icon: Bell },
  { title: "Popup Alerts", url: "/admin/popup-notifications", icon: Megaphone },
  { title: "Tutorials", url: "/admin/tutorials", icon: BookOpen },
];

// Live & Streaming
const liveItems = [
  { title: "Push Notifications", url: "/admin/game-notifications", icon: Bell },
  { title: "Game Alerts", url: "/admin/game-alerts", icon: Megaphone },
  { title: "Podcast Live", url: "/admin/podcast-live-stream", icon: Mic },
];

// Events & Schedules (removed Events and Spring Training per user request)

// Users & Community - Users, Roles, Subscriptions, Feedback, Posts, etc.
const usersItems = [
  { title: "Writer Apps", url: "/admin/writer-applications", icon: PenLine },
  { title: "Podcaster Apps", url: "/admin/podcaster-applications", icon: Mic },
];

// Community Content - Posts, Feedback, Business Ads, Polls
const communityItems = [
  { title: "Posts", url: "/admin/posts", icon: FileText },
  { title: "Feedback", url: "/admin/feedbacks", icon: MessageSquare },
  { title: "Predictions", url: "/admin/predictions", icon: Star },
  { title: "Business Ads", url: "/admin/business-ads", icon: Megaphone },
  { title: "Shop", url: "/admin/shop", icon: ShoppingBag },
  { title: "Polls", url: "/admin/polls", icon: BarChart3 },
  { title: "Player of the Month", url: "/admin/player-of-the-month", icon: Trophy },
  { title: "Sweepstakes", url: "/admin/sweepstakes", icon: Gift },
];

// Analytics & SEO
const analyticsItems = [
  { title: "Daily Reports", url: "/admin/daily-reports", icon: ClipboardList },
  { title: "Real-Time Stats", url: "/admin/realtime-analytics", icon: TrendingUp },
  { title: "Activity Logs", url: "/admin/activity", icon: Activity },
  { title: "SEO Settings", url: "/admin/seo", icon: Globe },
];


export function AdminSidebar() {
  const { open } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;
  
  const [homeOpen, setHomeOpen] = useState(true);
  const [mediaOpen, setMediaOpen] = useState(true);
  const [liveOpen, setLiveOpen] = useState(true);
  const [eventsOpen, setEventsOpen] = useState(true);
  const [usersOpen, setUsersOpen] = useState(true);
  const [communityOpen, setCommunityOpen] = useState(true);
  const [analyticsOpen, setAnalyticsOpen] = useState(true);

  const isActive = (path: string) => {
    if (path === "/admin") {
      return currentPath === path;
    }
    return currentPath.startsWith(path);
  };

  const renderCollapsibleSection = (
    title: string,
    icon: React.ComponentType<{ className?: string }>,
    items: typeof homeItems,
    isOpen: boolean,
    setIsOpen: (open: boolean) => void
  ) => {
    const Icon = icon;
    return (
      <SidebarGroup>
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <SidebarGroupLabel asChild>
            <CollapsibleTrigger className="flex items-center justify-between w-full hover:bg-muted/50 rounded-md px-2 py-1.5">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span className="text-xs font-medium">{title}</span>
              </div>
              <ChevronDown 
                className={`h-3 w-3 transition-transform flex-shrink-0 ${isOpen ? "rotate-180" : ""}`}
              />
            </CollapsibleTrigger>
          </SidebarGroupLabel>
          <CollapsibleContent>
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild tooltip={item.title}>
                      <NavLink
                        to={item.url}
                        className={({ isActive: active }) =>
                          `flex items-center gap-2 pl-4 ${active || isActive(item.url)
                            ? "bg-primary text-primary-foreground font-medium"
                            : "hover:bg-muted/50"}`
                        }
                      >
                        <item.icon className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="text-xs truncate">{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </CollapsibleContent>
        </Collapsible>
      </SidebarGroup>
    );
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-muted/30">
      <SidebarContent className="gap-1 py-2">
        {/* Home / Overview */}
        {renderCollapsibleSection("Home", Home, homeItems, homeOpen, setHomeOpen)}

        {/* Settings (prominent position) */}
        {renderCollapsibleSection("Settings", Settings, settingsNavItems, liveOpen, setLiveOpen)}

        {/* Content & Media */}
        {renderCollapsibleSection("Content", FolderOpen, mediaItems, mediaOpen, setMediaOpen)}

        {/* Live & Streaming */}
        {renderCollapsibleSection("Live", Radio, liveItems, eventsOpen, setEventsOpen)}


        {/* Users & Accounts */}
        {renderCollapsibleSection("Users", Users, usersItems, usersOpen, setUsersOpen)}

        {/* Community Content */}
        {renderCollapsibleSection("Community", MessageSquare, communityItems, communityOpen, setCommunityOpen)}

        {/* Analytics & SEO */}
        {renderCollapsibleSection("Analytics", TrendingUp, analyticsItems, analyticsOpen, setAnalyticsOpen)}

      </SidebarContent>
    </Sidebar>
  );
}
