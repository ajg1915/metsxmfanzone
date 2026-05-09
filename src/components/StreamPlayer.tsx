import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StreamAlertBanner } from "./StreamAlertBanner";
import ClapprPlayer from "./ClapprPlayer";

interface LiveStream {
  id: string;
  title: string;
  description: string;
  stream_url: string;
  thumbnail_url: string;
  status: 'live' | 'scheduled' | 'ended';
}

interface StreamPlayerProps {
  pageName: string;
  pageTitle: string;
  pageDescription: string;
}

export function StreamPlayer({ pageName, pageTitle, pageDescription }: StreamPlayerProps) {
  const [stream, setStream] = useState<LiveStream | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStream();

    const channel = supabase.channel(`${pageName}-stream-changes`).on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'live_streams'
    }, () => {
      console.log('Stream updated, refetching...');
      fetchStream();
    }).subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pageName]);

  const fetchStream = async () => {
    try {
      const streamIdMatch = pageName.match(/^stream-(.+)$/);
      let query = supabase
        .from("live_streams")
        .select("*")
        .eq("published", true)
        .eq("status", "live");

      if (streamIdMatch) {
        query = query.eq("id", streamIdMatch[1]);
      } else {
        query = query.contains("assigned_pages", [pageName]);
      }

      const { data, error } = await query
        .order("scheduled_start", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setStream(data as LiveStream | null);
    } catch (error) {
      console.error("Error fetching stream:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="mb-8 py-12 text-center text-muted-foreground">Loading stream...</div>
    );
  }

  if (!stream) {
    return (
      <div className="mb-8 text-center py-12 rounded-lg border border-border bg-card">
        <p className="text-muted-foreground">No live stream available at the moment.</p>
        <p className="text-sm text-muted-foreground mt-2">Check back later for live content.</p>
      </div>
    );
  }

  return (
    <div className="mb-8 space-y-4">
      <StreamAlertBanner streamId={stream.id} />
      <ClapprPlayer
        source={stream.stream_url}
        showChrome
        pageTitle={stream.title || pageTitle}
        pageDescription={stream.description || pageDescription}
      />
    </div>
  );
}
