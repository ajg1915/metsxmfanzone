import { NavLink, useLocation } from "react-router-dom";
import { ADMIN_HUBS, findActiveGroup, findActiveHub, isUrlActive } from "@/components/admin/adminNav";

/**
 * Tab strip for the current hub. One tab per group; a group with several pages
 * also shows its pages as pills underneath. Hidden on hubs with a single page.
 */
export function AdminHubTabs() {
  const { pathname } = useLocation();
  const hub = findActiveHub(pathname) ?? ADMIN_HUBS[0];
  const activeGroup = findActiveGroup(hub, pathname);

  if (hub.groups.length <= 1) return null;

  return (
    <div className="mb-4 flex flex-col gap-3 sm:mb-5">
      <div
        role="tablist"
        aria-label={`${hub.title} pages`}
        className="-mx-3 flex gap-1 overflow-x-auto border-b border-white/10 px-3 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {hub.groups.map((group) => {
          const active = group === activeGroup;
          return (
            <NavLink
              key={group.title}
              to={group.items[0].url}
              role="tab"
              aria-selected={active}
              className={`-mb-px flex-shrink-0 whitespace-nowrap border-b-[3px] px-4 py-3 text-[15px] transition-colors ${
                active
                  ? "border-[#FF5910] font-bold text-white"
                  : "border-transparent font-medium text-slate-300 hover:text-white"
              }`}
            >
              {group.title}
            </NavLink>
          );
        })}
      </div>

      {activeGroup && activeGroup.items.length > 1 && (
        <div className="-mx-3 flex gap-2 overflow-x-auto px-3 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {activeGroup.items.map((item) => {
            const active = isUrlActive(item.url, pathname);
            return (
              <NavLink
                key={item.url}
                to={item.url}
                className={`flex h-10 flex-shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-4 text-[13.5px] transition-colors ${
                  active
                    ? "border-white/30 bg-white/15 font-semibold text-white"
                    : "border-white/15 text-slate-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.title}
              </NavLink>
            );
          })}
        </div>
      )}
    </div>
  );
}
