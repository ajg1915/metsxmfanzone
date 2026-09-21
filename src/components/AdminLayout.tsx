import { useEffect, useState } from "react";
import { useNavigate, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/AdminSidebar";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Home, LogIn, RefreshCw, Search } from "lucide-react";

import { generateDeviceFingerprint } from "@/utils/deviceFingerprint";
import logo from "@/assets/metsxmfanzone-logo.png";
import { NotificationsBell } from "@/components/admin/NotificationsBell";
import { AdminCommandPalette } from "@/components/admin/AdminCommandPalette";
import { ADMIN_QUICK_NAV } from "@/components/admin/adminNav";
import { NavLink } from "react-router-dom";
import { withTimeout } from "@/utils/asyncTimeout";

function AdminMobileNav() {
  return (
    <nav className="md:hidden sticky bottom-0 z-30 border-t border-white/10 bg-[#020617]/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-5">
        {ADMIN_QUICK_NAV.map((item) => (
          <NavLink
            key={item.url}
            to={item.url}
            end={item.url === "/admin"}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium transition-colors ${
                isActive ? "text-[#FF5910]" : "text-slate-400"
              }`
            }
          >
            <item.icon className="h-4.5 w-4.5" />
            {item.title}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

function AdminHeader({
  navigate,
  onOpenSearch,
}: {
  navigate: (path: string | number) => void;
  onOpenSearch: () => void;
}) {
  return (
    <header className="h-14 border-b border-white/10 flex items-center justify-between px-3 sm:px-6 gap-2 sm:gap-4 bg-[#020617]/80 backdrop-blur-xl sticky top-0 z-20">
      <div className="flex items-center gap-2 flex-shrink-0">
        <SidebarTrigger className="h-9 w-9 text-slate-300 hover:text-white hover:bg-white/5 rounded-lg" />
        <div className="hidden sm:flex items-center gap-1.5 cursor-pointer" onClick={() => navigate("/")}>
          <img src={logo} alt="MetsXMFanZone Logo" className="h-7 w-auto" />
          <span className="text-[11px] font-semibold text-foreground">MetsXMFanZone</span>
        </div>
      </div>

      <div className="flex-1 max-w-xl hidden sm:block">
        <button
          type="button"
          onClick={onOpenSearch}
          className="relative w-full text-left bg-white/5 border border-white/10 rounded-full py-2 pl-9 pr-12 text-xs text-slate-500 hover:bg-white/10 focus:outline-none focus:ring-1 focus:ring-[#FF5910]/60 transition-all"
        >
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
          Search admin pages...
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] bg-white/10 px-1.5 py-0.5 rounded border border-white/10 text-slate-400 font-mono pointer-events-none">
            ⌘K
          </span>
        </button>
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          onClick={onOpenSearch}
          className="sm:hidden p-2 rounded-full text-slate-300 hover:text-white hover:bg-white/5 transition-all"
          title="Search admin"
        >
          <Search className="w-4 h-4" />
        </button>
        <button
          onClick={() => window.location.reload()}
          className="relative p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/5 transition-all"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
        <NotificationsBell />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/")}
          className="h-8 text-[11px] px-2.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg"
        >
          <Home className="w-3.5 h-3.5 sm:mr-1.5" />
          <span className="hidden sm:inline">Site</span>
        </Button>
      </div>
    </header>
  );
}

export function AdminLayout() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);
  const [needsPinVerification, setNeedsPinVerification] = useState(false);
  const [pinVerified, setPinVerified] = useState(false);
  const [pinOnlyAuth, setPinOnlyAuth] = useState(false);
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);

  const clearAdminSession = () => {
    sessionStorage.removeItem("admin_verified");
    sessionStorage.removeItem("admin_verified_at");
    sessionStorage.removeItem("admin_user_id");
    sessionStorage.removeItem("admin_session_token");
    sessionStorage.removeItem("admin_device_fingerprint");
  };

  const handleFreshAdminLogin = async () => {
    clearAdminSession();
    await signOut();
    navigate("/admin-portal", { replace: true });
  };

  useEffect(() => {
    if (!loading && !checking) {
      setLoadingTimedOut(false);
      return;
    }

    const timer = setTimeout(() => setLoadingTimedOut(true), 6500);
    return () => clearTimeout(timer);
  }, [loading, checking]);

  useEffect(() => {
    // Check if already verified this session
    const verified = sessionStorage.getItem("admin_verified");
    const verifiedAt = sessionStorage.getItem("admin_verified_at");
    const adminUserId = sessionStorage.getItem("admin_user_id");
    const storedFingerprint = sessionStorage.getItem("admin_device_fingerprint");
    
    if (verified === "true" && verifiedAt) {
      const verifiedTime = new Date(verifiedAt);
      const hoursSinceVerification = (Date.now() - verifiedTime.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceVerification < 24) {
        // Only auto-trust sessionStorage for PIN-only auth (no Supabase user)
        // For traditional auth (user exists), always require fresh PIN verification
        if (adminUserId && !user) {
          setPinOnlyAuth(true);
          setPinVerified(true);
          generateDeviceFingerprint().then(currentFp => {
            if (storedFingerprint && storedFingerprint !== currentFp) {
              sessionStorage.removeItem("admin_verified");
              sessionStorage.removeItem("admin_verified_at");
              sessionStorage.removeItem("admin_user_id");
              sessionStorage.removeItem("admin_session_token");
              sessionStorage.removeItem("admin_device_fingerprint");
              setPinVerified(false);
              navigate("/admin-portal");
            }
          });
        } else {
          // Traditional auth user - trust session verification too
          setPinVerified(true);
        }
      } else {
        // Expired, clear it
        sessionStorage.removeItem("admin_verified");
        sessionStorage.removeItem("admin_verified_at");
        sessionStorage.removeItem("admin_user_id");
        sessionStorage.removeItem("admin_session_token");
        sessionStorage.removeItem("admin_device_fingerprint");
      }
    }
  }, [navigate, user]);

  useEffect(() => {
    // Don't run admin check until auth has finished loading
    if (loading) return;

    const checkAdmin = async () => {


      // Check for PIN-only authentication first
      const adminUserId = sessionStorage.getItem("admin_user_id");
      const pinVerifiedSession = sessionStorage.getItem("admin_verified") === "true";
      
      if (adminUserId && pinVerifiedSession && !user) {
        // Session was verified at sign-in on this device; trust it without an
        // extra backend round-trip so admin pages open instantly.
        setIsAdmin(true);
        setPinOnlyAuth(true);
        setPinVerified(true);
        setNeedsPinVerification(false);
        setChecking(false);
        return;
      }

      // Traditional auth flow
      if (!user) {
        // No user and no PIN auth - redirect to portal
        setChecking(false);
        navigate("/admin-portal", { replace: true });
        return;
      }

      // User exists - check admin role
      try {
        const { data, error } = await withTimeout(
          supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id)
            .eq("role", "admin")
            .maybeSingle(),
          7000,
          "Admin role check timed out"
        );

        if (error) {
          // Backend unreachable - fall back to the PIN portal rather than denying access
          console.warn("Admin role lookup failed:", error);
          setChecking(false);
          navigate("/admin-portal", { replace: true });
          return;
        }

        if (!data) {
          toast({
            title: "Access Denied",
            description: "You don't have admin privileges",
            variant: "destructive",
          });
          navigate("/");
          return;
        }


        setIsAdmin(true);
        // PIN verification removed: admin role check is sufficient.
        setPinVerified(true);
        setNeedsPinVerification(false);
      } catch (err) {
        console.error("Error checking admin role:", err);
        toast({
          title: "Admin check failed",
          description: "Please start a fresh admin login session.",
          variant: "destructive",
        });
        setChecking(false);
        navigate("/admin-portal", { replace: true });
        return;
      }
      setChecking(false);
    };

    checkAdmin();
  }, [user, loading, navigate, toast, pinVerified]);


  if (loading || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card/90 p-5 text-center shadow-2xl backdrop-blur-xl">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            {loadingTimedOut ? (
              <AlertTriangle className="h-6 w-6 text-destructive" />
            ) : (
              <RefreshCw className="h-6 w-6 animate-spin text-primary" />
            )}
          </div>
          <h1 className="text-base font-bold text-foreground">
            {loadingTimedOut ? "Admin login needs a refresh" : "Checking admin access"}
          </h1>
          <p className="mt-2 text-xs text-muted-foreground">
            {loadingTimedOut
              ? "Your saved login may be expired. Start a fresh secure admin login to continue."
              : "Verifying your account and secure PIN session..."}
          </p>
          {loadingTimedOut && (
            <div className="mt-4 grid gap-2">
              <Button onClick={handleFreshAdminLogin} className="w-full">
                <LogIn className="mr-2 h-4 w-4" />
                Open Secure PIN Login
              </Button>
              <Button variant="outline" onClick={() => window.location.reload()} className="w-full">
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh Page
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // For PIN-only auth, we don't have a Supabase user
  if (!isAdmin && !pinOnlyAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card/90 p-5 text-center shadow-2xl backdrop-blur-xl">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <h1 className="text-base font-bold text-foreground">Admin sign-in needed</h1>
          <p className="mt-2 text-xs text-muted-foreground">
            We couldn't confirm your admin access on this device. Sign in again to continue.
          </p>
          <div className="mt-4 grid gap-2">
            <Button onClick={handleFreshAdminLogin} className="w-full">
              <LogIn className="mr-2 h-4 w-4" />
              Sign in as Admin
            </Button>
            <Button variant="outline" onClick={() => navigate("/")} className="w-full">
              <Home className="mr-2 h-4 w-4" />
              Back to Site
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // PIN verification screen removed — admins go straight to the dashboard.

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="min-h-screen flex w-full overflow-x-hidden bg-[#020617] text-slate-200">
        <AdminSidebar />
        <div className="flex-1 flex flex-col min-w-0 w-full max-w-full">
          <AdminHeader navigate={navigate} onOpenSearch={() => setSearchOpen(true)} />
          <AdminCommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
          <main className="flex-1 overflow-x-hidden overflow-y-auto p-3 sm:p-5 md:p-6 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-6 max-w-full
            [&_h1]:text-base [&_h1]:sm:text-lg [&_h1]:md:text-xl [&_h1]:font-bold [&_h1]:tracking-tight [&_h1]:text-white
            [&_h2]:text-sm [&_h2]:sm:text-base [&_h2]:font-semibold [&_h2]:text-white
            [&_h3]:text-xs [&_h3]:sm:text-sm [&_h3]:text-white
            [&_.container]:px-0 [&_.container]:sm:px-1 [&_.container]:max-w-full
            [&_.card]:bg-white/[0.03] [&_.card]:backdrop-blur-xl [&_.card]:border-white/10 [&_.card]:rounded-2xl
            [&_input]:bg-white/5 [&_input]:border-white/10
            [&_textarea]:bg-white/5 [&_textarea]:border-white/10
            [&_table]:text-xs
            [&_th]:text-[10px] [&_th]:uppercase [&_th]:tracking-widest [&_th]:text-slate-500 [&_th]:font-bold [&_th]:border-white/5
            [&_td]:border-white/5
          ">
            <Outlet />
          </main>
          <AdminMobileNav />
        </div>
      </div>
    </SidebarProvider>
  );
}
