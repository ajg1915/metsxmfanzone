import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Radio } from "lucide-react";
import { useNavigate } from "react-router-dom";

/**
 * LiveStreamToast — checks for currently live streams on mount only.
 * Realtime notifications are handled by the consolidated notification system.
 * No additional realtime channels are created here.
 */
export const LiveStreamToast = () => {
  const navigate = useNavigate();
  const hasChecked = useRef(false);

  useEffect(() => {
    if (hasChecked.current) return;
    hasChecked.current = true;

    // Defer check to avoid blocking initial render
    const timer = setTimeout(async () => {
      try {
        const { data: liveStreams } = await supabase
          .from('live_streams')
          .select('id, title')
          .eq('status', 'live')
          .eq('published', true)
          .limit(1);

        if (liveStreams && liveStreams.length > 0) {
          const stream = liveStreams[0];
          toast({
            title: (
              <div className="flex items-center gap-2">
                <Radio className="h-4 w-4 text-red-500 animate-pulse" />
                <span>MetsXMFanZone.TV Live Streaming</span>
              </div>
            ) as any,
            description: stream.title || "A live stream is happening now!",
            action: (
              <button
                onClick={() => navigate('/metsxmfanzone')}
                className="bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Watch Now
              </button>
            ),
            duration: 10000,
          });
        }

        const { data: podcastLive } = await supabase
          .from('podcast_live_stream')
          .select('is_live, title')
          .maybeSingle();

        if (podcastLive?.is_live) {
          toast({
            title: (
              <div className="flex items-center gap-2">
                <Radio className="h-4 w-4 text-red-500 animate-pulse" />
                <span>Podcast is Live!</span>
              </div>
            ) as any,
            description: podcastLive.title || "The podcast is live now!",
            action: (
              <button
                onClick={() => navigate('/podcast')}
                className="bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Listen Now
              </button>
            ),
            duration: 10000,
          });
        }
      } catch {
        // Silent fail
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return null;
};
