import { useState, useEffect } from "react";
import { useAuth } from "./useAuth";
import { supabase } from "@/integrations/supabase/client";

export type SubscriptionTier = "free" | "weekly" | "premium" | "annual";

export const useSubscription = () => {
  const { user, loading: authLoading } = useAuth();
  const [tier, setTier] = useState<SubscriptionTier>("free");
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

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

        // Check subscription status
        const { data, error } = await supabase
          .from("subscriptions")
          .select("plan_type, status, end_date, start_date")
          .eq("user_id", user.id)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && data) {
          // Check if subscription is still valid
          const endDate = data.end_date ? new Date(data.end_date) : null;
          const isActive = !endDate || endDate > new Date();
          
          if (isActive) {
            setTier(data.plan_type as SubscriptionTier);
          } else {
            setTier("free");
          }
        } else {
          setTier("free");
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
    if (requiredTier === "free") return true;
    if (tier === "premium" || tier === "annual") return true;
    return false;
  };

  const isPremium = isAdmin || tier === "premium" || tier === "annual";

  return {
    tier,
    loading,
    hasAccess,
    isPremium,
    isAdmin,
  };
};
