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

  const isPremium = isAdmin || tier === "premium" || tier === "annual";

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
            

            {/* Modern Mobile Menu */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Open menu" className="h-9 w-9 rounded-sm border border-border/40 bg-card/70 transition-colors hover:bg-secondary/20 md:hidden">
                  <Menu className="w-5 h-5 text-foreground" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className="w-[290px] sm:w-[320px] p-0 border-l border-primary/30 bg-gradient-to-b from-[#0a0f2c] via-[#0b1226] to-[#050814] text-foreground overflow-hidden [&>button]:hidden"
              >
                {/* Ambient glow */}
                <div className="pointer-events-none absolute -top-24 -right-16 w-72 h-72 rounded-full bg-primary/20 blur-3xl" />
                <div className="pointer-events-none absolute bottom-0 -left-16 w-64 h-64 rounded-full bg-secondary/10 blur-3xl" />

                {/* Header */}
                <SheetHeader className="relative px-4 pt-4 pb-4 border-b border-primary/20 bg-gradient-to-br from-primary/15 via-transparent to-transparent">
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    aria-label="Close menu"
                    className="absolute top-3 right-3 h-7 w-7 rounded-full bg-white/5 hover:bg-primary/20 border border-primary/30 flex items-center justify-center transition-colors"
                  >
                    <X className="w-3.5 h-3.5 text-primary" />
                  </button>

                  {user ? (
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-primary to-secondary blur-md opacity-60" />
                        <Avatar className="relative h-11 w-11 ring-2 ring-primary/60">
                          <AvatarImage src={userProfile.avatar_url || undefined} alt="Profile" />
                          <AvatarFallback className="text-xs bg-gradient-to-br from-primary to-secondary text-primary-foreground font-black">
                            {userProfile.full_name?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <SheetTitle className="text-sm font-bold text-foreground truncate tracking-wide">
                          {userProfile.full_name || 'Member'}
                        </SheetTitle>
                        <SheetDescription className="text-[10px] text-muted-foreground truncate">
                          {user.email}
                        </SheetDescription>
                        <div className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-primary/15 border border-primary/30">
                          <span className="w-1 h-1 rounded-full bg-primary animate-pulse" />
                          <span className="text-[8px] font-bold tracking-widest text-primary uppercase">
                            {isAdmin ? 'Admin' : isWriter ? 'Writer' : 'Member'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="absolute inset-0 rounded-lg bg-primary/40 blur-md" />
                        <img src={logo} alt="Logo" className="relative w-10 h-10 object-contain" />
                      </div>
                      <div className="text-left">
                        <SheetTitle className="text-sm font-black text-foreground tracking-wide">MetsXMFanZone</SheetTitle>
                        <SheetDescription className="text-[10px] text-primary/80 font-semibold tracking-widest uppercase">
                          Fan Command Center
                        </SheetDescription>
                      </div>
                    </div>
                  )}
                </SheetHeader>

                <div className="relative flex flex-col py-3 px-3 gap-1 overflow-y-auto max-h-[calc(100vh-110px)]">
                  <p className="px-2 text-[9px] font-black tracking-[0.2em] text-primary/70 uppercase mb-1">Explore</p>

                  <NavLink
                    to="/"
                    className="group flex items-center gap-3 text-foreground hover:text-primary hover:bg-primary/10 border border-transparent hover:border-primary/30 transition-all py-2.5 px-3 rounded-xl text-[13px]"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/5 group-hover:bg-primary/20 border border-white/5 group-hover:border-primary/40 transition-colors">
                      <img src={logo} alt="" className="w-4 h-4 object-contain" />
                    </span>
                    <span className="font-semibold flex-1">Home</span>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </NavLink>

                  <button
                    onClick={() => { setMobileMenuOpen(false); handleProtectedNavigation("/community"); }}
                    className="group flex items-center gap-3 w-full text-foreground hover:text-primary hover:bg-primary/10 border border-transparent hover:border-primary/30 transition-all py-2.5 px-3 rounded-xl text-left text-[13px]"
                  >
                    <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/5 group-hover:bg-primary/20 border border-white/5 group-hover:border-primary/40 transition-colors">
                      <Users className="w-3.5 h-3.5 text-primary" />
                    </span>
                    <span className="font-semibold flex-1">Community</span>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </button>

                  <button
                    onClick={() => { setMobileMenuOpen(false); handleProNavigation("/podcast"); }}
                    className="group flex items-center gap-3 w-full text-foreground hover:text-primary hover:bg-primary/10 border border-transparent hover:border-primary/30 transition-all py-2.5 px-3 rounded-xl text-left text-[13px]"
                  >
                    <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/5 group-hover:bg-primary/20 border border-white/5 group-hover:border-primary/40 transition-colors">
                      <img src={podcastIcon} alt="" className="w-4 h-4 object-contain" />
                    </span>
                    <span className="font-semibold flex-1">Podcast</span>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </button>

                  {!user && (
                    <NavLink
                      to="/pricing"
                      className="group flex items-center gap-3 text-foreground hover:text-primary hover:bg-primary/10 border border-transparent hover:border-primary/30 transition-all py-2.5 px-3 rounded-xl text-[13px]"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/5 group-hover:bg-primary/20 border border-white/5 group-hover:border-primary/40 transition-colors">
                        <Shield className="w-3.5 h-3.5 text-primary" />
                      </span>
                      <span className="font-semibold flex-1">Pricing</span>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </NavLink>
                  )}

                  <p className="px-2 mt-3 text-[9px] font-black tracking-[0.2em] text-primary/70 uppercase mb-1">Mets Connect</p>

                  <Collapsible open={tvScheduleOpen} onOpenChange={setTvScheduleOpen}>
                    <CollapsibleTrigger className="group flex items-center justify-between w-full px-3 py-2.5 rounded-xl border border-transparent hover:border-primary/30 hover:bg-primary/10 transition-all">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/5 border border-white/5 group-hover:border-primary/40 transition-colors">
                          <img src={`https://www.mlbstatic.com/team-logos/121.svg`} alt="" className="w-4 h-4 object-contain" />
                        </span>
                        <span className="font-semibold text-[13px]">Mets Hub</span>
                      </div>
                      <ChevronDown className={`w-3.5 h-3.5 text-primary transition-transform duration-300 ${tvScheduleOpen ? 'rotate-180' : ''}`} />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-1 ml-3 pl-3 border-l border-primary/20 space-y-0.5">
                      <button
                        onClick={() => { setTvScheduleOpen(false); setMobileMenuOpen(false); handleProtectedNavigation("/mets-schedule-2026"); }}
                        className="flex items-center gap-2 w-full text-muted-foreground hover:text-primary hover:bg-primary/5 py-1.5 px-2.5 rounded-md text-left text-[11.5px] transition-colors"
                      >
                        <CalendarDays className="w-3.5 h-3.5" />
                        Schedule
                      </button>
                      {user && (
                        <button
                          onClick={() => { setTvScheduleOpen(false); setMobileMenuOpen(false); navigate("/mets-roster"); }}
                          className="flex items-center gap-2 w-full text-muted-foreground hover:text-primary hover:bg-primary/5 py-1.5 px-2.5 rounded-md text-left text-[11.5px] transition-colors"
                        >
                          <Users className="w-3.5 h-3.5" />
                          Roster
                        </button>
                      )}
                      <button
                        onClick={() => { setTvScheduleOpen(false); setMobileMenuOpen(false); handleProNavigation("/video-gallery"); }}
                        className="flex items-center gap-2 w-full text-muted-foreground hover:text-primary hover:bg-primary/5 py-1.5 px-2.5 rounded-md text-left text-[11.5px] transition-colors"
                      >
                        <Tv className="w-3.5 h-3.5" />
                        Highlights
                      </button>
                      <button
                        onClick={() => { setTvScheduleOpen(false); setMobileMenuOpen(false); navigate("/mets-game-recaps"); }}
                        className="flex items-center gap-2 w-full text-muted-foreground hover:text-primary hover:bg-primary/5 py-1.5 px-2.5 rounded-md text-left text-[11.5px] transition-colors"
                      >
                        <CalendarDays className="w-3.5 h-3.5" />
                        Game Recaps
                      </button>
                    </CollapsibleContent>
                  </Collapsible>

                  {user ? (
                    <>
                      <p className="px-2 mt-3 text-[9px] font-black tracking-[0.2em] text-primary/70 uppercase mb-1">Account</p>

                      <button
                        onClick={() => { navigate("/dashboard"); setMobileMenuOpen(false); }}
                        className="group flex items-center gap-3 w-full text-foreground hover:text-primary hover:bg-primary/10 border border-transparent hover:border-primary/30 transition-all py-2.5 px-3 rounded-xl text-left text-[13px]"
                      >
                        <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/5 group-hover:bg-primary/20 border border-white/5 group-hover:border-primary/40 transition-colors">
                          <LayoutDashboard className="w-3.5 h-3.5 text-primary" />
                        </span>
                        <span className="font-semibold flex-1">Dashboard</span>
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                      </button>

                      {isWriter && (
                        <button
                          onClick={() => { navigate("/writer"); setMobileMenuOpen(false); }}
                          className="group flex items-center gap-3 w-full text-foreground hover:text-primary hover:bg-primary/10 border border-transparent hover:border-primary/30 transition-all py-2.5 px-3 rounded-xl text-left text-[13px]"
                        >
                          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/5 group-hover:bg-primary/20 border border-white/5 group-hover:border-primary/40 transition-colors">
                            <PenLine className="w-3.5 h-3.5 text-secondary" />
                          </span>
                          <span className="font-semibold flex-1">Writers Portal</span>
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                        </button>
                      )}

                      {isAdmin && (
                        <>
                          <button
                            onClick={() => { navigate("/admin/stories"); setMobileMenuOpen(false); }}
                            className="group flex items-center gap-3 w-full text-foreground hover:text-primary hover:bg-primary/10 border border-transparent hover:border-primary/30 transition-all py-2.5 px-3 rounded-xl text-left text-[13px]"
                          >
                            <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/5 group-hover:bg-primary/20 border border-white/5 group-hover:border-primary/40 transition-colors">
                              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                            </span>
                            <span className="font-semibold flex-1">Admin Stories</span>
                            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                          </button>
                          <button
                            onClick={() => { navigate("/admin"); setMobileMenuOpen(false); }}
                            className="group flex items-center gap-3 w-full text-foreground hover:text-primary hover:bg-primary/10 border border-transparent hover:border-primary/30 transition-all py-2.5 px-3 rounded-xl text-left text-[13px]"
                          >
                            <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/5 group-hover:bg-primary/20 border border-white/5 group-hover:border-primary/40 transition-colors">
                              <Shield className="w-3.5 h-3.5 text-destructive" />
                            </span>
                            <span className="font-semibold flex-1">Admin Portal</span>
                            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                          </button>
                        </>
                      )}

                      <div className="h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent my-2" />

                      <button
                        onClick={async () => { await handleAuthClick(); }}
                        className="flex items-center gap-3 w-full text-destructive hover:bg-destructive/10 border border-transparent hover:border-destructive/30 transition-all py-2.5 px-3 rounded-xl text-left text-[13px]"
                      >
                        <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-destructive/10 border border-destructive/20">
                          <LogOut className="w-3.5 h-3.5" />
                        </span>
                        <span className="font-semibold">Sign Out</span>
                      </button>
                    </>
                  ) : (
                    <div className="mt-4 space-y-2 px-1">
                      <Button
                        onClick={() => { navigate("/auth?mode=login"); setMobileMenuOpen(false); }}
                        variant="outline"
                        className="w-full h-10 rounded-xl border-primary/40 bg-white/5 hover:bg-primary/15 text-[13px] font-semibold"
                      >
                        Login
                      </Button>
                      <Button
                        onClick={() => { navigate("/auth?mode=signup"); setMobileMenuOpen(false); }}
                        className="w-full h-10 rounded-xl text-[13px] font-bold bg-gradient-to-r from-primary to-secondary shadow-lg shadow-primary/30 hover:shadow-primary/50"
                      >
                        Sign Up Free
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
