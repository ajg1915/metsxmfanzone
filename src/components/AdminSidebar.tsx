import {
  Home, FileText, Video, Radio, Bell, Mic, TrendingUp,
  MessageSquare, ChevronDown, Users, Mail, Palette,
  Megaphone, BookOpen, Trophy, UserCog, Send, Wallpaper, ShoppingBag,
  Activity, PenLine, HeartPulse, Settings, Layers, Sparkles, Monitor,
  ClipboardList, Star, BarChart3, Share2, FolderOpen, Gift, Bot
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useState } from "react";
import logo from "@/assets/metsxmfanzone-logo.png";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const overviewItems = [
  { title: "Dashboard", url: "/admin", icon: Home },
  { title: "AI Assistant", url: "/admin/ai-assistant", icon: Bot },
  { title: "Real-Time Stats", url: "/admin/realtime-analytics", icon: TrendingUp },
  { title: "Daily Reports", url: "/admin/daily-reports", icon: ClipboardList },
  { title: "Activity Logs", url: "/admin/activity", icon: Activity },
];

const streamingItems = [
  { title: "Live Streams", url: "/admin/live-streams", icon: Radio },
  { title: "Stream Health", url: "/admin/stream-health", icon: HeartPulse },
  { title: "Stream Tester", url: "/admin/stream-tester", icon: Activity },
  { title: "Private Player", url: "/admin/private-player", icon: Monitor },
  { title: "MetsXM Player", url: "/metsxm-player", icon: Monitor },
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
  { title: "Free Trials & Promos", url: "/admin/trials", icon: Gift },
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
    <Sidebar
      collapsible="icon"
      className="border-r border-white/5 bg-[#020617]/95 backdrop-blur-2xl"
    >
      <SidebarHeader className="p-4 group-data-[collapsible=icon]:p-2">
        <div className="flex items-center gap-2.5 px-1">
          <img
            src={logo}
            alt="MetsXMFanZone Logo"
            className="h-8 w-auto flex-shrink-0"
          />
          <span className="font-bold text-[15px] tracking-tight text-white truncate group-data-[collapsible=icon]:hidden">
            MetsXM<span className="text-[#FF5910]">FanZone</span>
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-0.5 px-2 py-1 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-white/10">
        {sections.map(({ title, icon: Icon, items }) => {
          const isOpen = !!openMap[title];
          return (
            <SidebarGroup key={title} className="px-0 py-0.5">
              <Collapsible open={isOpen} onOpenChange={(v) => setOpen(title, v)}>
                <SidebarGroupLabel asChild>
                  <CollapsibleTrigger className="flex items-center justify-between w-full rounded-md px-2 py-1.5 text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all group-data-[collapsible=icon]:justify-center">
                    <div className="flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="text-[10px] font-bold uppercase tracking-widest group-data-[collapsible=icon]:hidden">
                        {title}
                      </span>
                    </div>
                    <ChevronDown
                      className={`h-3 w-3 transition-transform flex-shrink-0 group-data-[collapsible=icon]:hidden ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </CollapsibleTrigger>
                </SidebarGroupLabel>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu className="gap-0.5">
                      {items.map((item) => {
                        const active = isActive(item.url);
                        return (
                          <SidebarMenuItem key={item.title}>
                            <SidebarMenuButton
                              asChild
                              tooltip={item.title}
                              isActive={active}
                              className="h-8"
                            >
                              <NavLink
                                to={item.url}
                                className={`flex items-center gap-2.5 rounded-lg px-3 transition-all duration-200 ${
                                  active
                                    ? "bg-[#FF5910]/10 text-[#FF5910] border border-[#FF5910]/20 font-semibold shadow-[inset_0_0_12px_-4px_rgba(255,89,16,0.4)]"
                                    : "text-slate-400 hover:bg-white/5 hover:text-white border border-transparent"
                                }`}
                              >
                                <item.icon className="h-3.5 w-3.5 flex-shrink-0" />
                                <span className="text-[12px] truncate">{item.title}</span>
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

      <SidebarFooter className="p-3 border-t border-white/5 group-data-[collapsible=icon]:p-2">
        <div className="flex items-center gap-2.5 p-2 rounded-lg bg-white/5 border border-white/5">
          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#002D72] to-[#FF5910] border border-white/20 flex-shrink-0" />
          <div className="flex-1 overflow-hidden group-data-[collapsible=icon]:hidden">
            <p className="text-[11px] font-semibold text-white truncate leading-tight">Admin</p>
            <p className="text-[9px] text-slate-500 truncate">MetsXMFanZone</p>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
