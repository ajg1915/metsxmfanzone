import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StreamAlertBanner } from "./StreamAlertBanner";
import { NewPostAlert } from "./NewPostAlert";
import ClapprPlayer from "./ClapprPlayer";
import { getNYTeamStreamUrl } from "@/lib/nyTeamStreamCheck";

interface LiveStream {
  id: string;
  title: string;
  description: string;
  stream_url: string;
  thumbnail_url: string;
  status: 'live' | 'scheduled' | 'ended';
  assigned_pages?: string[] | null;
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
      // Signed-out visitors cannot read the protected stream URL directly.
      // Ask the server first so admin-selected free games can play immediately.
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        const { data: guest, error: guestError } = await supabase.functions.invoke("guest-stream-access", {
          body: { pageKey: pageName },
        });

        if (guest?.stream?.stream_url) {
          setStream(guest.stream as LiveStream);
          return;
        }

        if (guestError) {
          console.warn("Free preview is unavailable");
        }
        setStream(null);
        return;
      }

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

      if (data) {
        const liveStream = data as LiveStream;
        // NY team events always play the shared secondary link, even when the
        // stream row has no URL saved yet.
        liveStream.stream_url = getNYTeamStreamUrl(liveStream);
        setStream(liveStream);
        return;
      }

      setStream(null);
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
        <p className="text-muted-foreground">Stream unavailable</p>
        <p className="text-sm text-muted-foreground mt-2">Stream will be available 30 minutes before game time.</p>
      </div>
    );
  }

  return (
    <div className="mb-8 space-y-4">
      <StreamAlertBanner streamId={stream.id} />
      <div className="stream-player-shell relative overflow-hidden bg-player sm:rounded-lg">
        <NewPostAlert />
        <ClapprPlayer
          source={stream.stream_url}
          showChrome
          pageTitle={stream.title || pageTitle}
          pageDescription={stream.description || pageDescription}
          streamId={stream.id}
        />
      </div>
    </div>
  );
}
