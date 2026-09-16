import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const THROTTLE_KEY = "mets:lastLineupAutoFetch";
const THROTTLE_MS = 15 * 60 * 1000; // don't hammer the backend
const REFRESH_MS = 30 * 60 * 1000;

const getTodayET = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });

/**
 * Automatically keeps today's lineup card and Anthony's predictions fresh.
 * Throttled across tabs/pages via localStorage so it only hits the backend
 * at most once every 15 minutes.
 */
export function useAutoLineupFetch(onUpdated?: () => void) {
  useEffect(() => {
    let cancelled = false;

    const run = async (force = false) => {
      try {
        const last = Number(localStorage.getItem(THROTTLE_KEY) || 0);
        if (!force && Date.now() - last < THROTTLE_MS) return;
        localStorage.setItem(THROTTLE_KEY, String(Date.now()));

        const today = getTodayET();

        const { error } = await supabase.functions.invoke("fetch-mets-lineup");
        if (error) console.error("Auto lineup fetch failed:", error);

        // Make sure Anthony's predictions exist for today
        const { data: preds } = await supabase
          .from("daily_player_predictions")
          .select("id")
          .eq("prediction_date", today)
          .limit(1);

        if (!preds || preds.length === 0) {
          const { error: predError } = await supabase.functions.invoke(
            "generate-daily-predictions"
          );
          if (predError) console.error("Auto predictions failed:", predError);
        }

        if (!cancelled) onUpdated?.();
      } catch (err) {
        console.error("Auto lineup/predictions refresh error:", err);
      }
    };

    const initial = setTimeout(() => run(), 3000);
    const interval = setInterval(() => run(), REFRESH_MS);

    return () => {
      cancelled = true;
      clearTimeout(initial);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
