import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { streamPath } from "@/lib/tvNavigation";
import metsLogo from "@/assets/metsxmfanzone-logo.png";

interface TVStreamOverlayProps {
  title: string;
  streamId?: string;
}

// Full-screen TV player overlay: logo, title and LIVE badge on top of the video, and a
// "More channels" row of the other live streams. Fades out after a few seconds; any remote
// button or mouse move brings it back.
export function TVStreamOverlay({ title, streamId }: TVStreamOverlayProps) {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(true);
  const timer = useRef<number>();

  const wake = () => {
    setVisible(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setVisible(false), 5000);
  };

  useEffect(() => {
    wake();
    window.addEventListener("keydown", wake);
    window.addEventListener("mousemove", wake);
    return () => {
      window.removeEventListener("keydown", wake);
      window.removeEventListener("mousemove", wake);
      window.clearTimeout(timer.current);
    };
  }, []);

  const { data: channels = [] } = useQuery({
    queryKey: ["tv-overlay-channels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("live_streams")
        .select("id, title, thumbnail_url")
        .eq("published", true)
        .eq("status", "live")
        .order("created_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });
  const others = channels.filter((c) => c.id !== streamId);

  return (
    <div
      className={`pointer-events-none absolute inset-0 z-30 transition-opacity duration-500 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      aria-hidden={!visible}
    >
      <div className="absolute inset-x-0 top-0 h-[28%] bg-gradient-to-b from-black/80 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-[42%] bg-gradient-to-t from-black/85 to-transparent" />

      <div className="absolute left-[3vw] top-[11vh] flex items-center gap-[1.6vw]">
        <img src={metsLogo} alt="" className="h-[9vh] w-auto" />
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-[#e11d48] px-4 py-1 text-[1rem] font-bold uppercase tracking-wider text-white">
            <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
            Live
          </span>
          <h2 className="mt-1 max-w-[60vw] text-[2.4rem] font-bold leading-tight text-white drop-shadow">{title}</h2>
        </div>
      </div>

      {others.length > 0 && (
        <div className="absolute bottom-[14vh] left-[3vw] right-[3vw]">
          <p className="mb-2 text-[1.2rem] font-medium text-white/80">More channels</p>
          <div className={`flex gap-[1vw] overflow-x-auto py-2 scrollbar-none ${visible ? "pointer-events-auto" : ""}`}>
            {others.map((c) => (
              <button
                key={c.id}
                type="button"
                tabIndex={visible ? 0 : -1}
                onClick={() => navigate(streamPath(c.title, c.id))}
                onFocus={(e) => e.currentTarget.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" })}
                className="group w-[16vw] min-w-[170px] shrink-0 rounded-xl text-left focus:outline-none"
              >
                <div className="aspect-video w-full overflow-hidden rounded-xl border border-white/10 bg-[#17263f]">
                  <img src={c.thumbnail_url || "/placeholder.svg"} alt="" className="h-full w-full object-cover" loading="lazy" />
                </div>
                <p className="mt-1 line-clamp-1 text-[1.05rem] font-medium text-white">{c.title}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
