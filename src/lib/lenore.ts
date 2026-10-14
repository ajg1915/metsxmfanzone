// Lenore, the podcast producer, is a Cloudflare Worker that keeps the Mon/Wed/Fri
// show schedule in R2. This file reads that schedule and builds fan-art addresses.

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

/** Upcoming shows, soonest first. Shows that already opened are left to the normal episode list. */
export async function fetchComingSoon(): Promise<LenoreEpisode[]> {
  try {
    const res = await fetch(LENORE_URL, { cache: "no-store" });
    if (!res.ok) return [];
    const all = (await res.json()) as LenoreEpisode[];
    return (Array.isArray(all) ? all : [])
      .filter((e) => e.status === "scheduled" && new Date(e.available).getTime() > Date.now())
      .sort((a, b) => new Date(a.available).getTime() - new Date(b.available).getTime());
  } catch {
    return [];
  }
}

/** Every show Lenore knows about, soonest first, for the admin tab. */
export async function fetchAllShows(): Promise<LenoreEpisode[]> {
  const res = await fetch(LENORE_URL, { cache: "no-store" });
  if (!res.ok) throw new Error("Could not reach Lenore");
  const all = (await res.json()) as LenoreEpisode[];
  return (Array.isArray(all) ? all : []).sort(
    (a, b) => new Date(a.available).getTime() - new Date(b.available).getTime(),
  );
}
