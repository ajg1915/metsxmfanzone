/**
 * Finds places where an article leans on other writers: reporter names, news outlets, "according to ..."
 * lines and quoted passages. MetsXMFanZone articles must be written from facts in our own words, so any
 * hit here is something to rewrite before the article is approved.
 */
export type OutsideFinding = { kind: "writer" | "outlet" | "attribution" | "quote"; text: string };

const REPORTERS = [
  "Jon Heyman", "Ken Rosenthal", "Jeff Passan", "Mark Feinsand", "Anthony DiComo", "Joel Sherman", "Andy Martino",
  "Will Sammon", "Tim Britton", "Mike Puma", "Mike Mazzeo", "Jon Morosi", "Bob Nightengale", "Buster Olney",
  "Jim Bowden", "Jayson Stark", "Brendan Kuty", "Deesha Thosar", "Abbey Mastracco", "Steve Popper", "Matt Ehalt",
  "Jesse Rogers", "Joel Sherman", "Jordan Bastian", "Mike Rodak", "Evan Drellich",
];

const OUTLETS = [
  "ESPN", "The Athletic", "MLB.com", "MLB Network", "SNY", "New York Post", "NY Post", "Newsday", "Daily News",
  "MLB Trade Rumors", "MLBTR", "Fox Sports", "Yahoo Sports", "Bleacher Report", "USA Today", "CBS Sports",
  "Sports Illustrated", "NJ.com", "Associated Press", "Reuters", "Metsmerized", "Mets Merized", "Amazin' Avenue",
  "FanGraphs", "Baseball America", "New York Times", "NY Times", "Baseball Prospectus", "Fansided", "Sportsnet",
];

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const NAME = "[A-Z][a-z]+(?:\\.|[’'][a-z]+)?(?:\\s+[A-Z][a-z’'.-]+){1,2}";

export function findOutsideWriters(text: string): OutsideFinding[] {
  const out: OutsideFinding[] = [];
  const seen = new Set<string>();
  const add = (kind: OutsideFinding["kind"], t: string) => {
    const key = `${kind}:${t.toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push({ kind, text: t.trim() });
    }
  };

  for (const n of REPORTERS) if (new RegExp(`\\b${esc(n)}\\b`, "i").test(text)) add("writer", n);
  for (const o of OUTLETS) if (new RegExp(`(^|[^A-Za-z])${esc(o)}(?![A-Za-z])`).test(text)) add("outlet", o);

  // "according to X", "per X", "reporting from/by X"
  for (const m of text.matchAll(new RegExp(`\\b(?:according to|per|reporting (?:from|by)|as reported by|reported by)\\s+(${NAME}|[A-Z][A-Za-z.]+)`, "g")))
    add("attribution", m[0]);
  // "<Name> reported / wrote / tweeted / said on X"
  for (const m of text.matchAll(new RegExp(`\\b(${NAME})\\s+(?:reported|wrote|tweeted|posted|noted|writes|reports)\\b`, "g")))
    add("attribution", m[0]);
  // lines lifted from a press story
  for (const m of text.matchAll(/\b(?:told reporters|told [A-Z][a-z]+ [A-Z][a-z]+ of|in an interview with)\b[^.]{0,60}/g)) add("attribution", m[0]);

  // quoted passages of 4+ words
  for (const m of text.matchAll(/[“"]([^”"]{20,}?)[”"]/g)) {
    if (m[1].trim().split(/\s+/).length >= 4) add("quote", m[0].length > 90 ? `${m[0].slice(0, 87)}…` : m[0]);
  }
  return out;
}

export const KIND_LABEL: Record<OutsideFinding["kind"], string> = {
  writer: "Writer's name",
  outlet: "News outlet",
  attribution: "Credits another writer",
  quote: "Quoted passage",
};
