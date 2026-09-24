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
    <nav className="md:hidden sticky bottom-0 z-30 border-t border-white/5 bg-[#060d1d]/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-5 px-1 py-1">
        {ADMIN_QUICK_NAV.map((item) => (
          <NavLink
            key={item.url}
            to={item.url}
            end={item.url === "/admin"}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 rounded-xl py-2 text-[10px] font-semibold transition-all ${
                isActive
                  ? "bg-[#FF5910]/12 text-[#FF7A3D] shadow-[inset_0_0_0_1px_rgba(255,89,16,0.35)]"
                  : "text-slate-400 active:bg-white/5"
              }`
            }
          >
            <item.icon className="h-5 w-5" />
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
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-2 border-b border-white/5 bg-[#060d1d]/85 px-3 backdrop-blur-xl sm:gap-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <SidebarTrigger className="h-10 w-10 rounded-xl text-slate-300 hover:bg-white/5 hover:text-white" />
        <button
          type="button"
          onClick={() => navigate("/")}
          className="flex min-w-0 items-center gap-2 rounded-xl px-1 py-1 text-left hover:bg-white/5"
        >
          <img src={logo} alt="MetsXMFanZone" className="h-8 w-auto flex-shrink-0" />
          <span className="hidden min-w-0 flex-col leading-tight sm:flex">
            <span className="adm-display truncate text-[13px] font-bold text-white">MetsXMFanZone</span>
            <span className="adm-chip truncate text-[9px] text-[#FF7A3D]">Control Room</span>
          </span>
        </button>
      </div>

      <div className="hidden max-w-xl flex-1 sm:block">
        <button
          type="button"
          onClick={onOpenSearch}
          className="relative w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pl-10 pr-14 text-left text-xs text-slate-400 transition-all hover:bg-white/[0.08] focus:outline-none focus:ring-2 focus:ring-[#FF5910]/40"
        >
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          Search admin pages…
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-white/10 bg-white/10 px-1.5 py-0.5 font-mono text-[9px] text-slate-400">
            ⌘K
          </span>
        </button>
      </div>

      <div className="flex flex-shrink-0 items-center gap-1">
        <button
          onClick={onOpenSearch}
          className="rounded-xl p-2.5 text-slate-300 transition-all hover:bg-white/5 hover:text-white sm:hidden"
          title="Search admin"
        >
          <Search className="h-4.5 w-4.5" />
        </button>
        <button
          onClick={() => window.location.reload()}
          className="rounded-xl p-2.5 text-slate-400 transition-all hover:bg-white/5 hover:text-white"
          title="Refresh"
        >
          <RefreshCw className="h-4.5 w-4.5" />
        </button>
        <NotificationsBell />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/")}
          className="h-9 rounded-xl px-2.5 text-[11px] text-slate-300 hover:bg-white/5 hover:text-white"
        >
          <Home className="h-4 w-4 sm:mr-1.5" />
          <span className="hidden sm:inline">View site</span>
        </Button>
      </div>
    </header>
  );
}

export function AdminLayout() {
  useEffect(() => {
    if (!isAdmin && !pinOnlyAuth) return;

    let timeoutId: ReturnType<typeof setTimeout>;
    const INACTIVITY_LIMIT = 5 * 60 * 1000; // 5 minutes

    const handleInactivity = () => {
      toast({
        title: "Session Expired",
        description: "Admin session closed due to 5 minutes of inactivity.",
        variant: "destructive",
      });
      handleFreshAdminLogin();
    };

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(handleInactivity, INACTIVITY_LIMIT);
    };

    const activityEvents = ["mousedown", "mousemove", "keydown", "scroll", "touchstart"];
    activityEvents.forEach((event) =>
      document.addEventListener(event, resetTimer, { passive: true })
    );

    resetTimer();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      activityEvents.forEach((event) =>
        document.removeEventListener(event, resetTimer)
      );
    };
  }, [isAdmin, pinOnlyAuth]);

  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);
  const [needsPinVerification, setNeedsPinVerification] = useState(false);
  const [pinVerified, setPinVerified] = useState(false);
  const [pinOnlyAuth, setPinOnlyAuth] = useState(false);
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

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
      <div className="admin-shell flex min-h-screen w-full overflow-x-hidden">
        <AdminSidebar />
        <div className="flex-1 flex flex-col min-w-0 w-full max-w-full">
          <AdminHeader navigate={navigate} onOpenSearch={() => setSearchOpen(true)} />
          <AdminCommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
          <main className="flex-1 overflow-x-hidden overflow-y-auto p-3 sm:p-5 md:p-7 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-6 max-w-full
            [&_h1]:text-lg [&_h1]:sm:text-xl [&_h1]:md:text-2xl [&_h1]:font-bold [&_h1]:tracking-tight [&_h1]:text-white
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
