import { cn } from "@/lib/utils";
import { Radio, Film, RotateCcw, Home, Monitor, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { leaveTV } from "@/lib/tvNavigation";
import { useNavigate } from "react-router-dom";
import type { TVCategory } from "@/pages/TVDashboard";
import metsLogo from "@/assets/metsxmfanzone-logo.png";

interface TVNavBarProps {
  activeCategory: TVCategory;
  onCategoryChange: (cat: TVCategory) => void;
}

const navItems: { key: TVCategory; label: string; icon: React.ElementType }[] = [
  { key: "home", label: "Home", icon: Home },
  { key: "live", label: "Live", icon: Radio },
  { key: "highlights", label: "Highlights", icon: Film },
  { key: "replays", label: "Replays", icon: RotateCcw },
];

export function TVNavBar({ activeCategory, onCategoryChange }: TVNavBarProps) {
  const navigate = useNavigate();

  return (
    <nav className="h-12 shrink-0 flex items-center justify-between px-6 bg-gradient-to-b from-mets-blue-dark to-mets-blue-dark/90 backdrop-blur-md z-50 border-b border-primary/30">
      {/* Left: Logo + Nav */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 shrink-0">
          <img src={metsLogo} alt="MetsXMFanZone" className="h-7 w-auto" />
          <span className="text-[13px] font-bold text-primary-foreground tracking-wide">
            MetsXMFanZone
          </span>
        </div>

        <div className="w-px h-5 bg-primary-foreground/20" />

        <div className="flex items-center gap-1">
          {navItems.map(({ key, label, icon: Icon }) => {
            const isLive = key === "live";
            return (
              <button
                key={key}
                onClick={() => onCategoryChange(key)}
                className={cn(
                  "relative flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium transition-all rounded-sm",
                  "text-primary-foreground/60 hover:text-primary-foreground hover:bg-primary/20"
                )}
              >
                <div className="relative">
                  <Icon className="w-3.5 h-3.5" />
                  {isLive && (
                    <span className="absolute -top-0.5 -right-1 w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                  )}
                </div>
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: Exit */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-[10px] gap-1 px-2.5 text-primary-foreground/50 hover:text-primary-foreground hover:bg-primary/20 rounded-sm"
          onClick={() => {
            leaveTV(navigate);
          }}
        >
          <Monitor className="w-3 h-3" />
          Exit TV
        </Button>
      </div>
    </nav>
  );
}
