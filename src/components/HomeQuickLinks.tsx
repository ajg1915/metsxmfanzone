import { BarChart3, CalendarDays, MessageCircle, Play } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const links = [
  { label: "Watch", path: "/metsxmfanzone", icon: Play, featured: true },
  { label: "Games", path: "/mets-schedule-2026", icon: CalendarDays },
  { label: "Community", path: "/community", icon: MessageCircle },
  { label: "Scores", path: "/mets-scores", icon: BarChart3 },
];

export default function HomeQuickLinks() {
  const navigate = useNavigate();

  return (
    <nav aria-label="Quick links" className="home-feed-shell py-4 sm:py-5">
      <div className="grid grid-cols-4 gap-2 sm:gap-4">
        {links.map(({ label, path, icon: Icon, featured }) => (
          <Button
            key={label}
            variant="ghost"
            onClick={() => navigate(path)}
            className="group h-auto min-w-0 flex-col gap-2 p-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
          >
            <span className={featured ? "home-quick-icon home-quick-icon-active" : "home-quick-icon"}>
              <Icon className="h-5 w-5" fill={featured ? "currentColor" : "none"} />
            </span>
            <span className="w-full truncate text-[10px] font-bold uppercase tracking-normal">{label}</span>
          </Button>
        ))}
      </div>
    </nav>
  );
}