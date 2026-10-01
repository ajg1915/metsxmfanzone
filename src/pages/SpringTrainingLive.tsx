import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, Film, Newspaper, Sun } from "lucide-react";
import NetworkStreamPage, { type NetworkPageConfig } from "@/components/streaming/NetworkStreamPage";

// Pitchers and catchers report in mid-February. The exact Mets date is set by MLB each
// year, so the countdown is labelled as approximate.
const SPRING_TARGET = new Date("2027-02-15T09:00:00-05:00").getTime();

const useCountdown = () => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  const ms = Math.max(0, SPRING_TARGET - now);
  return { days: Math.floor(ms / 86_400_000), hours: Math.floor(ms / 3_600_000) % 24, done: ms === 0 };
};

const Offseason = () => {
  const { days, hours, done } = useCountdown();
  return (
    <section aria-label="Spring Training countdown" className="mt-5 overflow-hidden rounded-2xl border border-border/50 bg-card/80">
      <div className="p-4 sm:p-6" style={{ backgroundImage: "linear-gradient(135deg, rgba(11,62,117,0.55), rgba(7,17,29,0) 70%)" }}>
        <p className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#ff5a1f]">
          <Sun className="h-3.5 w-3.5" /> Offseason
        </p>
        <h2 className="mt-1 font-display text-[28px] font-bold uppercase leading-none tracking-wide text-foreground sm:text-4xl">
          {done ? "Spring Training is here" : "Spring Training returns in February"}
        </h2>
        {!done && (
          <div className="mt-3 flex items-end gap-4" role="timer" aria-label={`About ${days} days and ${hours} hours until Spring Training`}>
            <div><span className="font-display text-5xl font-bold leading-none text-foreground">{days}</span><span className="ml-1 text-sm font-semibold text-muted-foreground">days</span></div>
            <div><span className="font-display text-5xl font-bold leading-none text-foreground">{hours}</span><span className="ml-1 text-sm font-semibold text-muted-foreground">hrs</span></div>
            <span className="pb-1 text-xs text-muted-foreground">approx. until pitchers and catchers report</span>
          </div>
        )}
        <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
          No games to stream right now. When Spring Training starts, live games show up in the player above. Until then, catch up on replays and Mets news.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {[
            { to: "/replay-games", icon: Film, label: "Watch replays" },
            { to: "/blog", icon: Newspaper, label: "Mets news" },
            { to: "/mets-schedule-2026", icon: CalendarDays, label: "Schedule" },
          ].map(({ to, icon: Icon, label }) => (
            <Link key={to} to={to} className="flex h-12 items-center justify-center gap-2 rounded-xl border border-border/60 bg-background/50 text-sm font-bold text-foreground transition-colors hover:border-primary/50">
              <Icon className="h-4 w-4 text-[#ff5a1f]" /> {label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

const config: NetworkPageConfig = {
  pageKey: "spring-training-live",
  route: "/spring-training-live",
  seo: {
    title: "Mets Spring Training Live - Games, Replays & Countdown | MetsXMFanZone",
    description: "Watch New York Mets Spring Training games live, catch replays, and count down to pitchers and catchers reporting.",
    keywords: "Mets Spring Training, Spring Training live stream, Mets spring training games, Mets replays, Grapefruit League",
  },
  brand: { from: "#0b3e75", to: "#0a2d5c", accent: "#ff5a1f" },
  mark: <Sun className="h-7 w-7 text-white sm:h-12 sm:w-12" />,
  title: "Spring",
  titleAccent: "Training",
  tagline: "Grapefruit League baseball with the Mets: live games, replays and the first look at the new roster.",
  badges: ["Mets Live", "HD Quality"],
  facts: ["Feb - Mar", "Port St. Lucie, FL"],
  features: [
    { icon: Sun, title: "Live Games", text: "Every Spring Training game we stream shows up here as soon as it goes live." },
    { icon: Film, title: "Replays", text: "Missed one? Watch full replays on demand." },
    { icon: Newspaper, title: "Camp News", text: "Roster battles, injuries and prospects to watch, from the blog." },
  ],
  player: { title: "Spring Training Live", description: "Watch Mets Spring Training games live" },
  extra: <Offseason />,
};

const SpringTrainingLive = () => <NetworkStreamPage cfg={config} />;

export default SpringTrainingLive;
