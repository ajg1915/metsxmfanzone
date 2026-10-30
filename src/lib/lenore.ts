import { uploadToR2Key } from "@/lib/r2Upload";

// The podcast show schedule lives in one small file in R2 (podcast/schedule.json).
// Anthony creates and edits shows in the admin Show editor; this file reads and saves that
// schedule and builds fan-art addresses. (The old Lenore worker URL is only a read fallback.)

export const LENORE_URL = "https://lenore.metsxmfan.workers.dev";
const MEDIA_BASE = "https://media.metsxmfanzone.com";

export type LenoreEpisode = {
  id: string;
  show: string;
  day: string;
  available: string; // ISO time the show opens
  status: "scheduled" | "available";
  title: string;
  description: string;
  alerted?: boolean;
};

/** The show's calendar date in New York, like "2026-10-16". Names the fan-art file. */
export const showDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/New_York" });

export const artKey = (iso: string) => `podcast/${showDate(iso)}.jpg`;
export const artUrl = (iso: string) => `${MEDIA_BASE}/${artKey(iso)}`;

export const fmtShowWhen = (iso: string) => {
  const d = new Date(iso);
  const day = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/New_York" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
  return `${day} · ${time} ET`;
};

export const fmtCountdown = (iso: string, now = Date.now()) => {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return "Starting now";
  const hrs = Math.floor(ms / 36e5);
  const days = Math.floor(hrs / 24);
  if (days >= 1) return `Starts in ${days} day${days > 1 ? "s" : ""} ${hrs % 24} hrs`;
  const mins = Math.floor((ms % 36e5) / 6e4);
  return hrs >= 1 ? `Starts in ${hrs} hrs ${mins} min` : `Starts in ${mins} min`;
};

const SCHEDULE_KEY = "podcast/schedule.json";
const SCHEDULE_URL = `${MEDIA_BASE}/${SCHEDULE_KEY}`;
const SHOW_NAME = "MetsXMFanZone Podcast";

const withStatus = (e: LenoreEpisode): LenoreEpisode => ({
  ...e,
  status: new Date(e.available).getTime() <= Date.now() ? "available" : "scheduled",
});

const toList = (d: unknown): LenoreEpisode[] => {
  const raw = Array.isArray(d) ? d : Array.isArray((d as { episodes?: unknown })?.episodes) ? (d as { episodes: LenoreEpisode[] }).episodes : [];
  return raw.filter((e) => e && e.id && e.available && e.title).map(withStatus);
};

/** Reads the show schedule from R2 (falls back to the old worker address if the file cannot be read directly). */
async function readSchedule(): Promise<LenoreEpisode[]> {
  try {
    const r = await fetch(`${SCHEDULE_URL}?v=${Date.now()}`, { cache: "no-store" });
    if (r.ok) return toList(await r.json());
    if (r.status === 404) return [];
  } catch {
    /* try the fallback below */
  }
  const r2 = await fetch(LENORE_URL, { cache: "no-store" });
  if (!r2.ok) throw new Error("Could not load the shows");
  return toList(await r2.json());
}

const byTime = (a: LenoreEpisode, b: LenoreEpisode) => new Date(a.available).getTime() - new Date(b.available).getTime();

/** Upcoming shows, soonest first. Shows that already opened are left to the normal episode list. */
export async function fetchComingSoon(): Promise<LenoreEpisode[]> {
  try {
    return (await readSchedule())
      .filter((e) => e.status === "scheduled" && new Date(e.available).getTime() > Date.now())
      .sort(byTime);
  } catch {
    return [];
  }
}

/** Every show, soonest first, for the admin Show editor. */
export async function fetchAllShows(): Promise<LenoreEpisode[]> {
  return (await readSchedule()).sort(byTime);
}

/** Saves the whole schedule to R2. Reads the latest copy first so nothing is overwritten by a stale page. */
export async function saveShow(show: LenoreEpisode, mode: "upsert" | "delete" = "upsert"): Promise<void> {
  const list = await readSchedule();
  const rest = list.filter((e) => e.id !== show.id);
  const next = mode === "delete" ? rest : [...rest, show];
  const body = JSON.stringify({ episodes: next.sort(byTime) });
  await uploadToR2Key(new Blob([body], { type: "application/json" }), SCHEDULE_KEY);
}

export const newShowId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `show-${Date.now()}`);

export const buildShow = (id: string, title: string, description: string, available: string): LenoreEpisode => ({
  id,
  show: SHOW_NAME,
  day: new Date(available).toLocaleDateString("en-US", { weekday: "long", timeZone: "America/New_York" }),
  available,
  status: new Date(available).getTime() <= Date.now() ? "available" : "scheduled",
  alerted: true,
  title,
  description,
});

const etParts = (t: number) => {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric" });
  const o: Record<string, number> = {};
  f.formatToParts(new Date(t)).forEach((p) => { if (p.type !== "literal") o[p.type] = Number(p.value); });
  return o;
};

/** New York date ("2026-11-02") and time ("06:00") to a UTC ISO string. */
export function etToIso(date: string, time: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const target = Date.UTC(y, m - 1, d, hh, mm);
  let t = target;
  for (let i = 0; i < 3; i++) {
    const p = etParts(t);
    t -= Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - target;
  }
  return new Date(t).toISOString();
}

/** A show's New York time as "06:00". */
export const showTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/New_York" });
