import { Tv, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { leaveTV } from "@/lib/tvNavigation";
import { useNavigate } from "react-router-dom";

export function TVHeader() {
  const navigate = useNavigate();

  return (
    <header className="h-9 shrink-0 flex items-center justify-between px-3 border-b border-border/30 bg-card/60 backdrop-blur">
      <div className="flex items-center gap-1.5">
        <Tv className="w-3.5 h-3.5 text-primary" />
        <span className="text-[11px] font-semibold text-foreground tracking-wide">
          MetsXM<span className="text-primary">TV</span>
        </span>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-[10px] gap-1 px-2"
          onClick={() => {
            leaveTV(navigate);
          }}
        >
          <Monitor className="w-3 h-3" />
          Exit TV
        </Button>
      </div>
    </header>
  );
}
