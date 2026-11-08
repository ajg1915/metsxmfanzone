import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

// The design lives in the owner's Cloudflare R2 bucket and is served by the
// lineup-design Worker (cloudflare/lineup-design-worker.js).
export const LINEUP_API = "https://lineup-design.metsxmfan.workers.dev";

export type LineupTemplate = "broadcast" | "classic" | "night";

export interface LineupPlayerRow {
  position: number;
  name: string;
  fieldPosition: string;
  imageUrl?: string;
}

export interface LineupPitcher {
  name: string;
  hand: string;
  era?: string;
  strikeouts?: string;
}

export interface LineupGameInfo {
  opponent: string;
  isHome: boolean;
  dateLabel: string; // "Sun Nov 8"
  timeLabel: string; // "7:10 PM"
}

/** A lineup typed by hand in the admin, used when MLB's lineup is late or wrong. */
export interface LineupOverride {
  date: string; // YYYY-MM-DD (Eastern)
  game: LineupGameInfo;
  lineup: LineupPlayerRow[];
  pitcher: LineupPitcher | null;
}

export interface LineupDesign {
  enabled: boolean; // show the designed card on the site
  template: LineupTemplate;
  accent: string;
  background: string;
  title: string;
  subtitle: string;
  footer: string;
  showPhotos: boolean;
  showPitcher: boolean;
  override: LineupOverride | null;
  updated_at?: string;
}

export const DEFAULT_LINEUP_DESIGN: LineupDesign = {
  enabled: false,
  template: "broadcast",
  accent: "#FF5910",
  background: "#002D72",
  title: "Today's Lineup",
  subtitle: "Mets starting nine",
  footer: "metsxmfanzone.com",
  showPhotos: true,
  showPitcher: true,
  override: null,
};

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Fills anything missing or invalid with the defaults, so a bad save can never break the page. */
export function normalizeDesign(raw: unknown): LineupDesign {
  const d = (raw && typeof raw === "object" ? raw : {}) as Partial<LineupDesign>;
  const base = DEFAULT_LINEUP_DESIGN;
  const str = (v: unknown, fb: string, max = 80) => (typeof v === "string" ? v.slice(0, max) : fb);
  return {
    enabled: typeof d.enabled === "boolean" ? d.enabled : base.enabled,
    template: d.template === "classic" || d.template === "night" || d.template === "broadcast" ? d.template : base.template,
    accent: typeof d.accent === "string" && HEX.test(d.accent) ? d.accent : base.accent,
    background: typeof d.background === "string" && HEX.test(d.background) ? d.background : base.background,
    title: str(d.title, base.title, 40),
    subtitle: str(d.subtitle, base.subtitle, 60),
    footer: str(d.footer, base.footer, 60),
    showPhotos: typeof d.showPhotos === "boolean" ? d.showPhotos : base.showPhotos,
    showPitcher: typeof d.showPitcher === "boolean" ? d.showPitcher : base.showPitcher,
    override: d.override && typeof d.override === "object" ? (d.override as LineupOverride) : null,
    updated_at: typeof d.updated_at === "string" ? d.updated_at : undefined,
  };
}

export async function fetchLineupDesign(): Promise<LineupDesign> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 6000);
    const res = await fetch(`${LINEUP_API}/design`, { signal: ctl.signal });
    clearTimeout(t);
    if (!res.ok) return DEFAULT_LINEUP_DESIGN;
    const body = await res.json();
    return normalizeDesign(body?.design);
  } catch {
    return DEFAULT_LINEUP_DESIGN; // service not set up yet or offline: the site just keeps its normal look
  }
}

export function useLineupDesign() {
  return useQuery({
    queryKey: ["lineup-design"],
    queryFn: fetchLineupDesign,
    staleTime: 5 * 60 * 1000,
  });
}

export async function saveLineupDesign(design: LineupDesign): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not signed in");
  let res: Response;
  try {
    res = await fetch(`${LINEUP_API}/design`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(design),
    });
  } catch {
    throw new Error("Can't reach the lineup-design service. Deploy the lineup-design Worker first (see cloudflare/lineup-design-worker.js).");
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error || `Lineup design service error (${res.status})`);
}

// ---------- MLB data (public statsapi, no login needed) ----------
const METS = 121;
const headshot = (id: number) =>
  `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${id}/headshot/67/current`;

export const todayET = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });

export interface MlbLineupResult {
  game: LineupGameInfo | null;
  lineup: LineupPlayerRow[];
  pitcher: LineupPitcher | null;
  message?: string;
}

export async function fetchMlbLineup(date = todayET()): Promise<MlbLineupResult> {
  const res = await fetch(
    `https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=${METS}&date=${date}&hydrate=lineups,probablePitcher,team`,
  );
  if (!res.ok) throw new Error("MLB did not answer. Try again in a minute.");
  const data = await res.json();
  const g = data?.dates?.[0]?.games?.[0];
  if (!g) return { game: null, lineup: [], pitcher: null, message: "No Mets game on that date." };

  const isHome = g.teams.home.team.id === METS;
  const opp = (isHome ? g.teams.away.team.name : g.teams.home.team.name) as string;
  const when = new Date(g.gameDate);
  const game: LineupGameInfo = {
    opponent: opp.replace(/^(New York|Los Angeles|San Francisco|San Diego) /, ""),
    isHome,
    dateLabel: new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric" }).format(when),
    timeLabel: new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" }).format(when),
  };

  const players = (isHome ? g.lineups?.homePlayers : g.lineups?.awayPlayers) as any[] | undefined;
  const lineup: LineupPlayerRow[] = (players || []).slice(0, 9).map((p, i) => ({
    position: i + 1,
    name: p.fullName,
    fieldPosition: p.primaryPosition?.abbreviation || "",
    imageUrl: headshot(p.id),
  }));

  const sp = (isHome ? g.teams.home : g.teams.away).probablePitcher;
  const pitcher: LineupPitcher | null = sp
    ? { name: sp.fullName, hand: sp.pitchHand?.code === "L" ? "LHP" : sp.pitchHand?.code === "R" ? "RHP" : "" }
    : null;

  return { game, lineup, pitcher, message: lineup.length ? undefined : "MLB has not posted the lineup yet." };
}
