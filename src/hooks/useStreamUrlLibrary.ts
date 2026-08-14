import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const STREAM_URL_LIBRARY_KEY = "stream_url_library";

export type StreamUrlEntry = {
  id: string;
  label: string;
  url: string;
};

const normalize = (value: unknown): StreamUrlEntry[] => {
  const v = (value || {}) as { urls?: unknown };
  if (!Array.isArray(v.urls)) return [];
  return (v.urls as StreamUrlEntry[])
    .filter((e) => e && typeof e.url === "string" && e.url.trim())
    .map((e) => ({
      id: e.id || crypto.randomUUID(),
      label: e.label?.trim() || e.url,
      url: e.url.trim(),
    }));
};

/**
 * Saved M3U8 source links admins can reuse when assigning a stream URL.
 * Stored in site_settings so no schema change is needed.
 */
export const useStreamUrlLibrary = () => {
  const [urls, setUrls] = useState<StreamUrlEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("site_settings")
        .select("setting_value")
        .eq("setting_key", STREAM_URL_LIBRARY_KEY)
        .maybeSingle();
      setUrls(normalize(data?.setting_value));
    } catch (e) {
      console.error("Failed to load stream URL library", e);
      setUrls([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const persist = useCallback(async (next: StreamUrlEntry[]) => {
    setUrls(next);
    const { error } = await supabase.from("site_settings").upsert(
      {
        setting_key: STREAM_URL_LIBRARY_KEY,
        setting_value: { urls: next } as unknown as never,
        is_public: false,
      },
      { onConflict: "setting_key" }
    );
    if (error) throw error;
  }, []);

  const addUrl = useCallback(
    async (label: string, url: string) => {
      const clean = url.trim();
      if (!clean) return;
      const existing = urls.find((u) => u.url === clean);
      if (existing) {
        await persist(
          urls.map((u) => (u.id === existing.id ? { ...u, label: label.trim() || u.label } : u))
        );
        return;
      }
      await persist([
        ...urls,
        { id: crypto.randomUUID(), label: label.trim() || clean, url: clean },
      ]);
    },
    [urls, persist]
  );

  const removeUrl = useCallback(
    async (id: string) => {
      await persist(urls.filter((u) => u.id !== id));
    },
    [urls, persist]
  );

  return { urls, loading, addUrl, removeUrl, reload: load };
};
