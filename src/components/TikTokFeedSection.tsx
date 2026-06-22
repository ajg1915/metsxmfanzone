import { ExternalLink } from "lucide-react";

const USERNAME = "onbmedia";
const PROFILE_URL = `https://www.tiktok.com/@${USERNAME}`;
const EMBED_URL = `https://www.tiktok.com/embed/@${USERNAME}`;

const TikTokFeedSection = () => {
  return (
    <section className="py-8 px-4">
      <div className="container mx-auto max-w-7xl">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="text-xl md:text-2xl font-bold text-foreground">
            Latest posts from <span className="text-primary">@{USERNAME}</span>
          </h2>
          <a
            href={PROFILE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-[#ff0050] to-[#00f2ea] text-white text-sm font-semibold hover:opacity-90 transition shadow-md"
          >
            Follow on TikTok
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>

        <div className="rounded-2xl overflow-hidden bg-card/90 backdrop-blur border border-border">
          <iframe
            src={EMBED_URL}
            title={`TikTok feed for @${USERNAME}`}
            loading="lazy"
            allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="w-full h-[720px] md:h-[780px] bg-background"
          />
        </div>

        <p className="text-xs text-muted-foreground mt-2 text-center">
          Latest videos from{" "}
          <a
            href={PROFILE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            @{USERNAME}
          </a>{" "}
          on TikTok — updated automatically.
        </p>
      </div>
    </section>
  );
};

export default TikTokFeedSection;
