import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { leaveTV } from "@/lib/tvNavigation";
import { useAuth } from "@/hooks/useAuth";
import metsLogo from "@/assets/metsxmfanzone-logo.png";

interface TVTopBarProps {
  onHome: () => void;
}

// Big-screen top bar from the TV Site design: logo + TV Mode on the left,
// sections across, clock and account actions on the right. Every item is a real
// button, so the remote's arrows and OK work through useTVFocusNav.
export function TVTopBar({ onHome }: TVTopBarProps) {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  const sections: { label: string; go: () => void; active?: boolean }[] = [
    { label: "Home", go: onHome, active: true },
    { label: "Live", go: () => navigate("/metsxmfanzone") },
    { label: "Highlights", go: () => navigate("/video-gallery") },
    { label: "Replays", go: () => navigate("/replay-games") },
    { label: "News", go: () => navigate("/blog") },
    { label: "Podcast", go: () => navigate("/podcast") },
    { label: "Scores", go: () => navigate("/mets-scores") },
  ];

  const link =
    "relative px-[0.2vw] py-[1vh] text-[1.05rem] font-medium whitespace-nowrap transition-colors border-b-[3px]";

  return (
    <header className="shrink-0 flex items-center gap-[2.2vw] bg-[#0b3e75] border-b-[3px] border-[#ff4400] px-[2.4vw] pt-[1.2vh] pb-0">
      <img src={metsLogo} alt="MetsXMFanZone" className="h-[5vh] w-auto shrink-0" />

      <nav aria-label="Sections" className="flex items-center gap-[1.8vw] min-w-0">
        {sections.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={s.go}
            className={cn(
              link,
              s.active
                ? "border-[#ff4400] text-white"
                : "border-transparent text-[color:var(--tv-subtext)] hover:text-white",
            )}
          >
            {s.label}
          </button>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-[1.4vw] shrink-0">
        <span className="text-[0.95rem] text-[color:var(--tv-subtext)] tabular-nums">
          {now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
        </span>
        <button type="button" onClick={() => void signOut()} className={cn(link, "border-transparent text-[0.9rem] text-[color:var(--tv-subtext)] hover:text-white")}>
          Sign out
        </button>
        <button
          type="button"
          onClick={() => {
            leaveTV(navigate);
          }}
          className={cn(link, "border-transparent text-[0.9rem] text-[color:var(--tv-subtext)] hover:text-white")}
        >
          Leave TV
        </button>
      </div>
    </header>
  );
}
