import { useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import {
  ADMIN_HUBS,
  ADMIN_NAV_ITEMS,
  findActiveHub,
  hubLandingUrl,
  hubPageCount,
} from "@/components/admin/adminNav";
import { useLocation } from "react-router-dom";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSignOut?: () => void;
};

/** Phone menu: every hub as a large tap card, plus search across all pages. */
export function AdminMobileMenu({ open, onOpenChange, onSignOut }: Props) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const activeHub = findActiveHub(pathname);
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return ADMIN_NAV_ITEMS.filter(
      (i) => i.title.toLowerCase().includes(q) || i.section.toLowerCase().includes(q)
    );
  }, [query]);

  const close = () => {
    setQuery("");
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={(v) => (v ? onOpenChange(true) : close())}>
      <SheetContent
        side="bottom"
        className="admin-shell flex h-[92dvh] flex-col gap-4 rounded-t-3xl border-white/10 bg-[#0B1730] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-white"
      >
        <SheetTitle className="font-['Barlow_Condensed',sans-serif] text-[28px] font-bold text-white">
          All sections
        </SheetTitle>
        <SheetDescription className="sr-only">Jump to any admin section or page.</SheetDescription>

        <label className="flex h-12 items-center gap-2.5 rounded-2xl border border-white/15 bg-white/[0.06] px-3.5 text-slate-300">
          <Search className="h-[18px] w-[18px]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find any page"
            aria-label="Find any admin page"
            className="min-w-0 flex-1 bg-transparent text-base text-white placeholder:text-slate-400 focus:outline-none"
          />
        </label>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {query.trim() ? (
            results.length === 0 ? (
              <p className="px-1 py-4 text-sm text-slate-300">No pages match “{query}”.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {results.map((item) => (
                  <li key={item.url + item.title}>
                    <button
                      type="button"
                      onClick={() => {
                        close();
                        navigate(item.url);
                      }}
                      className="flex h-14 w-full items-center gap-3 rounded-2xl border border-white/10 bg-[#14223F] px-4 text-left"
                    >
                      <item.icon className="h-5 w-5 text-[#FF9A6B]" />
                      <span className="flex-1 text-[15px] font-medium">{item.title}</span>
                      <span className="text-xs text-slate-300">{item.section}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              {ADMIN_HUBS.map((hub) => {
                const active = activeHub?.key === hub.key;
                return (
                  <NavLink
                    key={hub.key}
                    to={hubLandingUrl(hub)}
                    onClick={close}
                    className={`flex min-h-[96px] flex-col gap-2.5 rounded-2xl border p-3.5 ${
                      active
                        ? "border-[#FF5910]/60 bg-[#FF5910]/15"
                        : "border-white/12 bg-[#14223F]"
                    }`}
                  >
                    <span className="flex items-center justify-between text-[#FF9A6B]">
                      <hub.icon className="h-6 w-6" />
                      <span className="text-[12.5px] text-slate-300">{hubPageCount(hub)}</span>
                    </span>
                    <span className="font-['Barlow_Condensed',sans-serif] text-2xl font-bold leading-none text-white">
                      {hub.title}
                    </span>
                    <span className="text-[12.5px] leading-snug text-slate-300">{hub.hint}</span>
                  </NavLink>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={() => {
              close();
              navigate("/");
            }}
            className="h-12 flex-1 rounded-2xl border border-white/20 text-[15px] font-semibold"
          >
            View site
          </button>
          {onSignOut && (
            <button
              type="button"
              onClick={() => {
                close();
                onSignOut();
              }}
              className="h-12 flex-1 rounded-2xl border border-white/20 text-[15px] font-semibold"
            >
              Sign out
            </button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
