import { supabase } from "@/integrations/supabase/client";
import { recoverFromStaleBuild } from "@/utils/staleBuildRecovery";

// "Refresh everyone": an admin stamps site_settings.force_refresh with the current time; every open
// copy of the site (browser, phone app, TV app) notices the new stamp and reloads the newest version.
export const FORCE_REFRESH_KEY = "force_refresh";
const SENT_BY_ME = "force_refresh_sent_at";
const POLL_MS = 60_000;

type Stamp = { at?: string } | null;

async function readStamp(): Promise<string | null> {
  const { data } = await supabase
    .from("site_settings")
    .select("setting_value")
    .eq("setting_key", FORCE_REFRESH_KEY)
    .maybeSingle();
  return ((data?.setting_value as Stamp)?.at as string | undefined) ?? null;
}

/** Admin action: ask every open copy of the site to reload. */
export async function sendForceRefresh(): Promise<{ error?: string; at?: string }> {
  const at = new Date().toISOString();
  const { error } = await supabase.from("site_settings").upsert(
    { setting_key: FORCE_REFRESH_KEY, setting_value: { at } as never, setting_type: "general", is_public: true },
    { onConflict: "setting_key" },
  );
  if (error) return { error: error.message };
  try {
    sessionStorage.setItem(SENT_BY_ME, at); // the admin's own tab doesn't reload itself
  } catch {
    /* private mode */
  }
  return { at };
}

/** Everyone: watch for a new stamp and reload when one appears. Returns a stop function. */
export function watchForceRefresh(): () => void {
  let baseline: string | null | undefined;
  let stopped = false;

  const check = async () => {
    if (stopped) return;
    let stamp: string | null;
    try {
      stamp = await readStamp();
    } catch {
      return;
    }
    if (baseline === undefined) {
      baseline = stamp; // what was current when this page loaded
      return;
    }
    if (!stamp || stamp === baseline) return;
    baseline = stamp;
    let mine: string | null = null;
    try {
      mine = sessionStorage.getItem(SENT_BY_ME);
    } catch {
      /* ignore */
    }
    if (mine === stamp) return;
    await recoverFromStaleBuild(); // clears cached files and reloads from the network
  };

  void check();
  const timer = window.setInterval(check, POLL_MS);
  const onVisible = () => {
    if (document.visibilityState === "visible") void check();
  };
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    stopped = true;
    window.clearInterval(timer);
    document.removeEventListener("visibilitychange", onVisible);
  };
}
