import { NavLink, useLocation } from "react-router-dom";
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

  if (items.length <= 1) return null;

  // Longest matching url wins so "/admin/drafts/new" does not also light up "/admin/drafts".
  const activeUrl = items
    .filter((i) => isUrlActive(i.url, pathname))
    .sort((a, b) => b.url.length - a.url.length)[0]?.url;

  return (
    <nav aria-label={`${hub.title} pages`} className="mb-4 sm:mb-5">
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
    </nav>
  );
}
