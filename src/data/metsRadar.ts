// Mets Radar: players and moves the Mets are being linked to.
// Edit this list to add, change or remove a rumor. Newest first.
// Trades and Signings are NOT listed here: they load automatically from MLB's
// official transactions feed on the Mets Tracker page.

export type RadarStatus = "in_talks" | "linked" | "long_shot";

export interface RadarItem {
  player: string;
  position: string;
  team: string; // current team
  why: string; // one line on why he fits the Mets
  source: string; // reporter / outlet
  sourceUrl?: string;
  heat: 1 | 2 | 3 | 4 | 5; // how hot the rumor is
  status: RadarStatus;
  updated: string; // YYYY-MM-DD
}

export const METS_RADAR: RadarItem[] = [];
