import { Facebook, Instagram, Youtube } from "lucide-react";
import type { ComponentType } from "react";

type IconProps = { className?: string };

const TikTokIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.71a8.21 8.21 0 0 0 4.76 1.51v-3.45a4.85 4.85 0 0 1-1-.08z" />
  </svg>
);

const XIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.66l-5.21-6.82-5.97 6.82H1.67l7.73-8.84L1.25 2.25h6.83l4.71 6.23 5.45-6.23zm-1.16 17.52h1.83L7.08 4.13H5.12l11.96 15.64z" />
  </svg>
);

type SocialLink = {
  name: string;
  handle: string;
  url: string;
  Icon: ComponentType<IconProps>;
  tile: string;
};

// Every official MetsXMFanZone account.
export const METSXMFANZONE_SOCIALS: SocialLink[] = [
  {
    name: "TikTok",
    handle: "@metsxmfanzone",
    url: "https://www.tiktok.com/@metsxmfanzone",
    Icon: TikTokIcon,
    tile: "bg-zinc-900 hover:bg-zinc-800",
  },
  {
    name: "Instagram",
    handle: "@metsxmfanzone",
    url: "https://www.instagram.com/metsxmfanzone",
    Icon: Instagram,
    tile: "bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 hover:brightness-110",
  },
  {
    name: "Facebook",
    handle: "@metsxmfanzoneofficial",
    url: "https://www.facebook.com/metsxmfanzoneofficial",
    Icon: Facebook,
    tile: "bg-[#1877F2] hover:brightness-110",
  },
  {
    name: "YouTube",
    handle: "@metsxmfanzone",
    url: "https://www.youtube.com/@metsxmfanzone",
    Icon: Youtube,
    tile: "bg-[#E62117] hover:brightness-110",
  },
  {
    name: "X",
    handle: "@metsxmfanzone",
    url: "https://x.com/metsxmfanzone",
    Icon: XIcon,
    tile: "bg-black hover:bg-zinc-900",
  },
];

/** "Follow MetsXMFanZone" block shown on every live stream page. */
const SocialLinksSection = ({ className = "" }: { className?: string }) => (
  <section aria-labelledby="follow-metsxmfanzone" className={`container mx-auto px-3 sm:px-4 py-6 ${className}`}>
    <div className="rounded-xl border border-border/60 bg-card/80 backdrop-blur-xl p-4 sm:p-5">
      <h2 id="follow-metsxmfanzone" className="text-base sm:text-lg font-bold text-foreground">
        Follow MetsXMFanZone
      </h2>
      <p className="text-xs sm:text-sm text-muted-foreground mt-1 mb-4">
        Clips, live alerts and behind-the-scenes on every platform.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
        {METSXMFANZONE_SOCIALS.map(({ name, handle, url, Icon, tile }) => (
          <a
            key={name}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`MetsXMFanZone on ${name}`}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-3 text-white transition ${tile}`}
          >
            <Icon className="w-5 h-5 shrink-0" />
            <span className="min-w-0">
              <span className="block text-sm font-semibold leading-tight">{name}</span>
              <span className="block text-[11px] opacity-80 truncate">{handle}</span>
            </span>
          </a>
        ))}
      </div>
    </div>
  </section>
);

export default SocialLinksSection;
