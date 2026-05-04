import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StreamAlertBanner } from "./StreamAlertBanner";
import { Cast } from "lucide-react";
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
      <Card className="mb-8">
        <CardContent className="py-12 text-center">Loading stream...</CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="text-lg">{pageTitle}</CardTitle>
        <CardDescription>{pageDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        {stream ? (
          <div className="space-y-4">
            <StreamAlertBanner streamId={stream.id} />
            <ClapprPlayer
              source={stream.stream_url}
              showChrome={false}
              pageTitle={stream.title}
              pageDescription={stream.description || pageDescription}
            />
            <div className="flex items-center justify-between">
              {stream.description && <p className="text-muted-foreground">{stream.description}</p>}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Cast className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Cast via the button above, AirPlay, or Chrome cast menu</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No live stream available at the moment.</p>
            <p className="text-sm text-muted-foreground mt-2">Check back later for live content.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
