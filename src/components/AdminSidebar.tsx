import { 
  Home, FileText, Video, Radio, Bell, Mic, TrendingUp, 
  MessageSquare, ChevronDown, Users, Mail, Palette,
  Megaphone, BookOpen, Trophy, UserCog, Send, Wallpaper, ShoppingBag, 
  Activity, PenLine, HeartPulse, Settings, Layers, Sparkles, Monitor, 
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
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const overviewItems = [
  { title: "Dashboard", url: "/admin", icon: Home },
  { title: "Real-Time Stats", url: "/admin/realtime-analytics", icon: TrendingUp },
  { title: "Daily Reports", url: "/admin/daily-reports", icon: ClipboardList },
  { title: "Activity Logs", url: "/admin/activity", icon: Activity },
];

const streamingItems = [
  { title: "Live Streams", url: "/admin/live-streams", icon: Radio },
  { title: "Stream Health", url: "/admin/stream-health", icon: HeartPulse },
  { title: "Stream Tester", url: "/admin/stream-tester", icon: Activity },
  { title: "Radio Network", url: "/admin/gameday-live", icon: Sparkles },
  { title: "Podcast Live", url: "/admin/podcast-live-stream", icon: Mic },
];

const contentItems = [
  { title: "Hero Slides", url: "/admin/hero", icon: Layers },
  { title: "Stories", url: "/admin/stories", icon: Sparkles },
  { title: "Blog", url: "/admin/blog", icon: FileText },
  { title: "Game Recaps", url: "/admin/game-recaps", icon: Trophy },
  { title: "Highlights", url: "/admin/video-gallery-management", icon: Video },
  { title: "Media Library", url: "/admin/media-library", icon: FolderOpen },
];

const podcastItems = [
  { title: "Podcasts", url: "/admin/podcasts", icon: Mic },
  { title: "Podcast Outlines", url: "/admin/podcast-outlines", icon: ClipboardList },
  { title: "Clubhouse Studio", url: "/admin/studio", icon: Radio },
  { title: "Podcaster Apps", url: "/admin/podcaster-applications", icon: Mic },
];

const communityItems = [
  { title: "Posts", url: "/admin/posts", icon: FileText },
  { title: "Feedback", url: "/admin/feedbacks", icon: MessageSquare },
  { title: "Polls", url: "/admin/polls", icon: BarChart3 },
  { title: "Predictions", url: "/admin/predictions", icon: Star },
  { title: "Player of the Month", url: "/admin/player-of-the-month", icon: Trophy },
  { title: "Sweepstakes", url: "/admin/sweepstakes", icon: Gift },
  { title: "Loyalty Rewards", url: "/admin/loyalty-rewards", icon: Gift },
];

const commerceItems = [
  { title: "Business Ads", url: "/admin/business-ads", icon: Megaphone },
];

const membersItems = [
  { title: "Members", url: "/admin/user-management", icon: UserCog },
  { title: "Writer Apps", url: "/admin/writer-applications", icon: PenLine },
];

const notificationsItems = [
  { title: "Push Notifications", url: "/admin/game-notifications", icon: Bell },
  { title: "Game Alerts", url: "/admin/game-alerts", icon: Megaphone },
  { title: "Popup Alerts", url: "/admin/popup-notifications", icon: Megaphone },
  { title: "Toast Prompts", url: "/admin/toast-prompts", icon: Bell },
];

const emailItems = [
  { title: "Newsletter", url: "/admin/newsletter", icon: Mail },
  { title: "Email Editor", url: "/admin/email-editor", icon: Send },
  { title: "Email Templates", url: "/admin/email-templates", icon: Palette },
];

const settingsItems = [
  { title: "Admin Settings", url: "/admin/settings", icon: Settings },
  { title: "Welcome Screen", url: "/admin/welcome-screen", icon: Monitor },
  { title: "Backgrounds", url: "/admin/backgrounds", icon: Wallpaper },
  { title: "Social Media", url: "/admin/social-media", icon: Share2 },
  { title: "Tutorials", url: "/admin/tutorials", icon: BookOpen },
];

export function AdminSidebar() {
  const location = useLocation();
  const currentPath = location.pathname;

  const isActive = (path: string) => {
    if (path === "/admin") return currentPath === path;
    return currentPath.startsWith(path);
  };

  const sections: Array<{
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    items: typeof overviewItems;
  }> = [
    { title: "Overview", icon: Home, items: overviewItems },
    { title: "Streaming", icon: Radio, items: streamingItems },
    { title: "Content", icon: FolderOpen, items: contentItems },
    { title: "Podcasts", icon: Mic, items: podcastItems },
    { title: "Community", icon: MessageSquare, items: communityItems },
    { title: "Commerce", icon: ShoppingBag, items: commerceItems },
    { title: "Members", icon: Users, items: membersItems },
    { title: "Notifications", icon: Bell, items: notificationsItems },
    { title: "Email", icon: Mail, items: emailItems },
    { title: "Settings", icon: Settings, items: settingsItems },
  ];

  const initialOpen = () => {
    const state: Record<string, boolean> = {};
    sections.forEach((s) => {
      state[s.title] = s.title === "Overview" || s.items.some((i) => isActive(i.url));
    });
    return state;
  };
  const [openMap, setOpenMap] = useState<Record<string, boolean>>(initialOpen);
  const setOpen = (title: string, value: boolean) =>
    setOpenMap((m) => ({ ...m, [title]: value }));

  return (
    <Sidebar collapsible="icon" className="border-r border-muted/30">
      <SidebarContent className="gap-1 py-2">
        {sections.map(({ title, icon: Icon, items }) => {
          const isOpen = !!openMap[title];
          return (
            <SidebarGroup key={title}>
              <Collapsible open={isOpen} onOpenChange={(v) => setOpen(title, v)}>
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
                      {items.map((item) => {
                        const active = isActive(item.url);
                        return (
                          <SidebarMenuItem key={item.title}>
                            <SidebarMenuButton asChild tooltip={item.title} isActive={active}>
                              <NavLink
                                to={item.url}
                                className={`relative flex items-center gap-2 pl-4 rounded-md transition-all duration-200 ${
                                  active
                                    ? "bg-gradient-to-r from-primary/90 via-primary to-orange-500/80 text-primary-foreground font-semibold shadow-[0_0_18px_-4px_hsl(var(--primary)/0.7)] ring-1 ring-primary/40 before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-1 before:rounded-full before:bg-orange-400 before:shadow-[0_0_10px_hsl(25_95%_55%/0.9)]"
                                    : "hover:bg-muted/50 hover:translate-x-0.5"
                                }`}
                              >
                                <item.icon className={`h-3.5 w-3.5 flex-shrink-0 ${active ? "drop-shadow-[0_0_4px_rgba(255,255,255,0.8)]" : ""}`} />
                                <span className="text-xs truncate">{item.title}</span>
                              </NavLink>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      })}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </Collapsible>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
    </Sidebar>
  );
}
