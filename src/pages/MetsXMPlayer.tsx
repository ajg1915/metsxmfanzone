import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Hls from "hls.js";
import { supabase } from "@/integrations/supabase/client";
import { toSecureStreamUrl, toCorsProxyUrl, isInsecureUrl } from "@/lib/streamProxy";

// Proxied through Lovable Cloud so HTTPS pages can play the HTTP origin without mixed-content blocking.
const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const DEFAULT_STREAM_URL = `https://${PROJECT_ID}.supabase.co/functions/v1/hls-proxy/hls/metsxmfanzone.m3u8`;


export default function MetsXMPlayer() {
  const [params] = useSearchParams();
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<any>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(params.get("src") || DEFAULT_STREAM_URL);
  const [title, setTitle] = useState("MetsXMFanZone Live");
  const [description, setDescription] = useState("Watch the Mets game live!");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  // Fetch stream from DB if no src param
  useEffect(() => {
    if (streamUrl) return;
    (async () => {
      const { data } = await supabase
        .from("live_streams")
        .select("stream_url, title, description")
        .eq("published", true)
        .eq("status", "live")
        .order("scheduled_start", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.stream_url) {
        setStreamUrl(data.stream_url);
        if (data.title) setTitle(data.title);
        if (data.description) setDescription(data.description);
      } else {
        setStatus("error");
        setErrorMsg("No live stream is currently available.");
      }
    })();
  }, [streamUrl]);

  // Attach HLS
  useEffect(() => {
    if (!streamUrl || !videoRef.current) return;
    const video = videoRef.current;
    let destroyed = false;

    // Try our HTTPS proxy first, then a public CORS proxy, then the raw URL.
    const candidates = Array.from(
      new Set(
        [
          toSecureStreamUrl(streamUrl),
          isInsecureUrl(streamUrl) ? toCorsProxyUrl(streamUrl) : "",
          streamUrl,
        ].filter(Boolean)
      )
    );

    let index = 0;
    let mediaRecoveries = 0;
    let networkRetries = 0;

    const fail = (msg: string) => {
      if (destroyed) return;
      index += 1;
      if (index < candidates.length) {
        load();
      } else {
        setStatus("error");
        setErrorMsg(msg);
      }
    };

    const load = () => {
      if (destroyed) return;
      const url = candidates[index];
      setStatus("loading");

      if (hlsRef.current) {
        try { hlsRef.current.destroy(); } catch {}
        hlsRef.current = null;
      }

      // Safari / iOS native HLS
      if (!Hls.isSupported() && video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = url;
        video.addEventListener("loadedmetadata", () => {
          if (!destroyed) setStatus("ready");
        }, { once: true });
        video.addEventListener("error", () => fail("Playback error"), { once: true });
        video.play().catch(() => {});
        return;
      }

      if (!Hls.isSupported()) {
        setStatus("error");
        setErrorMsg("HLS is not supported in this browser.");
        return;
      }

      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        liveDurationInfinity: true,
        backBufferLength: 10,
        manifestLoadingMaxRetry: 3,
        fragLoadingMaxRetry: 6,
      });
      hlsRef.current = hls;
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (destroyed) return;
        mediaRecoveries = 0;
        networkRetries = 0;
        setStatus("ready");
        video.play().catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (_evt, data) => {
        if (!data?.fatal || destroyed) return;

        if (data.type === Hls.ErrorTypes.MEDIA_ERROR && mediaRecoveries < 3) {
          mediaRecoveries += 1;
          try {
            if (mediaRecoveries > 1) hls.swapAudioCodec();
            hls.recoverMediaError();
            return;
          } catch {}
        }

        if (data.type === Hls.ErrorTypes.NETWORK_ERROR && networkRetries < 3) {
          networkRetries += 1;
          try {
            hls.startLoad();
            return;
          } catch {}
        }

        fail(data.details || "Playback error");
      });
    };

    load();

    return () => {
      destroyed = true;
      if (hlsRef.current) {
        try { hlsRef.current.destroy(); } catch {}
        hlsRef.current = null;
      }
      try { video.removeAttribute("src"); video.load(); } catch {}
    };
  }, [streamUrl]);


  const play = () => videoRef.current?.play();
  const pause = () => videoRef.current?.pause();
  const fullscreen = () => videoRef.current?.requestFullscreen?.();
  const copyUrl = () => {
    if (streamUrl) navigator.clipboard.writeText(streamUrl);
  };

  return (
    <div style={{ background: "#0a0e27", minHeight: "100vh", padding: 20, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ position: "relative", width: "100%", background: "#000", borderRadius: 12, overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
          <video
            ref={videoRef}
            controls
            autoPlay
            muted
            playsInline
            style={{ width: "100%", height: "auto", display: "block", background: "#000", aspectRatio: "16 / 9" }}
          >
            Your browser does not support HLS playback.
          </video>
        </div>

        <div style={{ background: "#1a1f3a", padding: 20, color: "#fff", borderRadius: "0 0 12px 12px", marginTop: -4 }}>
          <div style={{ fontSize: 24, fontWeight: "bold", marginBottom: 8, color: "#ff6b35" }}>
            🔴 {title}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
            <span
              style={{
                width: 12,
                height: 12,
                background: status === "ready" ? "#00ff00" : status === "error" ? "#ff3b30" : "#ffaa00",
                borderRadius: "50%",
                display: "inline-block",
                animation: "mxpulse 1s infinite",
              }}
            />
            {status === "ready" ? "LIVE NOW" : status === "error" ? "OFFLINE" : "CONNECTING…"}
          </div>
          <div style={{ marginTop: 12, color: "#b0b0b0", fontSize: 14 }}>
            {status === "error" && errorMsg ? errorMsg : description}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 15, flexWrap: "wrap" }}>
            <button onClick={play} style={btnStyle}>▶ Play</button>
            <button onClick={pause} style={btnStyle}>⏸ Pause</button>
            <button onClick={fullscreen} style={btnStyle}>⛶ Fullscreen</button>
            <button onClick={copyUrl} style={btnStyle} disabled={!streamUrl}>📋 Copy Stream URL</button>
          </div>
        </div>
      </div>
      <style>{`@keyframes mxpulse { 0%,100% { opacity:1 } 50% { opacity:0.5 } }`}</style>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "10px 20px",
  background: "#ff6b35",
  color: "white",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 600,
};
