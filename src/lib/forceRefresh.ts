import { supabase } from "@/integrations/supabase/client";
import { recoverFromStaleBuild } from "@/utils/staleBuildRecovery";

// Admin "Clear cache" controls. An admin stamps site_settings.force_refresh with the time and a scope;
// every open copy of the site (browser, phone app, TV app) notices the new stamp:
//  - scope "site":    clear cached files and reload the newest version of MetsXMFanZone
//  - scope "streams": reload just the live streams (players and stream lists), no page reload
export const FORCE_REFRESH_KEY = "force_refresh";
export const STREAMS_REFRESH_EVENT = "mxf:refresh-streams";
export type RefreshScope = "site" | "streams";

const SENT_BY_ME = "force_refresh_sent_at";
const POLL_MS = 60_000;

type Stamp = { at?: string; scope?: RefreshScope } | null;

async function readStamp(): Promise<Stamp> {
  const { data } = await supabase
    .from("site_settings")
    .select("setting_value")
    .eq("setting_key", FORCE_REFRESH_KEY)
    .maybeSingle();
  return (data?.setting_value as Stamp) ?? null;
}

/** Reload the live streams on this device: players restart and stream lists refetch. */
export function refreshStreamsHere() {
  window.dispatchEvent(new Event(STREAMS_REFRESH_EVENT));
}

/** Admin action: tell every open copy of the site to refresh. */
export async function sendForceRefresh(scope: RefreshScope = "site"): Promise<{ error?: string; at?: string }> {
  const at = new Date().toISOString();
  const { error } = await supabase.from("site_settings").upsert(
    { setting_key: FORCE_REFRESH_KEY, setting_value: { at, scope } as never, setting_type: "general", is_public: true },
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

/** Clear this device's cached files and reload (used for the admin's own screen). */
export const clearCacheHere = () => recoverFromStaleBuild();

/** Everyone: watch for a new stamp and act on it. Returns a stop function. */
export function watchForceRefresh(): () => void {
  let baseline: string | null | undefined;
  let stopped = false;

  const check = async () => {
    if (stopped) return;
    let stamp: Stamp;
    try {
      stamp = await readStamp();
    } catch {
      return;
    }
    const at = stamp?.at ?? null;
    if (baseline === undefined) {
      baseline = at; // what was current when this page loaded
      return;
    }
    if (!at || at === baseline) return;
    baseline = at;
    let mine: string | null = null;
    try {
      mine = sessionStorage.getItem(SENT_BY_ME);
    } catch {
      /* ignore */
    }
    if (mine === at) return;
    if (stamp?.scope === "streams") refreshStreamsHere();
    else await recoverFromStaleBuild(); // clears cached files and reloads from the network
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
