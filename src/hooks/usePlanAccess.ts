import { useSubscription } from "@/hooks/useSubscription";
import { usePlansConfig, type AccessKey, type PlanId } from "@/lib/plansConfig";

/** What the signed-in member's plan allows, from Admin > Plans and Access (admins can use everything). */
export function usePlanAccess() {
  const { tier, isAdmin, loading, limitedAccess } = useSubscription();
  const { config } = usePlansConfig();
  const can = (key: AccessKey) => {
    if (isAdmin) return true;
    if (limitedAccess) return false;
    if (tier === "weekly" || tier === "premium" || tier === "annual") return config[tier as PlanId].access[key];
    return false;
  };
  return { can, loading, tier, isAdmin };
}
