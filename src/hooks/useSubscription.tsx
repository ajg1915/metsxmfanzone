import { useState, useEffect } from "react";
import { useAuth } from "./useAuth";
import { supabase } from "@/integrations/supabase/client";

export type SubscriptionTier = "free" | "trial" | "weekly" | "premium" | "annual";

export const useSubscription = () => {
  const { user, loading: authLoading } = useAuth();
  const [tier, setTier] = useState<SubscriptionTier>("free");
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [trialEndsAt, setTrialEndsAt] = useState<Date | null>(null);
  const [limitedAccess, setLimitedAccess] = useState(false);


  useEffect(() => {
    // Wait for auth to complete first
    if (authLoading) {
      setLoading(true);
      return;
    }

    const fetchSubscription = async () => {
      if (!user) {
        setTier("free");
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      try {
        // Check if user is admin - give full access via proper role check
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle();

        if (roleData) {
          setIsAdmin(true);
          setTier("annual"); // Give admins full access
          setLoading(false);
          return;
        }

        setIsAdmin(false);

        const { data: accessEvents } = await supabase
          .from("subscription_activity")
          .select("action, created_at")
          .eq("user_id", user.id)
          .in("action", ["membership_cancelled", "account_cancelled_deleted", "access_restored"])
          .order("created_at", { ascending: false });
        const latestRestore = accessEvents?.find((event) => event.action === "access_restored")?.created_at;
        const cancellationCount = (accessEvents || []).filter((event) =>
          event.action !== "access_restored" && (!latestRestore || event.created_at > latestRestore)
        ).length;
        const isLimited = cancellationCount > 2;
        setLimitedAccess(isLimited);
        if (isLimited) {
          setTier("free");
          setTrialEndsAt(null);
          setLoading(false);
          return;
        }

        // Check subscription status
        const { data, error } = await supabase
          .from("subscriptions")
          .select("plan_type, status, end_date, start_date")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && data) {
          // Check if subscription is still valid
          const endDate = data.end_date ? new Date(data.end_date) : null;
          const isActive = data.status === "active" || (data.status === "cancelled" && !!endDate && endDate > new Date());

          if (isActive) {
            setTier(data.plan_type as SubscriptionTier);
            setTrialEndsAt(data.plan_type === "trial" ? endDate : null);
          } else {
            setTier("free");
            setTrialEndsAt(null);
          }
        } else {
          setTier("free");
          setTrialEndsAt(null);
        }
      } catch (error) {
        console.error("Error fetching subscription:", error);
        setTier("free");
      } finally {
        setLoading(false);
      }
    };

    fetchSubscription();
  }, [user, authLoading]);

  const hasAccess = (requiredTier: "free" | "premium") => {
    if (isAdmin) return true; // Admins always have full access
    if (limitedAccess) return requiredTier === "free";
    if (requiredTier === "free") return true;
    if (tier === "weekly" || tier === "premium" || tier === "annual") return true;
    return false;
  };

  const isPremium = isAdmin || (!limitedAccess && (tier === "weekly" || tier === "premium" || tier === "annual"));
  // Trial members can browse the whole site, but streams are preview-only
  const isTrial = !isAdmin && tier === "trial";

  return {
    tier,
    loading,
    hasAccess,
    isPremium,
    isTrial,
    trialEndsAt,
    isAdmin,
    limitedAccess,
  };
};

