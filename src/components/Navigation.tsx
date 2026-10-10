import { useEffect, useState } from "react";
import { NavLink } from "@/components/NavLink";
import DesktopNavMenu from "@/components/DesktopNavMenu";
import MobileSportsMenu from "@/components/MobileSportsMenu";
import { Button } from "@/components/ui/button";
import { Menu, Shield, LogOut, LayoutDashboard, ArrowLeft, Users, CalendarDays, RefreshCw, Sparkles, Tv, ChevronDown, ChevronRight, PenLine, ShoppingBag, Bell, Newspaper, Trophy, Loader2, X, Download } from "lucide-react";
import logo from "@/assets/metsxmfanzone-logo.png";
import liveStreamIcon from "@/assets/live-streaming-icon.png";
import podcastIcon from "@/assets/podcast-icon.png";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/useSubscription";
import { useDevice, isPhoneUserAgent, enterTVMode } from "@/hooks/use-device";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { formatDistanceToNow } from "date-fns";

const Navigation = () => {
  const { user, signOut } = useAuth();
  const { tier, isPremium: isPaidMember } = useSubscription();
  const { isTVDevice } = useDevice();
  const navigate = useNavigate();
  const location = useLocation();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isWriter, setIsWriter] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [userProfile, setUserProfile] = useState<{ full_name: string | null; avatar_url: string | null }>({ full_name: null, avatar_url: null });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [tvScheduleOpen, setTvScheduleOpen] = useState(false);
  const [communityOpen, setCommunityOpen] = useState(false);
  const [radioOpen, setRadioOpen] = useState(false);
  const [notifItems, setNotifItems] = useState<any[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  type NotifItem = {
    id: string;
    type: "live" | "game_alert" | "story" | "blog";
    title: string;
    message: string;
    time: string;
    link?: string;
  };

  const fetchNotifs = async () => {
    setNotifLoading(true);
    const since = new Date();
    since.setDate(since.getDate() - 14);
    const sinceISO = since.toISOString();

    const [liveStreams, gameAlerts, stories, blogPosts] = await Promise.all([
      supabase
        .from("live_streams")
        .select("id, title, status, updated_at")
        .in("status", ["live", "scheduled"])
        .eq("published", true)
        .gte("updated_at", sinceISO)
        .order("updated_at", { ascending: false })
        .limit(10),
      supabase
        .from("game_alerts")
        .select("id, title, message, created_at, link_url")
        .eq("is_active", true)
        .gte("created_at", sinceISO)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("stories")
        .select("id, title, created_at")
        .eq("published", true)
        .gte("created_at", sinceISO)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("blog_posts")
        .select("id, title, slug, published_at")
        .eq("published", true)
        .gte("published_at", sinceISO)
        .order("published_at", { ascending: false })
        .limit(10),
    ]);

    const list: NotifItem[] = [];
    (liveStreams.data || []).forEach((s: any) =>
      list.push({
        id: `live-${s.id}`,
        type: "live",
        title: s.status === "live" ? "🔴 LIVE NOW" : "Coming Soon",
        message: s.title,
        time: s.updated_at,
        link: "/metsxmfanzone",
      })
    );
    (gameAlerts.data || []).forEach((a: any) =>
      list.push({
        id: `alert-${a.id}`,
        type: "game_alert",
        title: a.title,
        message: a.message,
        time: a.created_at,
        link: a.link_url || undefined,
      })
    );
    (stories.data || []).forEach((s: any) =>
      list.push({
        id: `story-${s.id}`,
        type: "story",
        title: "New Story",
        message: s.title,
        time: s.created_at,
        link: "/",
      })
    );
    (blogPosts.data || []).forEach((b: any) =>
      list.push({
        id: `blog-${b.id}`,
        type: "blog",
        title: "New Article",
        message: b.title,
        time: b.published_at || "",
        link: `/blog/${b.slug}`,
      })
    );

    list.sort((a, b) => +new Date(b.time) - +new Date(a.time));
    setNotifItems(list.slice(0, 15));
    setNotifLoading(false);
  };

  const notifTypeConfig: Record<string, { icon: any; label: string; color: string }> = {
    live: { icon: Tv, label: "Live Now", color: "text-red-500" },
    game_alert: { icon: Trophy, label: "Game Alert", color: "text-amber-500" },
    story: { icon: Bell, label: "New Story", color: "text-blue-500" },
    blog: { icon: Newspaper, label: "New Article", color: "text-emerald-500" },
  };


  const handleRefresh = () => {
    setIsRefreshing(true);
    window.location.reload();
  };
  
  const isHomePage = location.pathname === "/";
  
  const handleGoBack = () => {
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate("/");
    }
  };

  useEffect(() => {
    const checkAdminAndProfile = async () => {
      if (user) {
        // Check roles
        const { data: rolesData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);

        setIsAdmin(rolesData?.some(r => r.role === "admin") ?? false);
        setIsWriter(rolesData?.some(r => r.role === "writer") ?? false);

        // Fetch user profile
        const { data: profileData } = await supabase
          .from("profiles")
          .select("full_name, avatar_url")
          .eq("id", user.id)
          .single();

        if (profileData) {
          setUserProfile(profileData);
        }
      } else {
        setIsAdmin(false);
        setIsWriter(false);
        setUserProfile({ full_name: null, avatar_url: null });
      }
    };

    checkAdminAndProfile();
  }, [user]);

  const isPremium = isAdmin || tier === "weekly" || tier === "premium" || tier === "annual";

  // "TV Mode" in the menu: signed-in paid members on a PC or tablet who aren't already in TV mode
  const showTVMode = !!user && isPaidMember && !isTVDevice && !isPhoneUserAgent();

  const handleProtectedNavigation = (path: string) => {
    if (!user) {
      navigate("/auth");
    } else {
      navigate(path);
    }
  };

  const handleProNavigation = (path: string) => {
    if (!user) {
      navigate("/auth");
    } else if (!isPremium) {
      navigate("/pricing");
    } else {
      navigate(path);
    }
  };

  const handleAuthClick = async () => {
    if (user) {
      setMobileMenuOpen(false);
      await signOut();
      navigate("/logout");
    } else {
      navigate("/auth");
    }
  };

  return (
    <>
      <UpgradePrompt open={showUpgradePrompt} onOpenChange={setShowUpgradePrompt} />
      <nav className={`fixed top-0 left-0 right-0 z-50 glass-nav ${isHomePage ? "max-md:!border-0 max-md:!bg-transparent max-md:!shadow-none max-md:![backdrop-filter:none] max-md:px-3 max-md:pt-3" : ""}`}>
        <div className={`container mx-auto px-3 sm:px-4 ${isHomePage ? "max-md:rounded-full max-md:border max-md:border-[rgba(255,255,255,0.14)] max-md:bg-background/55 max-md:pl-3.5 max-md:pr-1.5 max-md:backdrop-blur-xl" : ""}`}>
        <div className="flex h-14 items-center justify-between sm:h-16">
          <div className="flex min-w-0 items-center gap-2 lg:shrink-0">
            {!isHomePage && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleGoBack}
                className="h-8 w-8 p-0"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            {location.pathname === "/metsxmfanzone" && (
              <span className="font-display text-[25px] uppercase leading-none tracking-wide md:hidden">Watch Live</span>
            )}
            <div className={`flex min-w-0 items-center gap-1.5 cursor-pointer lg:shrink-0 ${location.pathname === "/metsxmfanzone" ? "max-md:hidden" : ""}`} onClick={() => navigate("/")}>
              <img 
                src={logo} 
                alt="MetsXMFanZone Logo" 
                className="h-9 w-auto max-md:h-8 shrink-0"
              />
              <div className="min-w-0 font-display text-xl uppercase leading-none lg:max-[1439px]:hidden max-md:text-[clamp(12px,4.5vw,20px)] whitespace-nowrap sm:text-2xl">
                <span className={isHomePage ? "text-secondary max-md:text-foreground" : "text-secondary"}>Mets</span>
                <span className="text-primary">XM</span>
                <span className="text-foreground">FanZone</span>
                <span className="text-foreground">.com</span>
              </div>
            </div>
          </div>
          
          <DesktopNavMenu
            isLoggedIn={!!user}
            goProtected={handleProtectedNavigation}
            goPro={handleProNavigation}
            onTVMode={showTVMode ? enterTVMode : undefined}
          />

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => handleProNavigation("/metsxmfanzone")}
              className="hidden h-9 gap-2 rounded-full px-4 text-sm font-bold md:inline-flex lg:hidden"
            >
              <span className="h-2 w-2 rounded-full bg-white" /> Watch Live
            </Button>
            {isHomePage && !user && (
              <Button
                variant="ghost"
                onClick={() => navigate("/auth?mode=login")}
                className="h-10 shrink-0 rounded-full bg-white/15 px-2.5 text-[13px] min-[360px]:h-11 min-[360px]:text-sm font-bold text-white hover:bg-white/25 min-[360px]:px-4 md:hidden"
              >
                Log in
              </Button>
            )}
            {isHomePage && user && (
              <button
                type="button"
                aria-label="My account"
                onClick={() => navigate("/dashboard")}
                className="flex h-11 w-11 items-center justify-center md:hidden"
              >
                <Avatar className="h-[34px] w-[34px] border border-white/25">
                  <AvatarImage src={userProfile.avatar_url || undefined} alt="Profile" />
                  <AvatarFallback className="bg-white/15 text-xs font-bold text-white">
                    {userProfile.full_name?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </button>
            )}
            {user ? (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="hidden lg:flex h-10 gap-2 rounded-full px-2.5 text-sm font-semibold hover:bg-white/[0.07]">
                      <Avatar className="h-7 w-7 ring-1 ring-white/15">
                        <AvatarImage src={userProfile.avatar_url || undefined} alt="Profile" />
                        <AvatarFallback className="text-[10px]">
                          {userProfile.full_name?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="max-w-[140px] truncate">{userProfile.full_name || user.email}</span>
                      <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-64 z-50 bg-card/90 backdrop-blur-xl border border-primary/20 rounded-xl shadow-elevation-high p-0 overflow-hidden"
                    sideOffset={6}
                  >
                    {/* User profile header */}
                    <div className="relative px-4 pt-4 pb-3 bg-gradient-to-br from-primary/20 to-secondary/10">
                      <div className="absolute inset-0 opacity-30 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary)/0.15),transparent_60%)]" />
                      <div className="relative flex items-center gap-3">
                        <Avatar className="h-10 w-10 ring-2 ring-primary/40 shadow-md">
                          <AvatarImage src={userProfile.avatar_url || undefined} alt="Profile" />
                          <AvatarFallback className="text-xs font-bold bg-primary text-primary-foreground">
                            {userProfile.full_name?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-foreground truncate">
                            {userProfile.full_name || 'Member'}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
                        </div>
                      </div>
                    </div>

                    <div className="p-1.5 space-y-0.5">
                      <DropdownMenuItem
                        onClick={() => navigate("/dashboard")}
                        className="rounded-lg cursor-pointer hover:bg-primary/10 focus:bg-primary/10 focus:text-primary transition-colors"
                      >
                        <LayoutDashboard className="w-4 h-4 mr-2.5 text-primary" />
                        <span className="text-sm">Dashboard</span>
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        onClick={() => navigate("/install")}
                        className="rounded-lg cursor-pointer hover:bg-primary/10 focus:bg-primary/10 focus:text-primary transition-colors"
                      >
                        <Download className="w-4 h-4 mr-2.5 text-primary" />
                        <span className="text-sm">Get the app</span>
                      </DropdownMenuItem>

                      <Collapsible
                        open={notifOpen}
                        onOpenChange={(open) => {
                          setNotifOpen(open);
                          if (open) fetchNotifs();
                        }}
                      >
                        <CollapsibleTrigger asChild>
                          <button
                            type="button"
                            className="w-full flex items-center rounded-lg px-2 py-1.5 text-sm hover:bg-primary/10 focus:bg-primary/10 focus:text-primary transition-colors outline-none"
                          >
                            <Bell className="w-4 h-4 mr-2.5 text-secondary" />
                            <span className="flex-1 text-left">Notifications</span>
                            <ChevronDown
                              className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${notifOpen ? "rotate-180" : ""}`}
                            />
                          </button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-1 mx-1 rounded-lg border border-primary/15 bg-background/60 overflow-hidden">
                          <div className="px-3 py-2 border-b border-border/30 bg-gradient-to-r from-primary/10 to-transparent">
                            <p className="text-xs font-bold text-foreground">Notifications</p>
                            <p className="text-[10px] text-muted-foreground">Recent alerts, streams & stories</p>
                          </div>
                          <div className="max-h-[300px] overflow-y-auto">
                            {notifLoading ? (
                              <div className="flex items-center justify-center py-6">
                                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                              </div>
                            ) : notifItems.length === 0 ? (
                              <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                                <Bell className="w-5 h-5 mb-1 opacity-40" />
                                <p className="text-xs">No notifications yet</p>
                              </div>
                            ) : (
                              <div className="divide-y divide-border/20">
                                {notifItems.map((n) => {
                                  const cfg = notifTypeConfig[n.type];
                                  const Icon = cfg.icon;
                                  return (
                                    <button
                                      key={n.id}
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        if (n.link) window.location.href = n.link;
                                      }}
                                      className="flex items-start gap-2.5 w-full px-3 py-2.5 hover:bg-primary/5 transition-colors text-left"
                                    >
                                      <div className={`mt-0.5 ${cfg.color}`}>
                                        <Icon className="w-3.5 h-3.5" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <span className={`text-[10px] font-semibold uppercase tracking-wide ${cfg.color}`}>
                                          {cfg.label}
                                        </span>
                                        <p className="text-xs font-medium text-foreground truncate">{n.title}</p>
                                        <p className="text-[11px] text-muted-foreground truncate">{n.message}</p>
                                        <p className="text-[9px] text-muted-foreground mt-0.5">
                                          {n.time ? formatDistanceToNow(new Date(n.time), { addSuffix: true }) : ""}
                                        </p>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>


                      {isWriter && (
                        <DropdownMenuItem
                          onClick={() => navigate("/writer")}
                          className="rounded-lg cursor-pointer hover:bg-primary/10 focus:bg-primary/10 focus:text-primary transition-colors"
                        >
                          <PenLine className="w-4 h-4 mr-2.5 text-purple-400" />
                          <span className="text-sm">Writers Portal</span>
                        </DropdownMenuItem>
                      )}
                      {isAdmin && (
                        <DropdownMenuItem
                          onClick={() => navigate("/admin")}
                          className="rounded-lg cursor-pointer hover:bg-primary/10 focus:bg-primary/10 focus:text-primary transition-colors"
                        >
                          <Shield className="w-4 h-4 mr-2.5 text-destructive" />
                          <span className="text-sm">Admin Portal</span>
                        </DropdownMenuItem>
                      )}
                    </div>

                    <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent my-1" />

                    <div className="p-1.5 pb-2">
                      <DropdownMenuItem
                        onClick={handleAuthClick}
                        className="rounded-lg cursor-pointer text-destructive hover:bg-destructive/10 focus:bg-destructive/10 focus:text-destructive transition-colors"
                      >
                        <LogOut className="w-4 h-4 mr-2.5" />
                        <span className="text-sm">Sign Out</span>
                      </DropdownMenuItem>
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="hidden lg:flex h-10 rounded-full px-4 text-sm font-semibold hover:bg-white/[0.07]"
                  onClick={() => navigate("/auth?mode=login")}
                >
                  Login
                </Button>
                <Button 
                  size="sm" 
                  className="hidden lg:flex h-10 rounded-full px-5 text-sm font-bold shadow-lg shadow-primary/25"
                  onClick={() => navigate("/auth?mode=signup")}
                >
                  Sign Up
                </Button>
              </>
            )}
            

            {/* Mobile menu */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Open menu" className={`h-9 w-9 rounded-sm border border-border/40 bg-card/70 transition-colors hover:bg-muted lg:hidden ${isHomePage ? "max-md:h-11 max-md:w-11 max-md:rounded-full max-md:border-0 max-md:bg-transparent" : ""}`}>
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className="w-full max-w-none border-0 p-0 sm:max-w-[440px] sm:border-l sm:border-primary/30 [&>button]:hidden"
              >
                <MobileSportsMenu
                  user={user}
                  profile={userProfile}
                  isAdmin={isAdmin}
                  isWriter={isWriter}
                  close={() => setMobileMenuOpen(false)}
                  go={(path) => navigate(path)}
                  goProtected={handleProtectedNavigation}
                  goPro={handleProNavigation}
                  onSignOut={async () => { await handleAuthClick(); }}
                  onTVMode={showTVMode ? enterTVMode : undefined}
                />
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
    </>
  );
};

export default Navigation;
