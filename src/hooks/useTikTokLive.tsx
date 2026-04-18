import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TikTokLiveStatus {
  is_live: boolean;
  tiktok_username: string;
  stream_title: string | null;
  went_live_at: string | null;
}

export const useTikTokLive = () => {
  const [status, setStatus] = useState<TikTokLiveStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const fetchStatus = async () => {
      const { data } = await supabase
        .from("tiktok_live_status")
        .select("is_live, tiktok_username, stream_title, went_live_at")
        .eq("id", 1)
        .maybeSingle();
      if (mounted) {
        setStatus(data ?? null);
        setLoading(false);
      }
    };

    fetchStatus();

    const channel = supabase
      .channel("tiktok-live-status")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tiktok_live_status" },
        (payload) => {
          if (mounted && payload.new) {
            setStatus(payload.new as TikTokLiveStatus);
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return { status, loading };
};
