import { supabase } from "@/integrations/supabase/client";

/** Admin switch (Live Streams page): ping live game events to every device. Stored in the existing site_settings table. */
export const LIVE_PING_KEY = "live_event_ping";

export async function fetchLivePingEnabled(): Promise<boolean> {
  try {
    const { data } = await supabase.from("site_settings").select("setting_value").eq("setting_key", LIVE_PING_KEY).maybeSingle();
    const v = data?.setting_value as { enabled?: boolean } | null | undefined;
    return v?.enabled !== false; // on unless the admin turned it off
  } catch {
    return true;
  }
}

export async function saveLivePingEnabled(enabled: boolean) {
  return supabase.from("site_settings").upsert({ setting_key: LIVE_PING_KEY, setting_value: { enabled }, is_public: true } as never, { onConflict: "setting_key" });
}
