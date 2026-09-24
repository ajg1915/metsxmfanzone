const NON_METS_PAGES = [
  "pix11-network",
  "ny-jets",
  "ny-giants",
  "ny-knicks",
  "ny-rangers",
  "ny-islanders",
  "brooklyn-nets",
];

/**
 * Only real Mets games may be auto-started when their scheduled time passes.
 * Everything else (Game Events, NY teams, other events) stays scheduled until
 * an admin presses Go Live.
 */
export const isAutoStartMetsGame = (stream: {
  title?: string | null;
  assigned_pages?: string[] | null;
}) => {
  const pages = stream.assigned_pages || [];
  if (pages.some((p) => NON_METS_PAGES.includes(p))) return false;
  // Never auto-start NY Jets/Giants/Knicks/Rangers/Islanders/Nets events
  if (/\b(jets|knicks|islanders|nets)\b/i.test(stream.title || "")) return false;
  // \bmets\b matches "Mets Vs ..." but not "MetsXMFanZone"
  return /\bmets\b/i.test(stream.title || "");
};
