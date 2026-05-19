import { useEffect, useState } from "react";
import { NavLink } from "@/components/NavLink";
import { Button } from "@/components/ui/button";
import { Menu, Shield, LogOut, LayoutDashboard, ArrowLeft, Users, CalendarDays, RefreshCw, Sparkles, Tv, ChevronDown, PenLine, ShoppingBag } from "lucide-react";
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
        <div className="flex items-center justify-between h-12">
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
                className="h-8 w-auto"
              />
              <div className="text-xs font-semibold">
                <span className="text-foreground">MetsXMFanZone</span>
                <span className="text-primary">.com</span>
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
            {/* Podcast Dropdown (includes Radio) */}
            <div className="relative group">
              <button className="text-foreground hover:text-primary transition-colors py-2 flex items-center gap-1">
                Podcast
              </button>
              <div className="absolute left-0 top-full pt-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                <div className="bg-background border border-border rounded-lg shadow-lg min-w-[160px] py-1">
                  <button
                    onClick={() => handleProNavigation("/podcast")}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                  >
                    <img src={podcastIcon} alt="" className="w-4 h-4 object-contain" />
                    Podcast Home
                  </button>
                  <button
                    onClick={() => handleProNavigation("/gameday-live")}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm font-semibold transition-colors hover:bg-primary/10"
                    style={{ color: "#ff4500" }}
                  >
                    <span className="w-2 h-2 rounded-full bg-[#ff4500] animate-pulse" />
                    Radio
                  </button>
                </div>
              </div>
            </div>

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

            <button
              onClick={() => navigate("/shop")}
              className="text-foreground hover:text-primary transition-colors"
            >
              Shop
            </button>

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
                  <DropdownMenuContent align="end" className="w-56 bg-background z-50">
                    <DropdownMenuLabel>My Account</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate("/dashboard")}>
                      <LayoutDashboard className="w-4 h-4 mr-2" />
                      Dashboard
                    </DropdownMenuItem>
                    {isWriter && (
                      <DropdownMenuItem onClick={() => navigate("/writer")}>
                        <PenLine className="w-4 h-4 mr-2" />
                        Writers Portal
                      </DropdownMenuItem>
                    )}
                    {isAdmin && (
                      <DropdownMenuItem onClick={() => navigate("/admin")}>
                        <Shield className="w-4 h-4 mr-2" />
                        Admin Portal
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleAuthClick}>
                      <LogOut className="w-4 h-4 mr-2" />
                      Sign Out
                    </DropdownMenuItem>
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
                <Button variant="ghost" size="icon" className="md:hidden h-8 w-8 rounded-lg bg-muted/50 hover:bg-muted border border-muted/50 transition-all">
                  <Menu className="w-4 h-4 text-primary" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[260px] sm:w-[280px] bg-card/95 backdrop-blur-2xl p-0 border-l border-muted/30">
                {/* Header with user profile or logo */}
                <SheetHeader className="px-3 py-3 border-b border-muted/20">
                  {user ? (
                    <div className="flex items-center gap-2.5">
                      <Avatar className="h-9 w-9 ring-2 ring-primary/40">
                        <AvatarImage src={userProfile.avatar_url || undefined} alt="Profile" />
                        <AvatarFallback className="text-[10px] bg-primary text-primary-foreground font-bold">
                          {userProfile.full_name?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <SheetTitle className="text-sm font-bold text-foreground truncate">{userProfile.full_name || 'Member'}</SheetTitle>
                        <SheetDescription className="text-[9px] text-muted-foreground truncate">{user.email}</SheetDescription>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <img src={logo} alt="Logo" className="w-6 h-6 object-contain" />
                      <div>
                        <SheetTitle className="text-sm font-bold text-primary">Menu</SheetTitle>
                        <SheetDescription className="text-[9px] text-muted-foreground">MetsXMFanZone</SheetDescription>
                      </div>
                    </div>
                  )}
                </SheetHeader>
                
                <div className="flex flex-col py-2 px-2 gap-0.5 overflow-y-auto max-h-[calc(100vh-100px)]">
                  {/* Nav items - ultra compact */}
                  <NavLink 
                    to="/" 
                    className="flex items-center gap-2.5 text-foreground hover:text-primary hover:bg-primary/8 transition-all py-2 px-2.5 rounded-lg text-xs"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <img src={logo} alt="" className="w-3.5 h-3.5 object-contain" />
                    <span className="font-medium">Home</span>
                  </NavLink>
                  {/* Podcast collapsible (includes Radio) */}
                  <Collapsible open={radioOpen} onOpenChange={setRadioOpen}>
                    <CollapsibleTrigger className="flex items-center justify-between w-full px-2.5 py-2 rounded-lg hover:bg-primary/8 transition-all">
                      <div className="flex items-center gap-2.5">
                        <img src={podcastIcon} alt="" className="w-3.5 h-3.5 object-contain" />
                        <span className="font-medium text-xs text-foreground">Podcast</span>
                      </div>
                      <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform duration-200 ${radioOpen ? 'rotate-180' : ''}`} />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-0.5 mt-0.5 ml-6">
                      <button
                        onClick={() => { setRadioOpen(false); setMobileMenuOpen(false); handleProNavigation("/podcast"); }}
                        className="flex items-center gap-2 w-full text-muted-foreground hover:text-primary py-1.5 px-2.5 rounded-md text-left text-[11px]"
                      >
                        <img src={podcastIcon} alt="" className="w-3.5 h-3.5 object-contain" />
                        Podcast Home
                      </button>
                      <button
                        onClick={() => { setRadioOpen(false); setMobileMenuOpen(false); handleProNavigation("/gameday-live"); }}
                        className="flex items-center gap-2 w-full py-1.5 px-2.5 rounded-md text-left text-[11px] hover:bg-primary/8"
                        style={{ color: "#ff4500" }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-[#ff4500] animate-pulse" />
                        <span className="font-bold">Radio</span>
                      </button>
                      <button
                        onClick={() => { setRadioOpen(false); setMobileMenuOpen(false); handleProNavigation("/gameday-live#voice-rooms"); }}
                        className="flex items-center gap-2 w-full text-muted-foreground hover:text-primary py-1.5 px-2.5 rounded-md text-left text-[11px]"
                      >
                        <Users className="w-3.5 h-3.5" />
                        Voice Rooms
                      </button>
                      <button
                        onClick={() => { setRadioOpen(false); setMobileMenuOpen(false); handleProNavigation("/gameday-live#scheduled-shows"); }}
                        className="flex items-center gap-2 w-full text-muted-foreground hover:text-primary py-1.5 px-2.5 rounded-md text-left text-[11px]"
                      >
                        <CalendarDays className="w-3.5 h-3.5" />
                        Scheduled Shows
                      </button>
                    </CollapsibleContent>
                  </Collapsible>
                  {user && (
                    <button
                      onClick={() => { setMobileMenuOpen(false); navigate("/mets-roster"); }}
                      className="flex items-center gap-2.5 w-full text-foreground hover:text-primary hover:bg-primary/8 transition-all py-2 px-2.5 rounded-lg text-left text-xs"
                    >
                      <Users className="w-3.5 h-3.5 text-secondary" />
                      <span className="font-medium">Roster</span>
                    </button>
                  )}
                  {!user && (
                    <NavLink 
                      to="/pricing" 
                      className="flex items-center gap-2.5 text-foreground hover:text-primary hover:bg-primary/8 transition-all py-2 px-2.5 rounded-lg text-xs"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Shield className="w-3.5 h-3.5 text-primary" />
                      <span className="font-medium">Pricing</span>
                    </NavLink>
                  )}
                  
                  {/* Divider */}
                  <div className="h-px bg-muted/20 my-1.5 mx-1" />

                  {/* Mets collapsible */}
                  <Collapsible open={tvScheduleOpen} onOpenChange={setTvScheduleOpen}>
                    <CollapsibleTrigger className="flex items-center justify-between w-full px-2.5 py-2 rounded-lg hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-2.5">
                        <img src={`https://www.mlbstatic.com/team-logos/121.svg`} alt="" className="w-3.5 h-3.5 object-contain" />
                        <span className="font-medium text-xs">Mets Connect</span>
                      </div>
                      <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform duration-200 ${tvScheduleOpen ? 'rotate-180' : ''}`} />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-0.5 mt-0.5 ml-6">
                      <button
                        onClick={() => { setTvScheduleOpen(false); setMobileMenuOpen(false); handleProtectedNavigation("/mets-schedule-2026"); }}
                        className="flex items-center gap-2 w-full text-muted-foreground hover:text-primary py-1.5 px-2.5 rounded-md text-left text-[11px]"
                      >
                        <CalendarDays className="w-3.5 h-3.5" />
                        Schedule
                      </button>
                      {user && (
                        <button
                          onClick={() => { setTvScheduleOpen(false); setMobileMenuOpen(false); navigate("/mets-roster"); }}
                          className="flex items-center gap-2 w-full text-muted-foreground hover:text-primary py-1.5 px-2.5 rounded-md text-left text-[11px]"
                        >
                          <Users className="w-3.5 h-3.5" />
                          Roster
                        </button>
                      )}
                      <button
                        onClick={() => { setTvScheduleOpen(false); setMobileMenuOpen(false); handleProNavigation("/video-gallery"); }}
                        className="flex items-center gap-2 w-full text-muted-foreground hover:text-primary py-1.5 px-2.5 rounded-md text-left text-[11px]"
                      >
                        <Tv className="w-3.5 h-3.5" />
                        Highlights
                      </button>
                      <button
                        onClick={() => { setTvScheduleOpen(false); setMobileMenuOpen(false); navigate("/mets-game-recaps"); }}
                        className="flex items-center gap-2 w-full text-muted-foreground hover:text-primary py-1.5 px-2.5 rounded-md text-left text-[11px]"
                      >
                        <CalendarDays className="w-3.5 h-3.5" />
                        Game Recaps
                      </button>
                    </CollapsibleContent>
                  </Collapsible>

                  <button
                    onClick={() => { setMobileMenuOpen(false); handleProtectedNavigation("/community"); }}
                    className="flex items-center gap-2.5 w-full text-foreground hover:text-primary hover:bg-primary/8 transition-all py-2 px-2.5 rounded-lg text-left text-xs"
                  >
                    <Users className="w-3.5 h-3.5 text-primary" />
                    <span className="font-medium">Community</span>
                  </button>

                  {/* Radio moved into Podcast dropdown above */}

                  <button
                    onClick={() => { setMobileMenuOpen(false); navigate("/shop"); }}
                    className="flex items-center gap-2.5 w-full text-foreground hover:text-primary hover:bg-primary/8 transition-all py-2 px-2.5 rounded-lg text-left text-xs"
                  >
                    <ShoppingBag className="w-3.5 h-3.5 text-secondary" />
                    <span className="font-medium">Shop</span>
                  </button>
                  
                  {/* Divider */}
                  <div className="h-px bg-muted/20 my-1.5 mx-1" />

                  {/* User account actions */}
                  {user ? (
                    <div className="space-y-0.5">
                      <button 
                        onClick={() => { navigate("/dashboard"); setMobileMenuOpen(false); }}
                        className="flex items-center gap-2.5 w-full text-foreground hover:text-primary hover:bg-primary/8 transition-all py-2 px-2.5 rounded-lg text-left text-xs"
                      >
                        <LayoutDashboard className="w-3.5 h-3.5 text-primary" />
                        <span className="font-medium">Dashboard</span>
                      </button>
                      {isWriter && (
                        <button 
                          onClick={() => { navigate("/writer"); setMobileMenuOpen(false); }}
                          className="flex items-center gap-2.5 w-full text-foreground hover:text-primary hover:bg-primary/8 transition-all py-2 px-2.5 rounded-lg text-left text-xs"
                        >
                          <PenLine className="w-3.5 h-3.5 text-secondary" />
                          <span className="font-medium">Writers Portal</span>
                        </button>
                      )}
                      {isAdmin && (
                        <>
                          <button 
                            onClick={() => { navigate("/admin/stories"); setMobileMenuOpen(false); }}
                            className="flex items-center gap-2.5 w-full text-foreground hover:text-primary hover:bg-primary/8 transition-all py-2 px-2.5 rounded-lg text-left text-xs"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                            <span className="font-medium">Admin Stories</span>
                          </button>
                          <button 
                            onClick={() => { navigate("/admin"); setMobileMenuOpen(false); }}
                            className="flex items-center gap-2.5 w-full text-foreground hover:text-primary hover:bg-primary/8 transition-all py-2 px-2.5 rounded-lg text-left text-xs"
                          >
                            <Shield className="w-3.5 h-3.5 text-destructive" />
                            <span className="font-medium">Admin Portal</span>
                          </button>
                        </>
                      )}
                      
                      <div className="h-px bg-muted/20 my-1 mx-1" />
                      
                      <button 
                        onClick={async () => { await handleAuthClick(); }}
                        className="flex items-center gap-2.5 w-full text-destructive hover:bg-destructive/8 transition-all py-2 px-2.5 rounded-lg text-left text-xs"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span className="font-medium">Sign Out</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1.5 px-0.5">
                      <Button 
                        onClick={() => { navigate("/auth?mode=login"); setMobileMenuOpen(false); }}
                        variant="outline"
                        className="w-full h-8 rounded-lg border-muted/40 hover:bg-muted/30 text-xs"
                      >
                        Login
                      </Button>
                      <Button 
                        onClick={() => { navigate("/auth?mode=signup"); setMobileMenuOpen(false); }}
                        className="w-full h-8 rounded-lg text-xs"
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
