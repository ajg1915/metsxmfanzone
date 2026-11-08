import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useDevice } from "@/hooks/use-device";
import { getHoliday } from "@/lib/holiday";

// Routes where nothing should float over the picture or the tools.
const SKIP = ["/admin", "/tv", "/live", "/metsxmfanzone", "/spring-training-live", "/gameday-live", "/private-live", "/auth", "/logout"];

const FLAKES: Record<string, string[]> = {
  christmas: ["❄", "❅", "❆"],
  thanksgiving: ["🍂", "🍁", "🍂"],
};

// Soft falling snow (Christmas) or leaves (Thanksgiving). Decorative only, never blocks taps.
export function HolidayDecor() {
  const { pathname, search } = useLocation();
  const { isTV, isTVDevice } = useDevice();
  const [reduced, setReduced] = useState(true);
  const holiday = getHoliday(new Date(), search);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const pieces = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => ({
        left: (i * 97) % 100,
        size: 12 + ((i * 7) % 14),
        dur: 11 + ((i * 5) % 9),
        delay: -((i * 3) % 14),
        drift: ((i % 5) - 2) * 18,
        glyph: i % 3,
      })),
    [],
  );

  if (!holiday || reduced || isTV || isTVDevice) return null;
  if (SKIP.some((p) => pathname === p || pathname.startsWith(p + "/"))) return null;
  const glyphs = FLAKES[holiday];

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[5] overflow-hidden">
      <style>{`@keyframes holiday-fall{0%{transform:translate3d(0,-8vh,0) rotate(0)}100%{transform:translate3d(var(--dx),108vh,0) rotate(360deg)}}`}</style>
      {pieces.map((p, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            top: 0,
            left: `${p.left}%`,
            fontSize: p.size,
            opacity: 0.55,
            color: "#fff",
            textShadow: holiday === "christmas" ? "0 0 4px rgba(120,170,255,.8)" : undefined,
            animation: `holiday-fall ${p.dur}s linear ${p.delay}s infinite`,
            ["--dx" as string]: `${p.drift}px`,
          }}
        >
          {glyphs[p.glyph]}
        </span>
      ))}
    </div>
  );
}
