import { useEffect, useState } from "react";
import { useNavigate, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/AdminSidebar";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Home, RefreshCw } from "lucide-react";
import { AdminPinVerification } from "@/components/AdminPinVerification";
import { generateDeviceFingerprint } from "@/utils/deviceFingerprint";

function AdminHeader({ navigate }: { navigate: (path: string | number) => void }) {
  return (
    <header className="h-11 border-b border-muted/30 flex items-center justify-between px-2 sm:px-3 bg-card/80 backdrop-blur-xl sticky top-0 z-10">
      <div className="flex items-center gap-1.5 sm:gap-2">
        <SidebarTrigger className="h-7 w-7 flex-shrink-0 text-muted-foreground hover:text-foreground" />
        <h1 className="text-xs sm:text-sm font-semibold truncate text-foreground">Admin</h1>
      </div>
      <div className="flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => window.location.reload()}
          className="h-7 text-xs px-2 flex-shrink-0 text-muted-foreground hover:text-foreground border border-muted/30"
          title="Refresh"
        >
          <RefreshCw className="w-3.5 h-3.5 sm:mr-1" />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/")}
          className="h-7 text-xs px-2 flex-shrink-0 text-muted-foreground hover:text-foreground border border-muted/30"
        >
          <Home className="w-3.5 h-3.5 sm:mr-1" />
          <span className="hidden sm:inline">Back to Site</span>
        </Button>
      </div>
    </header>
  );
}

export function AdminLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);
  const [needsPinVerification, setNeedsPinVerification] = useState(false);
  const [pinVerified, setPinVerified] = useState(false);
  const [pinOnlyAuth, setPinOnlyAuth] = useState(false);

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
        // PIN-only auth - verify the user is still an admin in database
        try {
          const { data: roleData } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", adminUserId)
            .eq("role", "admin")
            .maybeSingle();

          if (!roleData) {
            toast({
              title: "Access Denied",
              description: "Admin privileges have been revoked",
              variant: "destructive",
            });
            sessionStorage.removeItem("admin_verified");
            sessionStorage.removeItem("admin_user_id");
            navigate("/admin-portal");
            return;
          }

          setIsAdmin(true);
          setPinOnlyAuth(true);
          setPinVerified(true);
        } catch (err) {
          console.error("Error checking admin role:", err);
          navigate("/admin-portal");
          return;
        }
        setChecking(false);
        return;
      }

      // Traditional auth flow
      if (!user) {
        // No user and no PIN auth - redirect to portal
        navigate("/admin-portal");
        return;
      }

      // User exists - check admin role
      try {
        const { data } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle();

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
        
        // If not already PIN verified, require PIN
        if (!pinVerified) {
          setNeedsPinVerification(true);
        }
      } catch (err) {
        console.error("Error checking admin role:", err);
        navigate("/");
        return;
      }
      setChecking(false);
    };

    checkAdmin();
  }, [user, loading, navigate, toast, pinVerified]);

  const handlePinVerified = () => {
    setPinVerified(true);
    setNeedsPinVerification(false);
  };

  const handlePinCancel = () => {
    navigate("/admin-portal");
  };

  if (loading || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // For PIN-only auth, we don't have a Supabase user
  if (!isAdmin && !pinOnlyAuth) {
    return null;
  }

  // Show PIN verification if needed (only for traditional auth flow)
  if (needsPinVerification && !pinVerified && user) {
    const userId = user?.id || sessionStorage.getItem("admin_user_id");
    if (!userId) {
      navigate("/admin-portal");
      return null;
    }
    return (
      <AdminPinVerification
        userId={userId}
        onVerified={handlePinVerified}
        onCancel={handlePinCancel}
      />
    );
  }

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="min-h-screen flex w-full overflow-x-hidden bg-background">
        <AdminSidebar />
        <div className="flex-1 flex flex-col min-w-0 w-full max-w-full">
          <AdminHeader navigate={navigate} />
          <main className="flex-1 overflow-x-hidden overflow-y-auto p-1.5 sm:p-2 md:p-3 pb-20 sm:pb-3 max-w-full
            [&_h1]:text-sm [&_h1]:sm:text-base [&_h1]:md:text-lg [&_h1]:font-bold
            [&_h2]:text-xs [&_h2]:sm:text-sm [&_h2]:md:text-base [&_h2]:font-semibold
            [&_h3]:text-[11px] [&_h3]:sm:text-xs [&_h3]:md:text-sm
            [&_.container]:px-0 [&_.container]:sm:px-1 [&_.container]:max-w-full
            [&_.card]:text-xs [&_.card]:bg-card/80 [&_.card]:backdrop-blur-xl [&_.card]:border-muted/30
            [&_.card-header]:p-2 [&_.card-header]:sm:p-2.5 [&_.card-content]:p-2 [&_.card-content]:sm:p-2.5
            [&_.card-title]:text-[11px] [&_.card-title]:sm:text-xs
            [&_.card-description]:text-[10px] [&_.card-description]:sm:text-[11px]
            [&_input]:text-[11px] [&_input]:sm:text-xs [&_input]:h-7 [&_input]:bg-muted/30 [&_input]:border-muted/40
            [&_textarea]:text-[11px] [&_textarea]:sm:text-xs [&_textarea]:bg-muted/30 [&_textarea]:border-muted/40
            [&_select]:text-[11px] [&_select]:sm:text-xs
            [&_button]:text-[10px] [&_button]:sm:text-xs
            [&_label]:text-[10px] [&_label]:sm:text-xs
            [&_.badge]:text-[9px] [&_.badge]:sm:text-[10px] [&_.badge]:px-1.5 [&_.badge]:py-0
            [&_table]:text-[10px] [&_table]:sm:text-xs
            [&_th]:p-1.5 [&_th]:sm:p-2 [&_th]:text-[10px] [&_th]:sm:text-xs
            [&_td]:p-1.5 [&_td]:sm:p-2
            [&_p]:text-[11px] [&_p]:sm:text-xs
            [&_.space-y-4]:space-y-2 [&_.space-y-6]:space-y-3 [&_.space-y-8]:space-y-4
            [&_.gap-4]:gap-2 [&_.gap-6]:gap-3 [&_.gap-8]:gap-4
            [&_.mb-4]:mb-2 [&_.mb-6]:mb-3 [&_.mb-8]:mb-4
            [&_.mt-4]:mt-2 [&_.mt-6]:mt-3 [&_.mt-8]:mt-4
            [&_.py-6]:py-3 [&_.py-8]:py-4
            [&_.px-4]:px-2 [&_.px-6]:px-3
          ">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
