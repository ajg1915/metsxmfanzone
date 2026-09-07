import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const FREE_TRIAL_SETTING_KEY = "free_trial_config";

export type TrialWindow = {
  id: string;
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  audience: "new" | "all";
  grantPlan: "trial" | "premium" | "annual";
  grantDays: number;
  active: boolean;
};

export type FreeTrialConfig = {
  enabled: boolean;
  trialDays: number;
  streamPreviewMinutes: number;
  /** Let logged-out visitors watch scheduled games for a limited time */
  guestPreviewEnabled: boolean;
  guestPreviewMinutes: number;
  windows: TrialWindow[];
};

export const DEFAULT_FREE_TRIAL_CONFIG: FreeTrialConfig = {
  enabled: true,
  trialDays: 2,
  streamPreviewMinutes: 30,
  guestPreviewEnabled: true,
  guestPreviewMinutes: 30,
  windows: [],
};

export function todayET(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

export function getActiveWindow(config: FreeTrialConfig): TrialWindow | null {
  const today = todayET();
  const active = (config.windows || []).filter(
    (w) => w && w.active !== false && w.startDate <= today && today <= w.endDate
  );
  if (active.length === 0) return null;
  const rank = (p: string) => (p === "annual" ? 3 : p === "premium" ? 2 : 1);
  return active.sort(
    (a, b) => rank(b.grantPlan) - rank(a.grantPlan) || b.grantDays - a.grantDays
  )[0];
}

export const useFreeTrialConfig = () => {
  const [config, setConfig] = useState<FreeTrialConfig>(DEFAULT_FREE_TRIAL_CONFIG);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const { data } = await supabase
          .from("site_settings")
          .select("setting_value")
          .eq("setting_key", FREE_TRIAL_SETTING_KEY)
          .maybeSingle();

        if (!cancelled && data?.setting_value) {
          setConfig({
            ...DEFAULT_FREE_TRIAL_CONFIG,
            ...(data.setting_value as unknown as FreeTrialConfig),
          });
        }
      } catch (e) {
        console.error("Failed to load free trial config", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { config, loading, activeWindow: getActiveWindow(config) };
};
