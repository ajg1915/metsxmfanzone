import { useTikTokLive } from "@/hooks/useTikTokLive";
import { ExternalLink, Radio } from "lucide-react";

export const TikTokLiveBanner = () => {
  const { status } = useTikTokLive();

  if (!status?.is_live) return null;

  const username = status.tiktok_username || "metsxmfanzone";
  const url = `https://www.tiktok.com/@${username.replace(/^@/, "")}/live`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-xl border border-red-500/40 bg-gradient-to-r from-red-600/20 via-pink-500/15 to-red-600/20 backdrop-blur-sm p-3 sm:p-4 hover:border-red-500/70 transition-all group"
    >
      <div className="flex items-center gap-3">
        <div className="relative flex-shrink-0">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-red-500/20 flex items-center justify-center">
            <Radio className="w-5 h-5 sm:w-6 sm:h-6 text-red-400" />
          </div>
          <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-red-500 ring-2 ring-background animate-pulse" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold uppercase tracking-wider text-red-400">
              🔴 Live on TikTok
            </span>
          </div>
          <p className="text-sm sm:text-base font-semibold text-foreground truncate">
            {status.stream_title || `@${username} is live now`}
          </p>
        </div>
        <div className="flex-shrink-0 flex items-center gap-1 text-xs sm:text-sm font-medium text-red-300 group-hover:text-red-200">
          Watch <ExternalLink className="w-3.5 h-3.5" />
        </div>
      </div>
    </a>
  );
};
