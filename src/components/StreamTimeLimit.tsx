import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useFreeTrialConfig } from "@/hooks/useFreeTrial";
import { useFreeStreams } from "@/hooks/useFreeStreams";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import metsLogo from "@/assets/metsxmfanzone-logo.png";

interface StreamTimeLimitProps {
  children: React.ReactNode;
  /** Stream id, used to check if an admin marked this game as free for everyone */
  streamId?: string | null;
  /** Page key (e.g. "metsxmfanzone"), also checkable as a free stream */
  pageKey?: string | null;
  /** Scheduled games: let logged-out visitors watch for a limited window first */
  allowGuestPreview?: boolean;
}

type PlanType = "free" | "trial" | "weekly" | "premium" | "annual";

const STORAGE_KEY = "stream_viewing_start";
const GUEST_STORAGE_KEY = "guest_stream_preview_start";

const StreamTimeLimit = ({ children, streamId, pageKey, allowGuestPreview = false }: StreamTimeLimitProps) => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { config, loading: configLoading } = useFreeTrialConfig();
  const { isFree, loading: freeLoading } = useFreeStreams();
  const freeForEveryone = !freeLoading && isFree(streamId, pageKey);
  const [userPlan, setUserPlan] = useState<PlanType | null>(null);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [loading, setLoading] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [guestRemaining, setGuestRemaining] = useState<number | null>(null);
  const [guestExpired, setGuestExpired] = useState(false);

  const guestPreviewEnabled =
    allowGuestPreview && !configLoading && config.guestPreviewEnabled !== false;
  const guestMinutes = Math.max(1, Number(config.guestPreviewMinutes) || 30);

  const previewMinutes = Math.max(1, Number(config.streamPreviewMinutes) || 30);
  const previewMs = previewMinutes * 60 * 1000;
  const isPreviewPlan = userPlan === "free" || userPlan === "trial";

  // Redirect unauthenticated users to login
  useEffect(() => {
    if (freeForEveryone) return;
    if (configLoading) return;
    if (!authLoading && !user && !guestPreviewEnabled) {
      navigate("/auth", { replace: true });
    }
  }, [user, authLoading, navigate, freeForEveryone, guestPreviewEnabled, configLoading]);

  // Countdown for every logged-out free preview, including streams an admin
  // explicitly selected as free to watch.
  useEffect(() => {
    if (user || !guestPreviewEnabled) return;

    let start = localStorage.getItem(GUEST_STORAGE_KEY);
    if (!start) {
      start = Date.now().toString();
      localStorage.setItem(GUEST_STORAGE_KEY, start);
    }
    const limitMs = guestMinutes * 60 * 1000;

    const previewStartedAt = Number.parseInt(start, 10);
    const tick = () => {
      const remaining = limitMs - (Date.now() - previewStartedAt);
      if (remaining <= 0) {
        setGuestRemaining(0);
        setGuestExpired(true);
      } else {
        setGuestRemaining(Math.ceil(remaining / 1000));
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [user, guestPreviewEnabled, guestMinutes]);

  // Fetch user's subscription plan
  useEffect(() => {
    const fetchPlan = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        // Admins get unrestricted access
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle();

        if (roleData) {
          setUserPlan("annual");
          setLoading(false);
          return;
        }

        const { data: subData } = await supabase
          .from("subscriptions")
          .select("plan_type, end_date")
          .eq("user_id", user.id)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const stillValid =
          !subData?.end_date || new Date(subData.end_date) > new Date();
        const plan = (stillValid ? (subData?.plan_type as PlanType) : "free") || "free";
        setUserPlan(plan);
      } catch (error) {
        console.error("Error fetching plan:", error);
        setUserPlan("free");
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchPlan();
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [user, authLoading]);


  // Countdown for preview-tier viewers
  useEffect(() => {
    if (loading || configLoading || !isPreviewPlan) return;

    // One-time preview: the start time is saved permanently on the account
    // (and on this device), so it never restarts on refresh, new tabs or other devices.
    const userKey = `${STORAGE_KEY}_${user?.id ?? "anon"}`;
    const metaStart = Number(user?.user_metadata?.stream_preview_started_at) || 0;
    const localStart = Number(localStorage.getItem(userKey)) || 0;
    const known = [metaStart, localStart].filter(Boolean);
    const startTime = String(known.length ? Math.min(...known) : Date.now());
    localStorage.setItem(userKey, startTime);
    if (!metaStart && user) {
      void supabase.auth.updateUser({ data: { stream_preview_started_at: Number(startTime) } });
    }

    const previewStartedAt = Number.parseInt(startTime, 10);
    const checkTimeLimit = () => {
       const elapsed = Date.now() - previewStartedAt;
      const remaining = previewMs - elapsed;

      if (remaining <= 0) {
        setShowUpgradePrompt(true);
        setTimeRemaining(0);
      } else {
        setTimeRemaining(Math.ceil(remaining / 1000));
      }
    };

    checkTimeLimit();
    const interval = setInterval(checkTimeLimit, 1000);
    return () => clearInterval(interval);
  }, [loading, configLoading, isPreviewPlan, previewMs, user]);

  const handleUpgrade = () => {
    setShowUpgradePrompt(false);
    window.location.href = "/pricing";
  };

  const handleGoHome = () => {
    setShowUpgradePrompt(false);
    window.location.href = "/";
  };

  if (authLoading || loading || freeLoading || configLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <img src={metsLogo} alt="MetsXMFanZone" className="w-16 h-16 mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Checking access...</p>
        </div>
      </div>
    );
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Logged-out visitors on scheduled games: timed free preview, then must sign up
  if (!user) {
    if (!guestPreviewEnabled) return null;

    return (
      <>
        {!guestExpired && (
          <>
            {guestRemaining !== null && guestRemaining > 0 && (
              <div className="fixed top-20 right-4 z-50 bg-background/90 backdrop-blur-sm border border-primary rounded-lg px-4 py-2 shadow-lg">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                  <span className="text-sm font-medium text-foreground">
                    Free Preview: {formatTime(guestRemaining)}
                  </span>
                </div>
              </div>
            )}
            {children}
          </>
        )}

        <AlertDialog open={guestExpired}>
          <AlertDialogContent className="max-w-md" onEscapeKeyDown={(e) => e.preventDefault()}>
            <AlertDialogHeader className="text-center">
              <div className="mx-auto mb-4 w-16 h-16 rounded-full flex items-center justify-center">
                <img src={metsLogo} alt="MetsXM" className="w-14 h-14 object-contain" />
              </div>
              <AlertDialogTitle className="text-xl">
                Your {guestMinutes}-Minute Free Preview Has Ended
              </AlertDialogTitle>
              <AlertDialogDescription className="text-center">
                Create a free account or log in to keep watching the game.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
              <Button onClick={() => navigate("/auth")} className="w-full">
                Sign Up / Log In
              </Button>
              <Button variant="outline" onClick={handleGoHome} className="w-full">
                Return Home
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  // Admin-selected free games remain unrestricted for signed-in viewers.
  if (freeForEveryone) {
    return <>{children}</>;
  }

  // Free + trial members get a timed stream preview
  if (isPreviewPlan) {
    return (
      <>
        {!showUpgradePrompt && (
          <>
            {timeRemaining !== null && timeRemaining > 0 && (
              <div className="fixed top-20 right-4 z-50 bg-background/90 backdrop-blur-sm border border-primary rounded-lg px-4 py-2 shadow-lg">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                  <span className="text-sm font-medium text-foreground">
                    Stream Preview: {formatTime(timeRemaining)}
                  </span>
                </div>
              </div>
            )}
            {children}
          </>
        )}

        <AlertDialog open={showUpgradePrompt}>
          <AlertDialogContent className="max-w-md" onEscapeKeyDown={(e) => e.preventDefault()}>
            <AlertDialogHeader className="text-center">
              <div className="mx-auto mb-4 w-16 h-16 rounded-full flex items-center justify-center">
                <img src={metsLogo} alt="MetsXM" className="w-14 h-14 object-contain" />
              </div>
              <AlertDialogTitle className="text-xl">
                Your Stream Preview Has Ended
              </AlertDialogTitle>
              <AlertDialogDescription className="text-center space-y-3">
                <p>
                  Thank you for watching! Your {previewMinutes}-minute stream preview has ended.
                </p>
                <p>
                  Upgrade to a paid membership to enjoy unlimited streaming with no time limits.
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
              <Button onClick={handleUpgrade} className="w-full gap-2">
                <img src={metsLogo} alt="MetsXM" className="w-4 h-4 object-contain" />
                Select a Plan
              </Button>
              <Button variant="outline" onClick={handleGoHome} className="w-full">
                Return Home
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  // Paid members get unlimited access
  return <>{children}</>;
};

export default StreamTimeLimit;
