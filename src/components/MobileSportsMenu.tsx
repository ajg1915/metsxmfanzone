import { toast } from "sonner";
import { enablePush, GLOBAL_INTEREST } from "@/lib/pusherBeams";
import BrandIcon from "@/components/brand/BrandIcon";
import { Link } from "react-router-dom";
import { useUnseenGuideItems } from "@/components/MobileGuide";
import {
  X, Play, Bell, Download, CalendarDays, Trophy, Newspaper, Mic, Users, ChevronRight, LayoutDashboard, Target,
  PenLine, Shield, Sparkles, LogOut, Tv, HelpCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import logo from "@/assets/metsxmfanzone-logo.png";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SheetTitle, SheetDescription } from "@/components/ui/sheet";

// Full-screen, sports-app style mobile menu (used inside the nav Sheet).

type Props = {
  user: { email?: string | null } | null;
  profile: { full_name: string | null; avatar_url: string | null };
  isAdmin: boolean;
  isWriter: boolean;
  close: () => void;
  go: (path: string) => void;
  goProtected: (path: string) => void;
  goPro: (path: string) => void;
  onSignOut: () => void;
  /** Provided only for signed-in paid members who aren't already in TV mode. */
  onTVMode?: () => void;
};

const Label = ({ children }: { children: React.ReactNode }) => (
  <h3 className="mb-2.5 mt-6 flex items-center gap-2 font-display text-[17px] uppercase leading-none tracking-[0.12em] text-[#9fb0c8]">
    <span className="h-4 w-1 bg-primary" aria-hidden />
    {children}
  </h3>
);

