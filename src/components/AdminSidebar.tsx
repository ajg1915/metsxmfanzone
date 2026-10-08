import { Search, X } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useMemo, useState } from "react";
import logo from "@/assets/metsxmfanzone-logo.png";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  ADMIN_HUBS,
  ADMIN_NAV_ITEMS,
  findActiveHub,
  hubLandingUrl,
  hubPageCount,
  isUrlActive,
} from "@/components/admin/adminNav";

export function AdminSidebar() {
  const location = useLocation();
  const currentPath = location.pathname;
  const { isMobile, setOpenMobile, state } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;
  const [query, setQuery] = useState("");
  const activeHub = findActiveHub(currentPath);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return ADMIN_NAV_ITEMS.filter(
      (i) => i.title.toLowerCase().includes(q) || i.section.toLowerCase().includes(q)
    );
  }, [query]);

  const handleNavigate = () => {
    setQuery("");
    if (isMobile) setOpenMobile(false);
  };

  const linkBase =
    "flex items-center gap-3 rounded-xl border px-3 transition-all duration-200";
  const linkActive =
    "border-[#FF5910]/55 bg-[#FF5910]/15 font-bold !text-[#FFB08A]";
  const linkIdle =
    "border-transparent font-medium text-slate-200 hover:bg-white/5 hover:text-white";

  return (
    <Sidebar collapsible="icon" className="admin-shell border-r border-white/10 bg-[#14223f]/95 backdrop-blur-2xl">
      <SidebarHeader className="gap-3 p-3 group-data-[collapsible=icon]:p-2">
        <div className="flex items-center gap-2.5 px-1">
          <img src={logo} alt="MetsXMFanZone Logo" className="h-8 w-auto flex-shrink-0" />
          <div className="flex min-w-0 flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate font-['Barlow_Condensed',sans-serif] text-[24px] font-bold tracking-tight text-white">
              MetsXM<span className="text-[#FF7A3D]">FanZone</span>
            </span>
            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#FF9A6B]">
              Control Room
            </span>
          </div>
        </div>

        <div className="relative group-data-[collapsible=icon]:hidden">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find any page"
            aria-label="Search admin pages"
            className="h-[42px] w-full rounded-xl border border-white/15 bg-white/[0.06] pl-9 pr-9 text-sm text-white placeholder:text-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#FF5910]/60"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-300 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-0.5 px-2 py-1 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-white/10">
        <SidebarGroup className="px-0 py-0.5">
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {query.trim() ? (
                results.length === 0 ? (
                  <p className="px-3 py-4 text-xs text-slate-300">No pages match “{query}”.</p>
                ) : (
                  results.map((item) => (
                    <SidebarMenuItem key={item.url + item.title}>
                      <SidebarMenuButton asChild tooltip={item.title} className="h-11">
                        <NavLink
                          to={item.url}
                          onClick={handleNavigate}
                          className={`${linkBase} ${
                            isUrlActive(item.url, currentPath) ? linkActive : linkIdle
                          }`}
                        >
                          <item.icon className="h-[18px] w-[18px] flex-shrink-0" />
                          <span className="min-w-0 flex-1 truncate text-sm">{item.title}</span>
                          <span className="text-[11px] text-slate-400">{item.section}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))
                )
              ) : (
                ADMIN_HUBS.map((hub) => {
                  const active = activeHub?.key === hub.key;
                  return (
                    <SidebarMenuItem key={hub.key}>
                      <SidebarMenuButton
                        asChild
                        tooltip={hub.title}
                        isActive={active}
                        className={`data-[active=true]:bg-transparent data-[active=true]:text-inherit ${
                          collapsed ? "h-11" : "h-[46px]"
                        }`}
                      >
                        <NavLink
                          to={hubLandingUrl(hub)}
                          onClick={handleNavigate}
                          className={`${linkBase} ${active ? linkActive : linkIdle}`}
                        >
                          <hub.icon className="h-5 w-5 flex-shrink-0" />
                          <span className="min-w-0 flex-1 truncate text-[15px]">{hub.title}</span>
                          <span className="text-xs opacity-80 group-data-[collapsible=icon]:hidden">
                            {hubPageCount(hub)}
                          </span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-white/10 p-3 group-data-[collapsible=icon]:p-2">
        <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 p-2">
          <div className="h-8 w-8 flex-shrink-0 rounded-full border border-white/20 bg-gradient-to-tr from-[#002D72] to-[#FF5910]" />
          <div className="flex-1 overflow-hidden leading-tight group-data-[collapsible=icon]:hidden">
            <p className="truncate text-[13px] font-semibold text-white">Admin</p>
            <p className="truncate text-xs text-slate-300">MetsXMFanZone</p>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
