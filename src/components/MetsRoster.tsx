import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Award, Flame, Newspaper, Search, Snowflake, Users, FileText, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const MLB = "https://statsapi.mlb.com/api/v1";
const METS_ID = 121;
const SEASON = new Date().getFullYear();

const headshot = (id: number | string, w = 180) =>
  `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_${w},q_auto:best/v1/people/${id}/headshot/67/current`;

type Group = "Pitchers" | "Catchers" | "Infield" | "Outfield" | "DH";
const GROUPS: Group[] = ["Pitchers", "Catchers", "Infield", "Outfield", "DH"];
const groupOf = (pos: string): Group => {
  if (pos === "P" || pos === "SP" || pos === "RP" || pos === "CP") return "Pitchers";
  if (pos === "C") return "Catchers";
  if (["1B", "2B", "3B", "SS", "IF"].includes(pos)) return "Infield";
  if (["LF", "CF", "RF", "OF"].includes(pos)) return "Outfield";
  return "DH";
};

interface RosterPlayer {
  id: number;
  name: string;
  number: string;
  pos: string;
  group: Group;
  status: string;
  age?: number;
  height?: string;
  weight?: number;
  bats?: string;
  throws?: string;
  born?: string;
  debut?: string;
  season?: Record<string, any>;
  career?: Record<string, any>;
}

async function fetchRoster(type: "40Man" | "active"): Promise<RosterPlayer[]> {
  const rRes = await fetch(`${MLB}/teams/${METS_ID}/roster?rosterType=${type}`);
  if (!rRes.ok) throw new Error("roster");
  const rJson = await rRes.json();
  const entries: any[] = rJson.roster ?? [];
  if (entries.length === 0) return [];
  const ids = entries.map((e) => e.person.id).join(",");

  // Bio + stats for everyone in one request. If the stats hydration is refused, fall back to bios only.
  let people: any[] = [];
  const hydrate = encodeURIComponent(`stats(group=[hitting,pitching],type=[season,career],season=${SEASON})`);
  try {
    let pRes = await fetch(`${MLB}/people?personIds=${ids}&hydrate=${hydrate}`);
    if (!pRes.ok) pRes = await fetch(`${MLB}/people?personIds=${ids}`);
    people = (await pRes.json()).people ?? [];
  } catch {
    people = [];
  }
  const byId = new Map<number, any>(people.map((p) => [p.id, p]));

  return entries.map((e) => {
    const p = byId.get(e.person.id) ?? {};
    const pos = e.position?.abbreviation ?? p.primaryPosition?.abbreviation ?? "";
    const pickStat = (kind: string) => {
      const isPitcher = groupOf(pos) === "Pitchers";
      const s = (p.stats ?? []).find(
        (x: any) => x.type?.displayName === kind && x.group?.displayName === (isPitcher ? "pitching" : "hitting"),
      );
      return s?.splits?.[0]?.stat as Record<string, any> | undefined;
    };
    return {
      id: e.person.id,
      name: e.person.fullName,
      number: e.jerseyNumber ?? "",
      pos,
      group: groupOf(pos),
      status: e.status?.description ?? "",
      age: p.currentAge,
      height: p.height,
      weight: p.weight,
      bats: p.batSide?.code,
      throws: p.pitchHand?.code,
      born: [p.birthCity, p.birthStateProvince, p.birthCountry].filter(Boolean).join(", "),
      debut: p.mlbDebutDate,
      season: pickStat("season"),
      career: pickStat("career"),
    };
  });
}

const hitLine = (s?: Record<string, any>) =>
  s ? [`${s.avg ?? ".---"} AVG`, `${s.homeRuns ?? 0} HR`, `${s.rbi ?? 0} RBI`, `${s.ops ?? ".---"} OPS`] : [];