export default function MobileSportsMenu({ user, profile, isAdmin, isWriter, close, go, goProtected, goPro, onSignOut, onTVMode }: Props) {
  const run = (fn: () => void) => () => { close(); fn(); };

  const unseenCount = useUnseenGuideItems().length;
  const tiles: { label: string; icon: LucideIcon; onClick: () => void }[] = [
    { label: "Schedule", icon: CalendarDays, onClick: run(() => goProtected("/mets-schedule-2027")) },
    { label: "Scores", icon: Trophy, onClick: run(() => go("/mets-scores")) },
    { label: "Game Center", icon: LayoutDashboard, onClick: run(() => go("/game-center")) },
    { label: "Picks", icon: Target, onClick: run(() => go("/picks")) },
    { label: "Blog", icon: Newspaper, onClick: run(() => go("/blog")) },
    { label: "Podcast", icon: Mic, onClick: run(() => go("/podcast")) },
  ];

  const initial = profile.full_name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || "M";

  return (
    <div className="flex h-full flex-col bg-[#0b1426] text-white">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 pb-3 pt-[max(0.9rem,env(safe-area-inset-top))]">
        <div className="flex min-w-0 items-center gap-3">
          <img src={logo} alt="" className="h-10 w-auto shrink-0 object-contain" />
          <div className="min-w-0">
            <SheetTitle className="font-display text-[26px] font-normal uppercase leading-none tracking-[0.06em] text-white">Menu</SheetTitle>
            <SheetDescription className="text-[11px] text-[#9fb0c8]">MetsXMFanZone</SheetDescription>
          </div>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label="Close menu"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#12203a] text-white transition-colors hover:bg-[#1a2c4d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav aria-label="Mobile navigation" className="flex-1 overflow-y-auto overscroll-contain px-4 pb-6">
        {/* Watch Live hero */}
        <button
          type="button"
          onClick={run(() => goPro("/metsxmfanzone"))}
          data-guide="menu-watch-live"
          className="mt-4 flex w-full items-center justify-between gap-3 rounded-2xl bg-primary px-4 py-4 text-left text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-[0.98]"
        >
          <span className="min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-black/25 px-2 py-0.5 text-[11px] font-bold tracking-[0.1em]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white motion-reduce:animate-none" /> LIVE
            </span>
            <span className="mt-1.5 block font-display text-[34px] uppercase leading-none tracking-[0.03em]">Watch Live</span>
            <span className="mt-1 block text-[12px] font-medium opacity-90">MetsXMFanZone TV · games · 24/7</span>
          </span>
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-black/20">
            <Play className="ml-1 h-7 w-7 fill-current" />
          </span>
        </button>

        {unseenCount > 0 && <button
          type="button"
          onClick={run(() => window.dispatchEvent(new CustomEvent("mxfz:open-guide", { detail: "list" })))}
          className="flex w-full items-center gap-3 rounded-2xl border-2 border-primary bg-[#1a1410] px-4 py-3 text-left active:bg-[#241a12]"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary"><HelpCircle className="h-6 w-6 text-primary-foreground" /></span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-[22px] uppercase leading-none tracking-[0.04em]">How to get around</span>
            <span className="mt-0.5 block text-[13px] text-[#b9cbe0]">Find anything in 2 taps</span>
          </span>
          <span className="rounded bg-primary px-2 py-0.5 font-display text-[18px] text-primary-foreground">{unseenCount} NEW</span>
        </button>}

        <Label>MetsXMFanZone</Label>
        <div className="grid grid-cols-2 gap-2">
          {tiles.map(({ label, icon: Icon, onClick }) => (
            <button
              key={label}
              type="button"
              onClick={onClick}
              data-guide={`menu-${label.toLowerCase().replace(/\s+/g, "-")}`}
              className="flex min-h-[84px] flex-col justify-between rounded-xl border border-[#24365a] bg-[#12203a] p-3 text-left transition-colors active:bg-[#1a2c4d] hover:border-primary/50"
            >
              <BrandIcon icon={Icon} size={40} />
              <span className="text-[15px] font-bold">{label}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          data-guide="menu-live-alerts"
          onClick={run(async () => {
            const r = await enablePush([GLOBAL_INTEREST]);
            if (r.status === "registered") toast.success("Live game alerts are on for this device.");
            else if (r.status === "denied") toast.error("Alerts are blocked. Turn notifications on for this site in your phone settings.");
            else toast.message("Alerts aren't available here. Open metsxmfanzone.com in your phone's browser to turn them on. You'll still get a Watch now popup when a game goes live while the app is open.");
          })}
          className="mt-3 flex min-h-[64px] w-full items-center gap-3 rounded-xl border border-[#24365a] bg-[#12203a] px-3 text-left transition-colors active:bg-[#1a2c4d] hover:border-primary/50"
        >
          <BrandIcon icon={Bell} size={40} tone="red" />
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-bold">Live game alerts</span>
            <span className="block text-[13px] text-[#b9cbe0]">Get a ping when a game goes live</span>
          </span>
          <ChevronRight className="h-5 w-5 text-[#5b6f90]" />
        </button>

        {user && (
          <>
            <Label>Your account</Label>
            <div data-guide="menu-account" className="divide-y divide-[#1d2c48]">
              {onTVMode && (
                <button type="button" data-guide="menu-tv-mode" onClick={run(onTVMode)} className="flex min-h-[52px] w-full items-center justify-between px-1 text-[16px] font-semibold active:bg-white/5">
                  <span className="flex items-center gap-3"><BrandIcon icon={Tv} size={30} />TV Mode</span><ChevronRight className="h-5 w-5 text-[#5b6f90]" />
                </button>
              )}
              <button type="button" data-guide="menu-community" onClick={run(() => goProtected("/community"))} className="flex min-h-[52px] w-full items-center justify-between px-1 text-[16px] font-semibold active:bg-white/5">
                <span className="flex items-center gap-3"><BrandIcon icon={Users} size={30} />Community</span><ChevronRight className="h-5 w-5 text-[#5b6f90]" />
              </button>
              <button type="button" data-guide="menu-dashboard" onClick={run(() => go("/dashboard"))} className="flex min-h-[52px] w-full items-center justify-between px-1 text-[16px] font-semibold active:bg-white/5">
                <span className="flex items-center gap-3"><BrandIcon icon={LayoutDashboard} size={30} />Dashboard</span><ChevronRight className="h-5 w-5 text-[#5b6f90]" />
              </button>
              <button type="button" data-guide="menu-how-to-get-around" onClick={run(() => window.dispatchEvent(new CustomEvent("mxfz:open-guide", { detail: "list" })))} className="flex min-h-[52px] w-full items-center justify-between px-1 text-[16px] font-semibold active:bg-white/5">
                <span className="flex items-center gap-3"><BrandIcon icon={HelpCircle} size={30} />How to get around</span><ChevronRight className="h-5 w-5 text-[#5b6f90]" />
              </button>
              <button type="button" data-guide="menu-get-the-app" onClick={run(() => go("/install"))} className="flex min-h-[52px] w-full items-center justify-between px-1 text-[16px] font-semibold active:bg-white/5">
                <span className="flex items-center gap-3"><BrandIcon icon={Download} size={30} />Get the app</span><ChevronRight className="h-5 w-5 text-[#5b6f90]" />
              </button>
              {isWriter && (
                <button type="button" data-guide="menu-writers-portal" onClick={run(() => go("/writer"))} className="flex min-h-[52px] w-full items-center justify-between px-1 text-[16px] font-semibold active:bg-white/5">
                  <span className="flex items-center gap-3"><BrandIcon icon={PenLine} size={30} />Writers Portal</span><ChevronRight className="h-5 w-5 text-[#5b6f90]" />
                </button>
              )}
              {isAdmin && (
                <>
                  <button type="button" data-guide="menu-admin-stories" onClick={run(() => go("/admin/stories"))} className="flex min-h-[52px] w-full items-center justify-between px-1 text-[16px] font-semibold active:bg-white/5">
                    <span className="flex items-center gap-3"><BrandIcon icon={Sparkles} size={30} />Admin Stories</span><ChevronRight className="h-5 w-5 text-[#5b6f90]" />
                  </button>
                  <button type="button" data-guide="menu-admin-portal" onClick={run(() => go("/admin"))} className="flex min-h-[52px] w-full items-center justify-between px-1 text-[16px] font-semibold active:bg-white/5">
                    <span className="flex items-center gap-3"><BrandIcon icon={Shield} size={30} />Admin Portal</span><ChevronRight className="h-5 w-5 text-[#5b6f90]" />
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/10 bg-[#0b1426] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        {user ? (
          <div data-guide="menu-account-bar" className="flex items-center gap-3">
            <Avatar className="h-11 w-11 border border-white/20">
              <AvatarImage src={profile.avatar_url || undefined} alt="" />
              <AvatarFallback className="bg-[#12203a] text-sm font-bold text-primary">{initial}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{profile.full_name || "Member"}</p>
              <p className="truncate text-[11px] text-[#9fb0c8]">{user.email}</p>
            </div>
            <button type="button" data-guide="menu-sign-out" onClick={onSignOut} className="flex h-11 items-center gap-2 rounded-xl border border-[#3a4e72] px-3.5 text-sm font-bold active:bg-white/5">
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button type="button" data-guide="menu-log-in" onClick={run(() => go("/auth?mode=login"))} className="h-12 rounded-xl border border-[#3a4e72] text-[15px] font-bold active:bg-white/5">
              Log in
            </button>
            <button type="button" data-guide="menu-join-now" onClick={run(() => go("/auth?mode=signup"))} className="h-12 rounded-xl bg-primary text-[15px] font-bold text-primary-foreground shadow-lg shadow-primary/25 active:scale-[0.98]">
              Join now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
