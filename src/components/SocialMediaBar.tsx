import { Lock } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import homeIcon from "@/assets/tabs/home.png";
import watchIcon from "@/assets/tabs/watch.png";
import blogIcon from "@/assets/tabs/blog.png";
import podcastIcon from "@/assets/tabs/podcast.png";
import feedIcon from "@/assets/tabs/feed.png";

const TAB_ICONS: Record<string, string> = { Home: homeIcon, "Watch Live": watchIcon, Blog: blogIcon, Podcast: podcastIcon, Feed: feedIcon };
import { Button } from "@/components/ui/button";

type NavItem = {
  label: string;
  path: string;
  isAnchor?: boolean;
  requiresPremium: boolean;
};

const navItems: NavItem[] = [
  { label: "Home", path: "/", requiresPremium: false },
  { label: "Watch Live", path: "/metsxmfanzone", requiresPremium: true },
  { label: "Blog", path: "/blog", requiresPremium: false },
  { label: "Podcast", path: "/podcast", requiresPremium: false },
  { label: "Feed", path: "/community", requiresPremium: false },
];


const SocialMediaBar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { isPremium } = useSubscription();
  const [isAdmin, setIsAdmin] = useState(false);
  const isAdminRoute = location.pathname.startsWith("/admin");

  useEffect(() => {
    if (isAdminRoute) return;
    if (!user) { setIsAdmin(false); return; }
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .then(({ data }) => {
        setIsAdmin(data?.some(r => r.role === "admin") ?? false);
      });
  }, [isAdminRoute, user]);

  // Keep hooks in the same order on every route. Returning before the hooks
  // caused React to crash when navigating from the public site into /admin.
  if (isAdminRoute) return null;

  const handleClick = (item: typeof navItems[0]) => {
    // Items requiring premium: redirect to pricing if not premium
    if (item.requiresPremium && (!user || !isPremium)) {
      toast.error("This is a PRO feature! Upgrade to access.");
      navigate("/pricing");
      return;
    }


    if (item.isAnchor && location.pathname === "/") {
      const el = document.getElementById("social");
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
        return;
      }
    }
    navigate(item.path.replace("/#", "/"));
  };

  const isActive = (item: NavItem) =>
    item.path === "/" ? location.pathname === "/" : location.pathname.startsWith(item.path);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      <div data-guide="bottom-nav" className="flex items-stretch border-t border-primary/40 bg-card/95 px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 shadow-elevation-high backdrop-blur-xl">
        {navItems.map((item) => {
          const showProLock = item.requiresPremium && !isPremium && !isAdmin;
          const active = isActive(item);

          const buttonInner = (
            <>
              {active && (
                <span className="absolute -top-1.5 left-1/2 h-[3px] w-6 -translate-x-1/2 rounded-b-full bg-primary" />
              )}
              <span className="relative flex h-9 items-center justify-center">
                <img src={TAB_ICONS[item.label]} alt="" width={36} height={36} className={`h-9 w-9 rounded-[10px] object-contain transition-opacity ${active ? "" : "opacity-80"}`} />
                {showProLock && (
                  <span className="absolute -right-2 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary">
                    <Lock className="h-2 w-2 text-primary-foreground" />
                  </span>
                )}
              </span>
              <span className="text-[10.5px] font-bold leading-none">{item.label}</span>
            </>
          );

          return (
            <Button
              key={item.label}
              data-guide={`tab-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
              variant="ghost"
              onClick={() => handleClick(item)}
              aria-current={active ? "page" : undefined}
              className={`relative h-auto min-h-[62px] min-w-0 flex-1 flex-col gap-1 rounded-sm px-0 py-1 hover:bg-secondary/20 ${
                active ? "text-primary hover:text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {buttonInner}
            </Button>
          );
        })}
      </div>
    </div>
  );
};

export default SocialMediaBar;
