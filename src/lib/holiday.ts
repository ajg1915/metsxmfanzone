// Holiday theme, picked by date (America/New_York). Override for testing: ?holiday=thanksgiving | christmas | off
export type Holiday = "thanksgiving" | "christmas" | null;

export function getHoliday(now: Date = new Date(), search = ""): Holiday {
  const q = new URLSearchParams(search).get("holiday");
  if (q === "off") return null;
  if (q === "thanksgiving" || q === "christmas") return q;
  const ny = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const m = ny.getMonth() + 1;
  const d = ny.getDate();
  // Thanksgiving = 4th Thursday of November. Theme runs Nov 8 through Thanksgiving Day, off the day after.
  const firstDow = new Date(ny.getFullYear(), 10, 1).getDay();
  const thanksgiving = 1 + ((4 - firstDow + 7) % 7) + 21;
  if (m === 11 && d >= 8 && d <= thanksgiving) return "thanksgiving";
  if (m === 12 && d <= 27) return "christmas"; // Dec 1 - Dec 27
  return null;
}

export const HOLIDAY_EMOJI: Record<Exclude<Holiday, null>, string> = { thanksgiving: "🦃", christmas: "🎅" };
