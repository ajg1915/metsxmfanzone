import * as NavMenu from "@radix-ui/react-navigation-menu";
import { Link, useLocation } from "react-router-dom";
import {
  ChevronDown,
  Tv,
  Radio,
  CalendarDays,
  Trophy,
  Users,
  Film,
  Newspaper,
  Landmark,
  MonitorPlay,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

// Desktop (≥1024px) top navigation. Dropdowns open on hover, click or keyboard
// (Radix NavigationMenu), stay open while the pointer moves into them, and
// close on Escape or an outside click.

type Go = (path: string) => void;

type Entry = {
  label: string;
  hint: string;
  icon: LucideIcon;
  to: string;
  /** "protected" = must be logged in, "pro" = paid Mets plan, else a plain link */
  gate?: "protected" | "pro";
  membersOnly?: boolean;
};

const WATCH: Entry[] = [
  { label: "MetsXMFanZone TV", hint: "Live shows, games and the 24/7 channel", icon: MonitorPlay, to: "/metsxmfanzone", gate: "pro" },
  { label: "Game Events", hint: "Live game events", icon: Trophy, to: "/game-events" },
  { label: "TV Guide", hint: "What's on and when", icon: CalendarDays, to: "/tv" },
  { label: "MSG Network", hint: "24/7 network stream", icon: Tv, to: "/msg-network" },
  { label: "ESPN Network", hint: "24/7 network stream", icon: Tv, to: "/espn-network" },
  { label: "MLB Network", hint: "24/7 network stream", icon: Radio, to: "/mlb-network" },
];

const METS: Entry[] = [
  { label: "Schedule", hint: "Every game, date and time", icon: CalendarDays, to: "/mets-schedule-2026", gate: "protected" },
  { label: "Scores", hint: "Live and final scores", icon: Trophy, to: "/mets-scores" },
  { label: "Roster", hint: "Players and stats", icon: Users, to: "/mets-roster", membersOnly: true },
  { label: "Highlights", hint: "Video clips and top plays", icon: Film, to: "/video-gallery", gate: "pro" },
  { label: "Game Recaps", hint: "Breakdowns of every game", icon: Newspaper, to: "/mets-game-recaps" },
  { label: "Mets History", hint: "Moments and legends", icon: Landmark, to: "/mets-history" },
];

const WATCH_PATHS = ["/metsxmfanzone", "/game-events", "/pix11-network", "/tv", "/msg-network", "/msg-plus", "/espn-network", "/mlb-network", "/live/"];
const METS_PATHS = ["/mets-schedule-2026", "/mets-scores", "/mets-roster", "/video-gallery", "/mets-game-recaps", "/mets-history", "/player/"];

const pill =
  "inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[14px] 2xl:px-3.5 font-semibold text-foreground/85 outline-none transition-colors hover:bg-white/[0.07] hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/70 data-[state=open]:bg-white/[0.07] data-[state=open]:text-foreground";
const activePill = "text-primary hover:text-primary data-[state=open]:text-primary";

const panel =
  "absolute left-1/2 top-full z-50 pt-2.5 data-[motion^=from-]:animate-in data-[motion^=to-]:animate-out data-[motion^=from-]:fade-in data-[motion^=to-]:fade-out data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95";
const card =
  "-translate-x-1/2 overflow-hidden rounded-2xl border border-white/10 bg-card/95 p-2 shadow-2xl shadow-black/50 ring-1 ring-black/20 backdrop-blur-xl";

function Row({ e, onGo }: { e: Entry; onGo: (e: Entry) => void }) {
  const Icon = e.icon;
  const body = (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20 transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <span className="min-w-0 text-left">
        <span className="block text-[14px] font-semibold leading-tight text-foreground">{e.label}</span>
        <span className="block truncate text-[12px] leading-snug text-muted-foreground">{e.hint}</span>
      </span>
    </>
  );
  const cls =
    "group flex w-full items-center gap-3 rounded-xl px-2.5 py-2 outline-none transition-colors hover:bg-white/[0.06] focus-visible:bg-white/[0.06]";
  return (
    <NavMenu.Link asChild>
      {e.gate ? (
        <button type="button" className={cls} onClick={() => onGo(e)}>
          {body}
        </button>
      ) : (
        <Link to={e.to} className={cls}>
          {body}
        </Link>
      )}
    </NavMenu.Link>
  );
}

function TopLink({ to, children, onClick }: { to: string; children: React.ReactNode; onClick?: () => void }) {
  const { pathname } = useLocation();
  const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
  return (
    <NavMenu.Item>
      <NavMenu.Link asChild active={active}>
        {onClick ? (
          <button type="button" onClick={onClick} className={cn(pill, active && activePill)}>
            {children}
          </button>
        ) : (
          <Link to={to} className={cn(pill, active && activePill)}>
            {children}
          </Link>
        )}
      </NavMenu.Link>
    </NavMenu.Item>
  );
}

export default function DesktopNavMenu({
  isLoggedIn,
  goProtected,
  goPro,
}: {
  isLoggedIn: boolean;
  goProtected: Go;
  goPro: Go;
}) {
  const { pathname } = useLocation();
  const on = (paths: string[]) => paths.some((p) => pathname.startsWith(p));
  const metsActive = on(METS_PATHS);

  const go = (e: Entry) => (e.gate === "pro" ? goPro(e.to) : goProtected(e.to));
  const mets = METS.filter((e) => !e.membersOnly || isLoggedIn);

  return (
    <NavMenu.Root delayDuration={60} skipDelayDuration={250} className="relative hidden lg:block" aria-label="Main">
      <NavMenu.List className="flex items-center gap-0.5 xl:gap-1">
        <TopLink to="/">Home</TopLink>

        <NavMenu.Item className="relative">
          <NavMenu.Trigger className={cn(pill, on(WATCH_PATHS) && activePill)}>
            <span className="relative mr-0.5 flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-60 motion-reduce:hidden" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
            </span>
            Watch Live
            <ChevronDown className="h-3.5 w-3.5 opacity-70 transition-transform duration-200 [[data-state=open]>&]:rotate-180" aria-hidden />
          </NavMenu.Trigger>
          <NavMenu.Content className={panel}>
            <div className={cn(card, "w-[320px]")}>
              {WATCH.map((e) => <Row key={e.label} e={e} onGo={go} />)}
            </div>
          </NavMenu.Content>
        </NavMenu.Item>

        <NavMenu.Item className="relative">
          <NavMenu.Trigger className={cn(pill, metsActive && activePill)}>
            Mets
            <ChevronDown className="h-3.5 w-3.5 opacity-70 transition-transform duration-200 [[data-state=open]>&]:rotate-180" aria-hidden />
          </NavMenu.Trigger>
          <NavMenu.Content className={panel}>
            <div className={cn(card, "w-[320px]")}>
              {mets.map((e) => <Row key={e.label} e={e} onGo={go} />)}
            </div>
          </NavMenu.Content>
        </NavMenu.Item>

        <TopLink to="/community" onClick={() => goProtected("/community")}>Community</TopLink>
        <TopLink to="/podcast">Podcast</TopLink>
        <TopLink to="/blog">Blog</TopLink>
        {!isLoggedIn && <TopLink to="/pricing">Pricing</TopLink>}
      </NavMenu.List>
    </NavMenu.Root>
  );
}
