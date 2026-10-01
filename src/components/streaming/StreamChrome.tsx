import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Signal, Tv } from "lucide-react";

export type StreamBrand = { from: string; to: string; accent: string };

export const METS_BRAND: StreamBrand = { from: "#0b3e75", to: "#0a2d5c", accent: "#ff5a1f" };

// Every stream page links to its siblings so people can flip channels.
export const CHANNELS: { label: string; to: string; key: string }[] = [
  { label: "MetsXMFanZone TV", to: "/metsxmfanzone", key: "metsxmfanzone" },
  { label: "MLB Network", to: "/mlb-network", key: "mlb-network" },
  { label: "ESPN", to: "/espn-network", key: "espn-network" },
  { label: "MSG", to: "/msg-network", key: "msg-network" },
  { label: "MSG+", to: "/msg-plus", key: "msg-plus" },
  { label: "Game Events", to: "/pix11-network", key: "pix11-network" },
  { label: "Spring Training", to: "/spring-training-live", key: "spring-training-live" },
];

/** Brand header that sits right above the player on every stream page. */
export const StreamBrandHeader = ({
  brand, mark, title, titleAccent, badges, action,
}: {
  brand: StreamBrand;
  mark: ReactNode;
  title: string;
  titleAccent?: string;
  badges: [ReactNode, ReactNode];
  action?: ReactNode;
}) => (
  <div className="relative overflow-hidden" style={{ backgroundImage: `linear-gradient(135deg, ${brand.from} 0%, ${brand.to} 55%, hsl(var(--background)) 100%)` }}>
    <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl" style={{ background: brand.accent, opacity: 0.18 }} aria-hidden="true" />
    <div className="container mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:gap-5 sm:py-6">
      <div
        className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl text-center shadow-lg sm:h-24 sm:w-24 sm:rounded-2xl"
        style={{ backgroundImage: `linear-gradient(135deg, ${brand.from}, ${brand.to})`, boxShadow: `0 8px 24px ${brand.accent}33`, border: "1px solid rgba(255,255,255,0.18)" }}
      >
        {mark}
      </div>
      <div className="min-w-0 flex-1">
        <h1 className="font-display text-[30px] font-bold uppercase leading-none tracking-wide text-white sm:text-5xl max-sm:line-clamp-2">
          {title} {titleAccent && <span style={{ color: brand.accent }}>{titleAccent}</span>}
        </h1>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">{badges.map((b, i) => (
          <span key={i} className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold text-white">{b}</span>
        ))}</div>
      </div>
      {action}
    </div>
  </div>
);

export const DefaultBadges: [ReactNode, ReactNode] = [
  <><Signal className="h-3 w-3" /> HD Quality</>,
  <><Tv className="h-3 w-3" /> MetsXMFanZone</>,
];

export const ChannelSwitcher = ({ activeKey, brand = METS_BRAND, className = "mt-5" }: { activeKey?: string; brand?: StreamBrand; className?: string }) => (
  <nav aria-label="Switch channel" className={className}>
    <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.18em]" style={{ color: brand.accent }}>Switch channel</p>
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-hide md:mx-0 md:px-0">
      {CHANNELS.map((c) => {
        const active = c.key === activeKey;
        return (
          <Link
            key={c.key}
            to={c.to}
            aria-current={active ? "page" : undefined}
            className={`flex h-11 shrink-0 items-center rounded-full border px-4 text-sm font-bold transition-colors ${
              active ? "border-white/40 text-white" : "border-border/60 bg-card text-foreground hover:border-primary/50"
            }`}
            style={active ? { background: `linear-gradient(135deg, ${brand.from}, ${brand.to})` } : undefined}
          >
            {c.label}
          </Link>
        );
      })}
    </div>
  </nav>
);
