import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, X, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";

const FREE_PLAN_EXPIRY_DATE = new Date("2026-03-22T00:00:00");
const BANNER_DISMISS_KEY = "free_expiry_banner_dismissed";

const FreeTrialExpiryBanner = () => {
  const { user } = useAuth();
  const { tier, loading, isAdmin } = useSubscription();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(() => {
    return sessionStorage.getItem(BANNER_DISMISS_KEY) === "true";
  });

  if (loading || !user || dismissed || isAdmin) return null;
  if (tier !== "free") return null;

  const now = new Date();
  const showBanner = now >= FREE_PLAN_EXPIRY_DATE;

  if (!showBanner) return null;

  const daysUntilEnd = Math.max(
    0,
    Math.ceil(
      (new Date("2026-03-31T23:59:59").getTime() - now.getTime()) /
        (1000 * 60 * 60 * 24)
    )
  );

  const handleDismiss = () => {
    sessionStorage.setItem(BANNER_DISMISS_KEY, "true");
    setDismissed(true);
  };

  return (
    <div className="bg-gradient-to-r from-amber-600 to-orange-600 text-white px-4 py-3 relative">
      <div className="container mx-auto max-w-7xl flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <p className="text-xs sm:text-sm font-medium">
            {daysUntilEnd > 0 ? (
              <>
                Your free plan expires in <strong>{daysUntilEnd} day{daysUntilEnd !== 1 ? "s" : ""}</strong>. Upgrade now to keep access to all live streaming features.
              </>
            ) : (
              <>
                Your free plan has expired. Upgrade to continue watching live streams.
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            size="sm"
            onClick={() => navigate("/pricing")}
            className="bg-white text-orange-600 hover:bg-white/90 text-xs font-bold gap-1"
          >
            <Crown className="w-3 h-3" />
            Upgrade
          </Button>
          <button
            onClick={handleDismiss}
            className="p-1 hover:bg-white/20 rounded transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default FreeTrialExpiryBanner;