const pitchLine = (s?: Record<string, any>) =>
  s ? [`${s.era ?? "-.--"} ERA`, `${s.wins ?? 0}-${s.losses ?? 0}`, `${s.strikeOuts ?? 0} SO`, `${s.whip ?? "-.--"} WHIP`] : [];

function statLine(p: RosterPlayer) {
  return p.group === "Pitchers" ? pitchLine(p.season) : hitLine(p.season);
}

// ---- Player Watch: the site's hot / cold calls, newest first ----
function PlayerWatch({ onOpen, byName }: { onOpen: (id: number) => void; byName: Map<string, number> }) {
  const { data } = useQuery({
    queryKey: ["roster-player-watch"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("daily_player_predictions")
        .select("id, player_name, player_id, player_image_url, status, description, prediction_date")
        .order("prediction_date", { ascending: false })
        .order("created_at", { ascending: true })
        .limit(12);
      if (error) throw error;
      const latest = rows?.[0]?.prediction_date;
      return (rows ?? []).filter((r) => r.prediction_date === latest);
    },
  });
  if (!data || data.length === 0) return null;
  return (
    <div className="mb-7 sm:mb-8">
      <h3 className="mb-3 flex items-center gap-2 font-display text-lg font-bold uppercase tracking-wide sm:text-xl">
        <Flame className="h-5 w-5 text-primary" /> Player Watch
      </h3>
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3 [&::-webkit-scrollbar]:hidden">
        {data.map((r) => {
          const hot = r.status === "hot";
          const id = r.player_id ?? byName.get(r.player_name.toLowerCase());
          return (
            <button
              key={r.id}
              type="button"
              disabled={!id}
              onClick={() => id && onOpen(id)}
              className="flex w-[82%] shrink-0 snap-start gap-3 rounded-xl border border-border bg-card p-3 text-left transition hover:border-primary/60 disabled:cursor-default sm:w-auto"
            >
              <img
                src={r.player_image_url || (id ? headshot(id, 120) : "")}
                alt=""
                loading="lazy"
                className="h-14 w-14 shrink-0 rounded-full bg-muted object-cover sm:h-16 sm:w-16"
              />
              <span className="min-w-0">
                <span className="flex items-center gap-2">
                  <span className="truncate font-semibold">{r.player_name}</span>
                  <Badge variant={hot ? "default" : "secondary"} className="gap-1">
                    {hot ? <Flame className="h-3 w-3" /> : <Snowflake className="h-3 w-3" />}
                    {hot ? "Hot" : "Cold"}
                  </Badge>
                </span>
                <span className="mt-1 line-clamp-3 block text-[13px] leading-snug text-muted-foreground sm:text-sm">{r.description}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---- Player rumors & moves: the admin's news tracker ----
function Rumors({ onOpen, byName }: { onOpen: (id: number) => void; byName: Map<string, number> }) {
  const { data } = useQuery({
    queryKey: ["roster-rumors"],
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("mets_news_tracker")
        .select("id, type, title, player, details, time_ago, created_at")
        .eq("published", true)
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return rows ?? [];
    },
  });
  if (!data || data.length === 0) return null;
  const label = (t: string) => (t === "discussions" ? "Rumor" : t === "signing" ? "Signing" : t === "trade" ? "Trade" : t);
  return (
    <div className="mb-7 sm:mb-8">
      <h3 className="mb-3 flex items-center gap-2 font-display text-lg font-bold uppercase tracking-wide sm:text-xl">
        <Newspaper className="h-5 w-5 text-primary" /> Player Rumors &amp; Moves
      </h3>
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden">
        {data.map((n) => {
          const id = [n.title, n.player].map((x) => byName.get((x ?? "").trim().toLowerCase())).find(Boolean);
          return (
            <div key={n.id} className="w-[82%] shrink-0 snap-start rounded-xl border border-border bg-card p-3 sm:p-4 md:w-auto">
              <div className="mb-1 flex items-center justify-between gap-2">
                <Badge variant={n.type === "discussions" ? "default" : "secondary"}>{label(n.type)}</Badge>
                <span className="text-xs text-muted-foreground">{n.time_ago}</span>
              </div>
              <p className="font-semibold">
                {id ? (
                  <button type="button" onClick={() => onOpen(id)} className="text-left underline-offset-2 hover:underline">
                    {n.title}
                  </button>
                ) : (
                  n.title
                )}
              </p>
              {n.player && <p className="text-sm text-primary">{n.player}</p>}
              {n.details && <p className="mt-1 text-sm text-muted-foreground">{n.details}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- One player's full card ----
function StatGrid({ items }: { items: [string, any][] }) {
  return (
    <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
      {items.map(([k, v]) => (
        <div key={k} className="rounded-lg bg-muted px-1 py-2 text-center">
          <div className="text-[15px] font-bold sm:text-lg">{v ?? "—"}</div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground sm:text-xs">{k}</div>
        </div>
      ))}
    </div>
  );
}

function hittingItems(s?: Record<string, any>): [string, any][] {
  return [
    ["AVG", s?.avg], ["OBP", s?.obp], ["SLG", s?.slg], ["OPS", s?.ops],
    ["HR", s?.homeRuns], ["RBI", s?.rbi], ["R", s?.runs], ["H", s?.hits],
    ["SB", s?.stolenBases], ["BB", s?.baseOnBalls], ["SO", s?.strikeOuts], ["G", s?.gamesPlayed],
  ];
}
function pitchingItems(s?: Record<string, any>): [string, any][] {
  return [
    ["ERA", s?.era], ["W-L", s ? `${s.wins ?? 0}-${s.losses ?? 0}` : undefined], ["WHIP", s?.whip], ["IP", s?.inningsPitched],
    ["SO", s?.strikeOuts], ["BB", s?.baseOnBalls], ["SV", s?.saves], ["HLD", s?.holds],
    ["GS", s?.gamesStarted], ["G", s?.gamesPitched ?? s?.gamesPlayed], ["BAA", s?.avg], ["HR", s?.homeRuns],
  ];
}

function PlayerDialog({ player, onClose }: { player: RosterPlayer | null; onClose: () => void }) {
  const id = player?.id;
  const { data: awards, isLoading: awardsLoading } = useQuery({
    queryKey: ["player-awards", id],
    enabled: !!id,
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      const res = await fetch(`${MLB}/people/${id}?hydrate=awards`);
      if (!res.ok) throw new Error("awards");
      const list: any[] = (await res.json()).people?.[0]?.awards ?? [];
      const grouped = new Map<string, number[]>();
      for (const a of list) {
        const name = a.name ?? a.id;
        const yr = Number(a.season ?? String(a.date ?? "").slice(0, 4));
        const arr = grouped.get(name) ?? [];
        if (yr) arr.push(yr);
        grouped.set(name, arr);
      }
      return Array.from(grouped.entries())
        .map(([name, years]) => ({ name, years: years.sort((x, y) => x - y) }))
        .sort((x, y) => (y.years.length || 0) - (x.years.length || 0));
    },
  });
  const { data: info } = useQuery({
    queryKey: ["player-info", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase.from("mets_player_info" as any).select("*").eq("player_id", id!).maybeSingle();
      return data as any;
    },
  });
  const { data: rumors } = useQuery({
    queryKey: ["player-rumors", player?.name],
    enabled: !!player,
    queryFn: async () => {
      const last = player!.name.split(" ").slice(-1)[0];
      const { data } = await supabase
        .from("mets_news_tracker")
        .select("id, type, title, player, details, time_ago")
        .eq("published", true)
        .or(`title.ilike.%${last}%,player.ilike.%${last}%`)
        .order("created_at", { ascending: false })
        .limit(5);
      return (data ?? []).filter((n) => `${n.title} ${n.player}`.toLowerCase().includes(player!.name.toLowerCase()) || `${n.title} ${n.player}`.toLowerCase().includes(last.toLowerCase()));
    },
  });

  if (!player) return null;
  const pitcher = player.group === "Pitchers";
  const items = pitcher ? pitchingItems : hittingItems;
  const hasContract = info && (info.contract_total || info.contract_years || info.contract_aav || info.contract_through);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] w-[calc(100vw-1.5rem)] max-w-2xl overflow-y-auto rounded-xl p-4 sm:p-6">
        <DialogHeader>
          <div className="flex items-center gap-3 sm:gap-4">
            <img src={headshot(player.id, 240)} alt="" className="h-16 w-16 shrink-0 rounded-full bg-muted object-cover sm:h-24 sm:w-24" />
            <div className="min-w-0 text-left">
              <DialogTitle className="text-xl leading-tight sm:text-2xl">{player.name}</DialogTitle>
              <DialogDescription>
                {[player.number && `#${player.number}`, player.pos, player.age && `Age ${player.age}`, player.bats && player.throws && `B/T ${player.bats}/${player.throws}`, player.height, player.weight && `${player.weight} lb`]
                  .filter(Boolean)
                  .join(" · ")}
              </DialogDescription>
              {player.born && <p className="text-xs text-muted-foreground">Born: {player.born}</p>}
              {player.debut && <p className="text-xs text-muted-foreground">MLB debut: {player.debut}</p>}
            </div>
          </div>
        </DialogHeader>

        {info?.watch_note && (
          <div className="rounded-lg border border-primary/40 bg-primary/10 p-3 text-sm">
            <span className="mr-2 font-semibold text-primary">Player Watch</span>
            {info.watch_note}
          </div>
        )}

        <Tabs defaultValue="stats">
          <TabsList className="grid h-auto w-full grid-cols-4 p-1">
            <TabsTrigger value="stats" className="px-1 text-xs sm:text-sm">Stats</TabsTrigger>
            <TabsTrigger value="awards" className="px-1 text-xs sm:text-sm">Awards</TabsTrigger>
            <TabsTrigger value="contract" className="px-1 text-xs sm:text-sm">Contract</TabsTrigger>
            <TabsTrigger value="news" className="px-1 text-xs sm:text-sm">Rumors</TabsTrigger>
          </TabsList>

          <TabsContent value="stats" className="mt-3 space-y-4">
            <div>
              <p className="mb-2 text-sm font-semibold">{SEASON} season</p>
              {player.season ? <StatGrid items={items(player.season)} /> : <p className="text-sm text-muted-foreground">No {SEASON} stats yet.</p>}
            </div>
            {player.career && (
              <div>
                <p className="mb-2 text-sm font-semibold">Career</p>
                <StatGrid items={items(player.career)} />
              </div>
            )}
            <Link to={`/player/${player.id}`} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
              Full player page <ExternalLink className="h-3 w-3" />
            </Link>
          </TabsContent>

          <TabsContent value="awards" className="mt-3">
            {awardsLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : awards && awards.length > 0 ? (
              <ul className="space-y-2">
                {awards.map((a) => (
                  <li key={a.name} className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2">
                    <Award className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span className="text-sm">
                      <span className="font-semibold">{a.name}</span>
                      {a.years.length > 1 && <span className="text-muted-foreground"> ×{a.years.length}</span>}
                      {a.years.length > 0 && <span className="block text-xs text-muted-foreground">{a.years.join(", ")}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No major awards listed yet.</p>
            )}
          </TabsContent>

          <TabsContent value="contract" className="mt-3">
            {hasContract ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    ["Length", info.contract_years],
                    ["Total", info.contract_total],
                    ["Per year", info.contract_aav],
                    ["Through", info.contract_through],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-lg bg-muted px-3 py-2 text-center">
                      <div className="text-lg font-bold">{v || "—"}</div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">{k}</div>
                    </div>
                  ))}
                </div>
                {info.contract_notes && (
                  <p className="flex gap-2 text-sm text-muted-foreground">
                    <FileText className="mt-0.5 h-4 w-4 shrink-0" /> {info.contract_notes}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Contract details for {player.name} are coming soon.</p>
            )}
          </TabsContent>

          <TabsContent value="news" className="mt-3 space-y-2">
            {rumors && rumors.length > 0 ? (
              rumors.map((n) => (
                <div key={n.id} className="rounded-lg border border-border p-3">
                  <p className="text-sm font-semibold">{n.title}</p>
                  {n.player && <p className="text-xs text-primary">{n.player}</p>}
                  {n.details && <p className="mt-1 text-sm text-muted-foreground">{n.details}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">{n.time_ago}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No rumors or moves on {player.name} right now.</p>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ---- The section ----
const MetsRoster = () => {
  const [type, setType] = useState<"40Man" | "active">("40Man");
  const [group, setGroup] = useState<Group | "All">("All");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);

  const { data: roster, isLoading, isError } = useQuery({
    queryKey: ["mets-roster", type],
    staleTime: 10 * 60 * 1000,
    queryFn: () => fetchRoster(type),
  });

  const byName = useMemo(() => new Map((roster ?? []).map((p) => [p.name.toLowerCase(), p.id])), [roster]);
  const shown = useMemo(
    () =>
      (roster ?? [])
        .filter((p) => (group === "All" || p.group === group) && p.name.toLowerCase().includes(query.trim().toLowerCase()))
        .sort((a, b) => (Number(a.number) || 999) - (Number(b.number) || 999)),
    [roster, group, query],
  );
  const selected = roster?.find((p) => p.id === openId) ?? null;

  return (
    <section className="container mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8" aria-label="Mets roster">
      <h2 className="mb-1 flex items-center gap-2 font-display text-2xl font-bold uppercase tracking-wide sm:text-3xl">
        <Users className="h-7 w-7 text-primary" /> Mets Roster
      </h2>
      <p className="mb-6 text-sm text-muted-foreground">
        Tap a player for stats, awards, contract and the latest rumors.
      </p>

      <PlayerWatch onOpen={setOpenId} byName={byName} />
      <Rumors onOpen={setOpenId} byName={byName} />

      <div className="mb-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a player" className="h-10 pl-9" />
          </div>
          <div className="flex shrink-0 rounded-full border border-border p-0.5 text-sm">
            {([["40Man", "40-man"], ["active", "Active"]] as const).map(([v, l]) => (
              <button
                key={v}
                type="button"
                onClick={() => setType(v)}
                className={`rounded-full px-3 py-1.5 transition ${type === v ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
          {(["All", ...GROUPS] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGroup(g)}
              className={`shrink-0 rounded-full border px-4 py-1.5 text-sm transition ${group === g ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/60"}`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl sm:h-40" />
          ))}
        </div>
      ) : isError ? (
        <p className="text-sm text-muted-foreground">The roster couldn't load right now. Try again in a minute.</p>
      ) : shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {type === "active" && !roster?.length ? "The active roster is empty in the off-season. Switch to the 40-man." : "No players match."}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
          {shown.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setOpenId(p.id)}
              className="group flex items-center gap-3 rounded-xl border border-border bg-card p-2.5 text-left transition hover:border-primary/60 hover:shadow-md sm:flex-col sm:p-3 sm:text-center"
            >
              <img src={headshot(p.id)} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-full bg-muted object-cover sm:h-24 sm:w-24" />
              <span className="min-w-0 flex-1 sm:mt-2 sm:w-full sm:flex-none">
                <span className="block truncate font-semibold">{p.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {p.number && `#${p.number} · `}
                  {p.pos}
                </span>
                {statLine(p).length > 0 && (
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">{statLine(p).slice(0, 3).join(" · ")}</span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}

      <PlayerDialog player={selected} onClose={() => setOpenId(null)} />
    </section>
  );
};

export default MetsRoster;
