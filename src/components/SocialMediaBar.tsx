import { MessageSquarePlus, Share2, Tv, PenLine, BookOpen, Mic, Lock, Bell } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import metsLogo from "@/assets/metsxmfanzone-logo.png";
import NotificationsPanel from "@/components/NotificationsPanel";

type NavItem = {
  label: string;
  path: string;
  isAnchor?: boolean;
  requiresPremium: boolean;
};

const navItems: NavItem[] = [
  { label: "Home", path: "/", requiresPremium: false },
  { label: "Watch Live", path: "/metsxmfanzone", requiresPremium: true },
  { label: "Post", path: "/community", requiresPremium: false },
  { label: "Blog", path: "/blog", requiresPremium: true },
  { label: "Podcast", path: "/podcast", requiresPremium: true },
  { label: "Alerts", path: "#notifications", requiresPremium: false },
];

const SocialMediaBar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { isPremium } = useSubscription();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .then(({ data }) => {
        setIsAdmin(data?.some(r => r.role === "admin") ?? false);
      });
  }, [user]);

  const handleClick = (item: typeof navItems[0]) => {
    // Items requiring premium: redirect to pricing if not premium
    if (item.requiresPremium && (!user || !isPremium)) {
      toast.error("This is a PRO feature! Upgrade to access.");
      navigate("/pricing");
      return;
    }

    // Community requires login but NOT premium
    if (item.label === "Post" && !user) {
      navigate("/auth");
      return;
    }

    // Admin override: Post button goes to admin stories
    if (item.label === "Post" && isAdmin) {
      navigate("/admin/stories");
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
    <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background/90 backdrop-blur-md border-t border-border/40">
      <div className="flex items-center justify-around py-2 px-4">
        {navItems.map((item) => {
          const showProLock = item.requiresPremium && !isPremium && !isAdmin;
          
          const buttonInner = (
            <>
              {showProLock && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-gradient-to-r from-orange-500 to-amber-500 rounded-full flex items-center justify-center">
                  <Lock className="w-1.5 h-1.5 text-white" />
                </span>
              )}
              {item.label === "Home" ? (
                <img src={metsLogo} alt={item.label} className="h-12 w-12 object-contain" />
              ) : item.label === "Watch Live" ? (
                <Tv className="h-7 w-7" />
              ) : item.label === "Post" ? (
                <MessageSquarePlus className="h-7 w-7" />
              ) : item.label === "Blog" ? (
                <BookOpen className="h-7 w-7" />
              ) : item.label === "Podcast" ? (
                <Mic className="h-7 w-7" />
              ) : item.label === "Alerts" ? (
                <Bell className="h-7 w-7" />
              ) : (
                <img src={metsLogo} alt={item.label} className="h-7 w-7 object-contain" />
              )}
              <span className={`text-[10px] font-medium ${item.label === "Watch Live" ? "animate-pulse drop-shadow-[0_0_4px_rgba(255,69,0,0.7)]" : ""}`} style={item.label === "Watch Live" ? { color: "#ff4500" } : undefined}>{item.label}</span>
            </>
          );

          if (item.label === "Alerts") {
            return (
              <NotificationsPanel key={item.label}>
                <button className="flex flex-col items-center gap-0.5 text-muted-foreground hover:text-primary transition-colors relative">
                  {buttonInner}
                </button>
              </NotificationsPanel>
            );
          }

          return (
            <button
              key={item.label}
              onClick={() => handleClick(item)}
              className="flex flex-col items-center gap-0.5 text-muted-foreground hover:text-primary transition-colors relative"
            >
              {buttonInner}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default SocialMediaBar;
