import { Tv, BookOpen, Mic, Lock, CalendarDays } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import metsLogo from "@/assets/metsxmfanzone-logo.png";
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
  { label: "Podcast", path: "/podcast", requiresPremium: true },
  { label: "Games", path: "/mets-schedule-2026", requiresPremium: false },
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

  return (
    <div className="pointer-events-none fixed bottom-0 left-0 right-0 z-50 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
      <div className="pointer-events-auto mx-auto flex max-w-md items-center justify-around rounded-lg border border-border/40 bg-card/95 px-2 py-2 shadow-elevation-high backdrop-blur-xl">
        {navItems.map((item) => {
          const showProLock = item.requiresPremium && !isPremium && !isAdmin;
          
          const buttonInner = (
            <>
              {showProLock && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-primary">
                  <Lock className="w-1.5 h-1.5 text-primary-foreground" />
                </span>
              )}
              {item.label === "Home" ? (
                <img src={metsLogo} alt={item.label} className="h-12 w-12 object-contain" />
              ) : item.label === "Watch Live" ? (
                <Tv className="h-7 w-7" />
              ) : item.label === "Blog" ? (

                <BookOpen className="h-7 w-7" />
              ) : item.label === "Podcast" ? (
                <Mic className="h-7 w-7" />
              ) : item.label === "Games" ? (
                <CalendarDays className="h-7 w-7" />
              ) : (
                <img src={metsLogo} alt={item.label} className="h-7 w-7 object-contain" />
              )}
              <span className={`text-[10px] font-semibold ${item.label === "Watch Live" ? "text-primary" : ""}`}>{item.label}</span>
            </>
          );



          return (
            <Button
              key={item.label}
              variant="ghost"
              onClick={() => handleClick(item)}
              className={`relative h-auto min-w-0 flex-col gap-0.5 rounded-sm px-2 py-1 text-muted-foreground hover:bg-secondary/20 hover:text-foreground ${item.label === "Home" ? "text-primary" : ""}`}
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
