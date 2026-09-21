import { ChevronDown, Search, X } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useMemo, useState } from "react";
import logo from "@/assets/metsxmfanzone-logo.png";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ADMIN_NAV } from "@/components/admin/adminNav";

export function AdminSidebar() {
  const location = useLocation();
  const currentPath = location.pathname;
  const { isMobile, setOpenMobile, state } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;
  const [query, setQuery] = useState("");

  const isActive = (path: string) => {
    if (path === "/admin") return currentPath === path;
    return currentPath.startsWith(path);
  };

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ADMIN_NAV;
    return ADMIN_NAV.map((s) => ({
      ...s,
      items: s.items.filter(
        (i) => i.title.toLowerCase().includes(q) || s.title.toLowerCase().includes(q)
      ),
    })).filter((s) => s.items.length > 0);
  }, [query]);

  const [closedMap, setClosedMap] = useState<Record<string, boolean>>({});
  const isOpenSection = (title: string, items: typeof ADMIN_NAV[number]["items"]) => {
    if (query.trim()) return true;
    if (closedMap[title] !== undefined) return !closedMap[title];
    return title === "Overview" || items.some((i) => isActive(i.url));
  };

  const handleNavigate = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar collapsible="icon" className="admin-shell border-r border-white/5 bg-[#060d1d]/95 backdrop-blur-2xl">
      <SidebarHeader className="gap-2 p-3 group-data-[collapsible=icon]:p-2">
        <div className="flex items-center gap-2.5 px-1">
          <img src={logo} alt="MetsXMFanZone Logo" className="h-8 w-auto flex-shrink-0" />
          <span className="truncate text-[15px] font-bold tracking-tight text-white group-data-[collapsible=icon]:hidden">
            MetsXM<span className="text-[#FF5910]">FanZone</span>
          </span>
        </div>

        <div className="relative group-data-[collapsible=icon]:hidden">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a page"
            aria-label="Search admin pages"
            className="h-9 w-full rounded-xl border border-white/10 bg-white/5 pl-8 pr-8 text-xs text-slate-200 placeholder:text-slate-600 focus:border-transparent focus:outline-none focus:ring-1 focus:ring-[#FF5910]/60"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-slate-500 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-0.5 px-2 py-1 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-white/10">
        {sections.length === 0 && (
          <p className="px-3 py-4 text-[11px] text-slate-500">No pages match “{query}”.</p>
        )}
        {sections.map(({ title, icon: Icon, items }) => {
          const open = isOpenSection(title, items);
          return (
            <SidebarGroup key={title} className="px-0 py-0.5">
              <Collapsible
                open={open}
                onOpenChange={(v) => setClosedMap((m) => ({ ...m, [title]: !v }))}
              >
                <SidebarGroupLabel asChild>
                  <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-2 py-2 text-slate-500 transition-all hover:bg-white/5 hover:text-slate-300 group-data-[collapsible=icon]:justify-center">
                    <div className="flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="text-[10px] font-bold uppercase tracking-widest group-data-[collapsible=icon]:hidden">
                        {title}
                      </span>
                    </div>
                    <ChevronDown
                      className={`h-3 w-3 flex-shrink-0 transition-transform group-data-[collapsible=icon]:hidden ${
                        open ? "rotate-180" : ""
                      }`}
                    />
                  </CollapsibleTrigger>
                </SidebarGroupLabel>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu className="gap-0.5">
                      {items.map((item) => {
                        const active = isActive(item.url);
                        return (
                          <SidebarMenuItem key={item.url + item.title}>
                            <SidebarMenuButton
                              asChild
                              tooltip={item.title}
                              isActive={active}
                              className={`data-[active=true]:bg-transparent data-[active=true]:text-inherit ${
                                collapsed ? "h-9" : "h-11 md:h-9"
                              }`}
                            >
                              <NavLink
                                to={item.url}
                                onClick={handleNavigate}
                                className={`flex items-center gap-2.5 rounded-lg px-3 transition-all duration-200 ${
                                  active
                                    ? "adm-accent-border border bg-[#FF5910]/15 font-semibold !text-[#FF7A3D] shadow-[inset_0_0_14px_-4px_rgba(255,89,16,0.6)]"
                                    : "border border-transparent text-slate-400 hover:bg-white/5 hover:text-white"
                                }`}
                              >
                                <item.icon className="h-4 w-4 flex-shrink-0" />
                                <span className="truncate text-[13px] md:text-[12px]">{item.title}</span>
                              </NavLink>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      })}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </Collapsible>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter className="border-t border-white/5 p-3 group-data-[collapsible=icon]:p-2">
        <div className="flex items-center gap-2.5 rounded-lg border border-white/5 bg-white/5 p-2">
          <div className="h-7 w-7 flex-shrink-0 rounded-full border border-white/20 bg-gradient-to-tr from-[#002D72] to-[#FF5910]" />
          <div className="flex-1 overflow-hidden group-data-[collapsible=icon]:hidden">
            <p className="truncate text-[11px] font-semibold leading-tight text-white">Admin</p>
            <p className="truncate text-[9px] text-slate-500">MetsXMFanZone</p>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
