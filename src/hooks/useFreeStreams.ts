import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const FREE_STREAMS_SETTING_KEY = "free_streams";

/**
 * Streams (games) an admin has marked as "free for everyone".
 * Stored in site_settings as { ids: string[], pages: string[] } so no schema change is needed.
 */
export type FreeStreamsConfig = {
  ids: string[];
  pages: string[];
};

export const DEFAULT_FREE_STREAMS: FreeStreamsConfig = { ids: [], pages: [] };

const normalize = (value: unknown): FreeStreamsConfig => {
  const v = (value || {}) as Partial<FreeStreamsConfig>;
  return {
    ids: Array.isArray(v.ids) ? v.ids.filter(Boolean) : [],
    pages: Array.isArray(v.pages) ? v.pages.filter(Boolean) : [],
  };
};

export const useFreeStreams = () => {
  const [config, setConfig] = useState<FreeStreamsConfig>(DEFAULT_FREE_STREAMS);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("site_settings")
        .select("setting_value")
        .eq("setting_key", FREE_STREAMS_SETTING_KEY)
        .maybeSingle();
      setConfig(normalize(data?.setting_value));
    } catch (e) {
      console.error("Failed to load free streams config", e);
      setConfig(DEFAULT_FREE_STREAMS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = useCallback(async (next: FreeStreamsConfig) => {
    setConfig(next);
    const { error } = await supabase
      .from("site_settings")
      .upsert(
        {
          setting_key: FREE_STREAMS_SETTING_KEY,
          setting_value: next as unknown as never,
        },
        { onConflict: "setting_key" }
      );
    if (error) throw error;
  }, []);

  const isFree = useCallback(
    (streamId?: string | null, pageKey?: string | null) =>
      (!!streamId && config.ids.includes(streamId)) ||
      (!!pageKey && config.pages.includes(pageKey)),
    [config]
  );

  const toggleStream = useCallback(
    async (streamId: string, free: boolean) => {
      const ids = free
        ? Array.from(new Set([...config.ids, streamId]))
        : config.ids.filter((id) => id !== streamId);
      await save({ ...config, ids });
    },
    [config, save]
  );

  return { config, loading, isFree, toggleStream, save, reload: load };
};
