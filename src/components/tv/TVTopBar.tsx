import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import metsLogo from "@/assets/metsxmfanzone-logo.png";

interface TVTopBarProps {
  onHome: () => void;
}

// Big-screen top bar from the TV Site design: logo + TV Mode on the left,
// sections across, clock and account actions on the right. Every item is a real
// button, so the remote's arrows and OK work through useTVFocusNav.
export function TVTopBar({ onHome }: TVTopBarProps) {
  const navigate = useNavigate();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  const [active, setActive] = useState("Home");
  const jump = (label: string, id: string) => () => {
    setActive(label);
    if (id === "top") onHome();
    else document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const sections = [
    { label: "Home", go: jump("Home", "top") },
    { label: "Live", go: jump("Live", "tv-sec-live") },
    { label: "Games", go: jump("Games", "tv-sec-scores") },
    { label: "Podcast", go: jump("Podcast", "tv-sec-podcast") },
    { label: "Highlights", go: jump("Highlights", "tv-sec-highlights") },
    { label: "Replays", go: jump("Replays", "tv-sec-replays") },
    { label: "News", go: jump("News", "tv-sec-news") },
  ];

  const link = "rounded-full px-[1.1vw] py-[0.9vh] text-[0.95rem] font-medium whitespace-nowrap transition-colors";

  return (
    <header className="shrink-0 flex items-center gap-[2vw] bg-[color:var(--tv-bg)] px-[2.4vw] py-[1.4vh]">
      <img src={metsLogo} alt="MetsXMFanZone" className="h-[5vh] w-auto shrink-0" />

      <nav aria-label="Sections" className="flex items-center gap-[0.4vw] min-w-0">
        {sections.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={s.go}
            className={cn(
              link,
              s.label === active
                ? "bg-[color:var(--tv-highlight)] text-white"
                : "text-[color:var(--tv-subtext)] hover:text-white",
            )}
          >
            {s.label}
          </button>
        ))}
      </nav>

      <span className="ml-auto text-[0.9rem] text-[color:var(--tv-subtext)] tabular-nums shrink-0">
        {now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
      </span>
    </header>
  );
}
