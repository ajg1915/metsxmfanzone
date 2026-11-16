import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ChevronDown, ChevronRight } from "lucide-react";
import { ADMIN_HUBS, findActiveHub, hubItems, isUrlActive } from "@/components/admin/adminNav";
import { useDraftsWaiting } from "@/hooks/useDraftsWaiting";

/**
 * One row of pages for the current section. Every page in the section is a single pill,
 * so there is only one level to look at. Hidden when a section has just one page.
 */
export function AdminHubTabs() {
  const { pathname } = useLocation();
  const hub = findActiveHub(pathname) ?? ADMIN_HUBS[0];
  const items = hubItems(hub);
  const waiting = useDraftsWaiting(pathname);
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  if (items.length <= 1) return null;

  // Longest matching url wins so "/admin/drafts/new" does not also light up "/admin/drafts".
  const activeUrl = items
    .filter((i) => isUrlActive(i.url, pathname))
    .sort((a, b) => b.url.length - a.url.length)[0]?.url;

  const current = items.find((i) => i.url === activeUrl) ?? items[0];

  return (
    <nav aria-label={`${hub.title} pages`} className="mb-4 sm:mb-5">
      {/* Phone: one button that opens the full list of pages in this section */}
      <div className="md:hidden">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex min-h-[52px] w-full items-center gap-3 rounded-2xl border border-[#2a3a5c] bg-[#111b30] px-4 text-left"
        >
          <current.icon className="h-5 w-5 text-[#FF9A6B]" />
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-medium text-slate-400">{hub.title}</span>
            <span className="block truncate text-[15px] font-bold text-white">{current.title}</span>
          </span>
          <span className="text-xs font-semibold text-slate-300">{items.length} pages</span>
          <ChevronDown className={`h-5 w-5 text-slate-300 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open && (
          <ul className="mt-2 rounded-2xl border border-[#2a3a5c] bg-[#111b30] px-4">
            {items.map((item, idx) => {
              const active = item.url === activeUrl;
              return (
                <li key={item.url} className={idx === items.length - 1 ? "" : "border-b border-[#22314f]"}>
                  <NavLink
                    to={item.url}
                    className={`flex min-h-[60px] items-center gap-3 text-base font-semibold ${
                      active ? "text-[#FF9A6B]" : "text-slate-100"
                    }`}
                  >
                    <item.icon className="h-5 w-5 flex-shrink-0" />
                    <span className="min-w-0 flex-1">{item.title}</span>
                    {item.title === "Drafts" && waiting ? (
                      <span className="rounded-full bg-[#FF5910] px-2 py-px text-xs font-extrabold text-[#0B1730]">{waiting}</span>
                    ) : null}
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </NavLink>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="hidden md:block">
      <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => {
          const active = item.url === activeUrl;
          return (
            <NavLink
              key={item.url}
              to={item.url}
              aria-current={active ? "page" : undefined}
              className={`flex h-11 flex-shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-4 text-sm transition-colors ${
                active
                  ? "border-[#FF5910] bg-[#FF5910]/15 font-bold text-white"
                  : "border-white/15 font-medium text-slate-200 hover:bg-white/5 hover:text-white"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.title}
              {item.title === "Drafts" && waiting ? (
                <span className="rounded-full bg-[#FF5910] px-2 py-px text-xs font-extrabold text-[#0B1730]">
                  {waiting}
                  <span className="sr-only"> waiting for approval</span>
                </span>
              ) : null}
            </NavLink>
          );
        })}
      </div>
      </div>
    </nav>
  );
}
