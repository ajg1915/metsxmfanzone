import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import videojs from "video.js";
import "video.js/dist/video-js.css";
import { StreamAlertBanner } from "./StreamAlertBanner";
import { Cast, Tv } from "lucide-react";

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

export function StreamPlayer({
  pageName,
  pageTitle,
  pageDescription
}: StreamPlayerProps) {
  const [stream, setStream] = useState<LiveStream | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [showUnmuteBanner, setShowUnmuteBanner] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [isCasting, setIsCasting] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<any>(null);

  // Initialize Chromecast
  useEffect(() => {
    const initChromecast = () => {
      const cast = (window as any).cast;
      const chrome = (window as any).chrome;
      if (!cast || !chrome?.cast) return;

      const sessionRequest = new chrome.cast.SessionRequest(
        chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID
      );
      const apiConfig = new chrome.cast.ApiConfig(
        sessionRequest,
        (session: any) => {
          console.log("[Cast] Session established");
          setIsCasting(true);
        },
        (availability: string) => {
          console.log("[Cast] Receiver availability:", availability);
        }
      );
      chrome.cast.initialize(apiConfig,
        () => console.log("[Cast] Initialized"),
        (err: any) => console.warn("[Cast] Init error:", err)
      );
    };

    (window as any).__onGCastApiAvailable = (isAvailable: boolean) => {
      if (isAvailable) initChromecast();
    };
    if ((window as any).chrome?.cast) initChromecast();
  }, []);

  const startCasting = () => {
    const chrome = (window as any).chrome;
    if (!chrome?.cast) {
      alert("Chromecast is not available. Make sure you have a Chromecast device on your network.");
      return;
    }
    const streamUrl = stream?.stream_url;
    if (!streamUrl) return;

    chrome.cast.requestSession(
      (session: any) => {
        setIsCasting(true);
        const mediaInfo = new chrome.cast.media.MediaInfo(streamUrl, "application/x-mpegURL");
        const request = new chrome.cast.media.LoadRequest(mediaInfo);
        session.loadMedia(request,
          () => console.log("[Cast] Media loaded"),
          (err: any) => console.error("[Cast] Media load error:", err)
        );
      },
      (err: any) => {
        if (err.code !== "cancel") console.error("[Cast] Request error:", err);
      }
    );
  };

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
      if (playerRef.current) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, [pageName]);

  const supportsNativeHLS = () => {
    const video = document.createElement('video');
    return video.canPlayType('application/vnd.apple.mpegurl') !== '';
  };

  const disposePlayer = () => {
    if (playerRef.current) {
      playerRef.current.dispose();
      playerRef.current = null;
      setPlayerReady(false);
    }
  };

  useEffect(() => {
    return () => { disposePlayer(); };
  }, [pageName]);

  // Initialize Video.js player when stream changes
  useEffect(() => {
    if (stream && videoRef.current && !playerRef.current) {
      const useNativeHLS = supportsNativeHLS();
      console.log('Initializing Video.js player for:', stream.stream_url, '| Native HLS:', useNativeHLS);

      playerRef.current = videojs(videoRef.current, {
        controls: true,
        autoplay: 'any',
        muted: false,
        preload: 'auto',
        fluid: true,
        liveui: true,
        playsinline: true,
        controlBar: {
          fullscreenToggle: true
        },
        html5: {
          vhs: {
            overrideNative: !useNativeHLS,
            fastQualityChange: true,
            handlePartialData: true,
            maxPlaylistRetries: 5,
            smoothQualityChange: false,
            allowSeeksWithinUnsafeLiveWindow: true,
            useNetworkInformationApi: false,
            ...(useNativeHLS ? {} : {
              bandwidth: 3000000,
              enableLowInitialPlaylist: true,
            }),
          },
          nativeVideoTracks: useNativeHLS,
          nativeAudioTracks: useNativeHLS,
          nativeTextTracks: useNativeHLS
        },
        liveTracker: {
          trackingThreshold: 1,
          liveTolerance: 20,
        },
        sources: [{
          src: stream.stream_url,
          type: 'application/x-mpegURL'
        }]
      });

      playerRef.current.ready(() => {
        console.log('Video.js player is ready');
        setPlayerReady(true);

        const p = playerRef.current;
        if (p.muted()) {
          setIsMuted(true);
          setShowUnmuteBanner(true);
        } else {
          setIsMuted(false);
          setShowUnmuteBanner(false);
        }

        // Auto-seek to live edge
        const liveEdgeInterval = setInterval(() => {
          const p = playerRef.current;
          if (!p || p.paused() || !p.liveTracker?.isLive?.()) return;
          const behindLive = p.liveTracker.liveCurrentTime() - p.currentTime();
          if (behindLive > 30) {
            console.log(`[StreamPlayer] ${Math.round(behindLive)}s behind live, seeking to edge`);
            p.liveTracker.seekToLiveEdge();
          }
        }, 10000);

        playerRef.current.on('dispose', () => clearInterval(liveEdgeInterval));
      });

      // Capped retry with exponential backoff
      let retryCount = 0;
      const MAX_RETRIES = 3;
      playerRef.current.on('error', (e: any) => {
        console.error('Video.js error:', e);
        const error = playerRef.current?.error();
        if (error && retryCount < MAX_RETRIES) {
          retryCount++;
          const delay = Math.min(2000 * Math.pow(2, retryCount - 1), 16000);
          console.log(`Retry ${retryCount}/${MAX_RETRIES} in ${delay}ms`);
          setTimeout(() => {
            if (playerRef.current && stream) {
              playerRef.current.src({ src: stream.stream_url, type: 'application/x-mpegURL' });
              playerRef.current.play();
            }
          }, delay);
        } else if (retryCount >= MAX_RETRIES) {
          console.error('Max retries reached, stopping.');
        }
      });
    }

    return () => { disposePlayer(); };
  }, [stream]);

  const toggleMute = () => {
    if (playerRef.current) {
      const newMutedState = !isMuted;
      playerRef.current.muted(newMutedState);
      setIsMuted(newMutedState);
      if (!newMutedState) {
        setShowUnmuteBanner(false);
        const playPromise = playerRef.current.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(() => {
            console.log('Play after unmute failed, retrying muted');
            playerRef.current.muted(true);
            setIsMuted(true);
            playerRef.current.play();
          });
        }
      }
    }
  };

  const fetchStream = async () => {
    try {
      // Support direct stream ID lookup for dynamic pages (stream-<uuid>)
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
        <CardContent className="py-12 text-center">
          Loading stream...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-8">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-lg">{pageTitle}</CardTitle>
          <CardDescription>{pageDescription}</CardDescription>
        </div>
        {stream && (
          <button
            onClick={startCasting}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-colors text-sm font-medium"
            title="Cast to TV"
          >
            {isCasting ? <Tv className="w-4 h-4" /> : <Cast className="w-4 h-4" />}
            <span className="hidden sm:inline">{isCasting ? "Casting" : "Cast"}</span>
          </button>
        )}
      </CardHeader>
      <CardContent>
        {stream ? (
          <div className="space-y-4">
            <StreamAlertBanner streamId={stream.id} />
            
            {isMuted && showUnmuteBanner && (
              <div 
                className="bg-primary/20 border-2 border-primary rounded-lg p-4 text-center cursor-pointer"
                onClick={toggleMute}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && toggleMute()}
              >
                <p className="sm:text-base mb-2 text-xs font-sans font-extralight text-center">🔊 Tap here to turn on audio</p>
                <p className="text-xs sm:text-sm text-muted-foreground">Stream is muted by default for autoplay</p>
              </div>
            )}
            <div className="relative aspect-video bg-black rounded-lg overflow-hidden landscape:fixed landscape:inset-0 landscape:z-50 landscape:rounded-none landscape:aspect-auto landscape:max-h-none landscape:w-full landscape:h-full sm:landscape:relative sm:landscape:inset-auto sm:landscape:z-auto sm:landscape:rounded-lg sm:landscape:aspect-video sm:landscape:h-auto">
              <video 
                ref={videoRef} 
                className="video-js vjs-big-play-centered vjs-theme-fantasy" 
                playsInline
                // @ts-ignore - webkit AirPlay attribute
                x-webkit-airplay="allow"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
              />
            </div>
            <div className="flex items-center justify-between">
              {stream.description && <p className="text-muted-foreground">{stream.description}</p>}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Cast className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Cast to TV via button above, AirPlay, or Chrome cast menu</span>
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
