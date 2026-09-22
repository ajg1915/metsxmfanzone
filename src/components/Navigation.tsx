import { useEffect, useState } from "react";
import { NavLink } from "@/components/NavLink";
import { Button } from "@/components/ui/button";
import { Menu, Shield, LogOut, LayoutDashboard, ArrowLeft, Users, CalendarDays, RefreshCw, Sparkles, Tv, ChevronDown, ChevronRight, PenLine, ShoppingBag, Bell, Newspaper, Trophy, Loader2, X } from "lucide-react";
import logo from "@/assets/metsxmfanzone-logo.png";
import liveStreamIcon from "@/assets/live-streaming-icon.png";
import podcastIcon from "@/assets/podcast-icon.png";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/useSubscription";
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
  const { tier } = useSubscription();
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
      <nav className="fixed top-0 left-0 right-0 z-50 glass-nav">
        <div className="container mx-auto px-3 sm:px-4">
        <div className="flex h-14 items-center justify-between sm:h-16">
          <div className="flex items-center gap-2">
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
            <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => navigate("/")}>
              <img 
                src={logo} 
                alt="MetsXMFanZone Logo" 
                className="h-9 w-auto"
              />
              <div className="font-display text-xl uppercase leading-none sm:text-2xl">
                <span className="text-secondary">Mets</span>
                <span className="text-primary">XM</span>
                <span className="text-foreground">FanZone</span>
              </div>
            </div>
          </div>
          
          <div className="hidden md:flex items-center gap-3 text-xs">
            <NavLink 
              to="/" 
              className="text-foreground hover:text-primary transition-colors"
              activeClassName="text-primary"
            >
              Home
            </NavLink>
            {/* Community Dropdown */}
            <div className="relative group">
              <button className="text-foreground hover:text-primary transition-colors py-2">
                Community
              </button>
              <div className="absolute left-0 top-full pt-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                <div className="bg-background border border-border rounded-lg shadow-lg min-w-[180px] py-1">
                  <button
                    onClick={() => handleProtectedNavigation("/community")}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                  >
                    <Users className="w-4 h-4" />
                    Community
                  </button>
                  {/* Radio moved into Podcast dropdown */}
                </div>
              </div>
            </div>

            {/* Podcast */}
            <NavLink
              to="/podcast"
              className="text-foreground hover:text-primary transition-colors"
              activeClassName="text-primary"
            >
              Podcast
            </NavLink>


            {/* Mets Dropdown */}
            <div className="relative group">
              <button className="text-foreground hover:text-primary transition-colors py-2">
                Mets Connect
              </button>
              <div className="absolute left-0 top-full pt-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                <div className="bg-background border border-border rounded-lg shadow-lg min-w-[160px] py-1">
                  <button
                    onClick={() => handleProtectedNavigation("/mets-schedule-2026")}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                  >
                    <CalendarDays className="w-4 h-4" />
                    Schedule
                  </button>
                  {user && (
                    <button
                      onClick={() => navigate("/mets-roster")}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                    >
                      <Users className="w-4 h-4" />
                      Roster
                    </button>
                  )}
                  <button
                    onClick={() => handleProNavigation("/video-gallery")}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                  >
                    <Tv className="w-4 h-4" />
                    Highlights
                  </button>
                  <button
                    onClick={() => navigate("/mets-game-recaps")}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                  >
                    <CalendarDays className="w-4 h-4" />
                    Game Recaps
                  </button>
                </div>
              </div>
            </div>



            {!user && (
              <NavLink 
                to="/pricing" 
                className="text-foreground hover:text-primary transition-colors"
              >
                Pricing
              </NavLink>
            )}
          </div>

          <div className="flex items-center gap-2">
            {user ? (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="hidden md:flex gap-1.5 text-xs h-8 px-2">
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={userProfile.avatar_url || undefined} alt="Profile" />
                        <AvatarFallback className="text-[10px]">
                          {userProfile.full_name?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="max-w-[120px] truncate">{userProfile.full_name || user.email}</span>
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
                  className="hidden md:flex text-xs h-8 px-3"
                  onClick={() => navigate("/auth?mode=login")}
                >
                  Login
                </Button>
                <Button 
                  size="sm" 
                  className="hidden md:flex text-xs h-8 px-3"
                  onClick={() => navigate("/auth?mode=signup")}
                >
                  Sign Up
                </Button>
              </>
            )}
            

            {/* Mobile menu */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Open menu" className="h-9 w-9 rounded-sm border border-border/40 bg-card/70 transition-colors hover:bg-muted md:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className="flex w-[min(92vw,390px)] flex-col border-l border-border/30 bg-background p-0 text-foreground [&>button]:hidden"
              >
                <SheetHeader className="flex-row items-center justify-between border-b border-border/25 px-5 py-5 text-left">
                  <div className="flex min-w-0 items-center gap-3">
                    <img src={logo} alt="MetsXMFanZone" className="h-10 w-10 shrink-0 object-contain" />
                    <div className="min-w-0">
                      <SheetTitle className="truncate text-base font-bold text-player-foreground">MetsXMFanZone</SheetTitle>
                      <SheetDescription className="text-[10px] font-bold uppercase text-primary">Fan Command Center</SheetDescription>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setMobileMenuOpen(false)}
                    aria-label="Close menu"
                    className="h-10 w-10 shrink-0 rounded-full border border-border/30 text-muted-foreground hover:bg-muted hover:text-player-foreground"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto px-5 py-5">
                  {user && (
                    <div className="mb-6 flex items-center gap-3 border-b border-border/20 pb-5">
                      <Avatar className="h-10 w-10 border border-border/40">
                        <AvatarImage src={userProfile.avatar_url || undefined} alt="Profile" />
                        <AvatarFallback className="bg-muted text-sm font-bold text-primary">
                          {userProfile.full_name?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 text-left">
                        <p className="truncate text-sm font-bold text-player-foreground">{userProfile.full_name || "Member"}</p>
                        <p className="truncate text-[10px] text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                  )}

                  <nav aria-label="Mobile navigation" className="space-y-1">
                    <NavLink
                      to="/"
                      onClick={() => setMobileMenuOpen(false)}
                      className="group flex min-h-14 items-center justify-between border-b border-border/15 px-1 py-3 text-player-foreground transition-colors hover:text-primary"
                    >
                      <span>
                        <span className="block text-lg font-bold">Home</span>
                        <span className="block text-[10px] text-muted-foreground">Latest Mets news and updates</span>
                      </span>
                      <ChevronRight className="h-5 w-5 text-primary" />
                    </NavLink>

                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => { setMobileMenuOpen(false); handleProtectedNavigation("/community"); }}
                      className="group h-auto min-h-14 w-full justify-between rounded-none border-b border-border/15 px-1 py-3 text-left text-player-foreground hover:bg-transparent hover:text-primary"
                    >
                      <span>
                        <span className="block text-lg font-bold">Community</span>
                        <span className="block text-[10px] font-normal text-muted-foreground">Posts and conversations with fans</span>
                      </span>
                      <ChevronRight className="h-5 w-5 text-primary" />
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => { setMobileMenuOpen(false); handleProNavigation("/podcast"); }}
                      className="group h-auto min-h-14 w-full justify-between rounded-none border-b border-border/15 px-1 py-3 text-left text-player-foreground hover:bg-transparent hover:text-primary"
                    >
                      <span>
                        <span className="block text-lg font-bold">Podcast</span>
                        <span className="block text-[10px] font-normal text-muted-foreground">Listen to MetsXMFanZone shows</span>
                      </span>
                      <ChevronRight className="h-5 w-5 text-primary" />
                    </Button>

                    {!user && (
                      <NavLink
                        to="/pricing"
                        onClick={() => setMobileMenuOpen(false)}
                        className="group flex min-h-14 items-center justify-between border-b border-border/15 px-1 py-3 text-player-foreground transition-colors hover:text-primary"
                      >
                        <span>
                          <span className="block text-lg font-bold">Membership</span>
                          <span className="block text-[10px] text-muted-foreground">Compare plans and member access</span>
                        </span>
                        <ChevronRight className="h-5 w-5 text-primary" />
                      </NavLink>
                    )}

                    <Collapsible open={tvScheduleOpen} onOpenChange={setTvScheduleOpen}>
                      <CollapsibleTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-auto min-h-14 w-full justify-between rounded-none border-b border-border/15 px-1 py-3 text-left text-player-foreground hover:bg-transparent hover:text-primary"
                        >
                          <span>
                            <span className="block text-lg font-bold text-primary">More</span>
                            <span className="block text-[10px] font-normal text-muted-foreground">Schedule, roster, highlights and recaps</span>
                          </span>
                          <ChevronDown className={`h-5 w-5 text-primary transition-transform ${tvScheduleOpen ? "rotate-180" : ""}`} />
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="border-b border-border/15 py-2 pl-4">
                        <Button type="button" variant="ghost" onClick={() => { setTvScheduleOpen(false); setMobileMenuOpen(false); handleProtectedNavigation("/mets-schedule-2026"); }} className="h-10 w-full justify-start gap-3 rounded-sm text-sm text-muted-foreground hover:text-player-foreground">
                          <CalendarDays className="h-4 w-4 text-primary" /> Schedule
                        </Button>
                        {user && (
                          <Button type="button" variant="ghost" onClick={() => { setTvScheduleOpen(false); setMobileMenuOpen(false); navigate("/mets-roster"); }} className="h-10 w-full justify-start gap-3 rounded-sm text-sm text-muted-foreground hover:text-player-foreground">
                            <Users className="h-4 w-4 text-primary" /> Roster
                          </Button>
                        )}
                        <Button type="button" variant="ghost" onClick={() => { setTvScheduleOpen(false); setMobileMenuOpen(false); handleProNavigation("/video-gallery"); }} className="h-10 w-full justify-start gap-3 rounded-sm text-sm text-muted-foreground hover:text-player-foreground">
                          <Tv className="h-4 w-4 text-primary" /> Highlights
                        </Button>
                        <Button type="button" variant="ghost" onClick={() => { setTvScheduleOpen(false); setMobileMenuOpen(false); navigate("/mets-game-recaps"); }} className="h-10 w-full justify-start gap-3 rounded-sm text-sm text-muted-foreground hover:text-player-foreground">
                          <Newspaper className="h-4 w-4 text-primary" /> Game Recaps
                        </Button>
                      </CollapsibleContent>
                    </Collapsible>
                  </nav>

                  {user && (
                    <div className="mt-6">
                      <p className="mb-2 text-[10px] font-bold uppercase text-muted-foreground">Your account</p>
                      <Button type="button" variant="ghost" onClick={() => { navigate("/dashboard"); setMobileMenuOpen(false); }} className="h-11 w-full justify-between rounded-sm px-1 text-player-foreground hover:bg-muted">
                        <span className="flex items-center gap-3"><LayoutDashboard className="h-4 w-4 text-primary" /> Dashboard</span><ChevronRight className="h-4 w-4" />
                      </Button>
                      {isWriter && (
                        <Button type="button" variant="ghost" onClick={() => { navigate("/writer"); setMobileMenuOpen(false); }} className="h-11 w-full justify-between rounded-sm px-1 text-player-foreground hover:bg-muted">
                          <span className="flex items-center gap-3"><PenLine className="h-4 w-4 text-primary" /> Writers Portal</span><ChevronRight className="h-4 w-4" />
                        </Button>
                      )}
                      {isAdmin && (
                        <>
                          <Button type="button" variant="ghost" onClick={() => { navigate("/admin/stories"); setMobileMenuOpen(false); }} className="h-11 w-full justify-between rounded-sm px-1 text-player-foreground hover:bg-muted">
                            <span className="flex items-center gap-3"><Sparkles className="h-4 w-4 text-primary" /> Admin Stories</span><ChevronRight className="h-4 w-4" />
                          </Button>
                          <Button type="button" variant="ghost" onClick={() => { navigate("/admin"); setMobileMenuOpen(false); }} className="h-11 w-full justify-between rounded-sm px-1 text-player-foreground hover:bg-muted">
                            <span className="flex items-center gap-3"><Shield className="h-4 w-4 text-primary" /> Admin Portal</span><ChevronRight className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div className="border-t border-border/25 bg-background px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
                  {user ? (
                    <Button type="button" variant="outline" onClick={async () => { await handleAuthClick(); }} className="h-12 w-full rounded-sm border-border/40 bg-transparent font-bold text-player-foreground hover:bg-muted">
                      <LogOut className="h-4 w-4" /> Sign Out
                    </Button>
                  ) : (
                    <div className="space-y-2">
                      <Button type="button" onClick={() => { navigate("/auth?mode=signup"); setMobileMenuOpen(false); }} className="h-12 w-full rounded-sm text-sm font-bold">
                        Create Account
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => { navigate("/auth?mode=login"); setMobileMenuOpen(false); }} className="h-11 w-full rounded-sm text-sm font-bold text-player-foreground hover:bg-muted">
                        Login
                      </Button>
                    </div>
                  )}
                </div>
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
