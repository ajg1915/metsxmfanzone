import BrandIcon from "@/components/brand/BrandIcon";
import { cn } from "@/lib/utils";
import { Tv, Radio, Film, RotateCcw, Home, HelpCircle } from "lucide-react";
import type { TVCategory } from "@/pages/TVDashboard";

interface TVSidebarProps {
  activeCategory: TVCategory;
  onCategoryChange: (cat: TVCategory) => void;
}

const categories: { key: TVCategory; label: string; icon: import("lucide-react").LucideIcon }[] = [
  { key: "home", label: "Home", icon: Home },
  { key: "live", label: "Live", icon: Radio },
  { key: "highlights", label: "Highlights", icon: Film },
  { key: "replays", label: "Replays", icon: RotateCcw },
];

export function TVSidebar({ activeCategory, onCategoryChange }: TVSidebarProps) {
  return (
    <aside data-guide="tv-sidebar" className="w-14 shrink-0 bg-card/80 backdrop-blur border-r border-border/40 flex flex-col items-center py-3 gap-0.5">
      {/* Logo / brand mark */}
      <div className="mb-3 flex items-center justify-center">
        <BrandIcon icon={Tv} size={30} tone="red" />
      </div>

      {categories.map(({ key, label, icon: Icon }) => {
        const active = activeCategory === key;
        const isLive = key === "live";
        return (
          <button
            key={key}
            onClick={() => onCategoryChange(key)}
            className={cn(
              "w-10 h-10 rounded-md flex flex-col items-center justify-center gap-0.5 transition-all text-[9px] font-medium",
              active
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            )}
            title={label}
          >
            <div className="relative">
              <BrandIcon icon={Icon} size={22} tone={isLive ? "red" : "orange"} />
              {isLive && (
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              )}
            </div>
            <span className="leading-none">{label}</span>
          </button>
        );
      })}
      <button
        type="button"
        data-guide="guide-button"
        onClick={() => window.dispatchEvent(new CustomEvent("mxfz:open-guide", { detail: "list" }))}
        className="mt-auto w-10 h-10 rounded-md flex flex-col items-center justify-center gap-0.5 text-[9px] font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary"
        title="Guide"
      >
        <HelpCircle className="w-3.5 h-3.5" />
        <span className="leading-none">Guide</span>
      </button>
    </aside>
  );
}
