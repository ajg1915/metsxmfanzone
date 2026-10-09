import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { setTVModePreference } from "@/hooks/use-device";
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
    { label: "News", go: () => navigate("/blog") },
    { label: "Podcast", go: () => navigate("/podcast") },
    { label: "Scores", go: () => navigate("/mets-scores") },
  ];

  const pill =
    "rounded-full px-[1.4vw] py-[1.2vh] text-[1.35rem] font-medium whitespace-nowrap transition-colors";

  return (
    <header className="shrink-0 flex items-center gap-[1.2vw] bg-[#0f1b30] px-[2.4vw] py-[2vh] border-b border-white/5">
      <div className="flex items-center gap-[0.9vw] mr-[1.2vw] shrink-0">
        <img src={metsLogo} alt="MetsXMFanZone" className="h-[6.5vh] w-auto" />
        <span className="text-[1.3rem] font-bold tracking-wider uppercase text-[#ff5910]">TV Mode</span>
      </div>

      <nav aria-label="Sections" className="flex items-center gap-[0.6vw] min-w-0">
        {sections.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={s.go}
            className={cn(
              pill,
              s.active ? "bg-[#17263f] text-[#f2f5fa]" : "text-[#9fb0c9] hover:text-[#f2f5fa]",
            )}
          >
            {s.label}
          </button>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-[0.8vw] shrink-0">
        <span className="text-[1.2rem] text-[#9fb0c9] tabular-nums mr-[0.6vw]">
          {now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
        </span>
        <button
          type="button"
          onClick={() => void signOut()}
          className={cn(pill, "text-[1.1rem] text-[#9fb0c9] hover:text-[#f2f5fa]")}
        >
          Sign out
        </button>
        <button
          type="button"
          onClick={() => {
            setTVModePreference(false);
            navigate("/");
            window.location.reload();
          }}
          className={cn(pill, "text-[1.1rem] text-[#9fb0c9] hover:text-[#f2f5fa]")}
        >
          Leave TV
        </button>
      </div>
    </header>
  );
}
