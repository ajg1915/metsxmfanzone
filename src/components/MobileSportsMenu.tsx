import { Link } from "react-router-dom";
import {
  X, Play, CalendarDays, Trophy, Newspaper, Mic, Users, ChevronRight, LayoutDashboard,
  PenLine, Shield, Sparkles, LogOut,
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
};

const Label = ({ children }: { children: React.ReactNode }) => (
  <h3 className="mb-2.5 mt-6 flex items-center gap-2 font-display text-[17px] uppercase leading-none tracking-[0.12em] text-[#9fb0c8]">
    <span className="h-4 w-1 bg-primary" aria-hidden />
    {children}
  </h3>
);

export default function MobileSportsMenu({ user, profile, isAdmin, isWriter, close, go, goProtected, goPro, onSignOut }: Props) {
  const run = (fn: () => void) => () => { close(); fn(); };

  const tiles: { label: string; icon: LucideIcon; onClick: () => void }[] = [
    { label: "Schedule", icon: CalendarDays, onClick: run(() => goProtected("/mets-schedule-2026")) },
    { label: "Scores", icon: Trophy, onClick: run(() => go("/mets-scores")) },
    { label: "Game Center", icon: LayoutDashboard, onClick: run(() => go("/game-center")) },
    { label: "Blog", icon: Newspaper, onClick: run(() => go("/blog")) },
    { label: "Podcast", icon: Mic, onClick: run(() => go("/podcast")) },
    { label: "Community", icon: Users, onClick: run(() => goProtected("/community")) },
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

        <Label>Mets</Label>
        <div className="grid grid-cols-2 gap-2">
          {tiles.map(({ label, icon: Icon, onClick }) => (
            <button
              key={label}
              type="button"
              onClick={onClick}
              className="flex min-h-[84px] flex-col justify-between rounded-xl border border-[#24365a] bg-[#12203a] p-3 text-left transition-colors active:bg-[#1a2c4d] hover:border-primary/50"
            >
              <Icon className="h-6 w-6 text-primary" />
              <span className="text-[15px] font-bold">{label}</span>
            </button>
          ))}
        </div>

        {user && (
          <>
            <Label>Your account</Label>
            <div className="divide-y divide-[#1d2c48]">
              <button type="button" onClick={run(() => go("/dashboard"))} className="flex min-h-[52px] w-full items-center justify-between px-1 text-[16px] font-semibold active:bg-white/5">
                <span className="flex items-center gap-3"><LayoutDashboard className="h-[18px] w-[18px] text-primary" />Dashboard</span><ChevronRight className="h-5 w-5 text-[#5b6f90]" />
              </button>
              {isWriter && (
                <button type="button" onClick={run(() => go("/writer"))} className="flex min-h-[52px] w-full items-center justify-between px-1 text-[16px] font-semibold active:bg-white/5">
                  <span className="flex items-center gap-3"><PenLine className="h-[18px] w-[18px] text-primary" />Writers Portal</span><ChevronRight className="h-5 w-5 text-[#5b6f90]" />
                </button>
              )}
              {isAdmin && (
                <>
                  <button type="button" onClick={run(() => go("/admin/stories"))} className="flex min-h-[52px] w-full items-center justify-between px-1 text-[16px] font-semibold active:bg-white/5">
                    <span className="flex items-center gap-3"><Sparkles className="h-[18px] w-[18px] text-primary" />Admin Stories</span><ChevronRight className="h-5 w-5 text-[#5b6f90]" />
                  </button>
                  <button type="button" onClick={run(() => go("/admin"))} className="flex min-h-[52px] w-full items-center justify-between px-1 text-[16px] font-semibold active:bg-white/5">
                    <span className="flex items-center gap-3"><Shield className="h-[18px] w-[18px] text-primary" />Admin Portal</span><ChevronRight className="h-5 w-5 text-[#5b6f90]" />
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
          <div className="flex items-center gap-3">
            <Avatar className="h-11 w-11 border border-white/20">
              <AvatarImage src={profile.avatar_url || undefined} alt="" />
              <AvatarFallback className="bg-[#12203a] text-sm font-bold text-primary">{initial}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{profile.full_name || "Member"}</p>
              <p className="truncate text-[11px] text-[#9fb0c8]">{user.email}</p>
            </div>
            <button type="button" onClick={onSignOut} className="flex h-11 items-center gap-2 rounded-xl border border-[#3a4e72] px-3.5 text-sm font-bold active:bg-white/5">
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={run(() => go("/auth?mode=login"))} className="h-12 rounded-xl border border-[#3a4e72] text-[15px] font-bold active:bg-white/5">
              Log in
            </button>
            <button type="button" onClick={run(() => go("/auth?mode=signup"))} className="h-12 rounded-xl bg-primary text-[15px] font-bold text-primary-foreground shadow-lg shadow-primary/25 active:scale-[0.98]">
              Join now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
