import { useQuery } from "@tanstack/react-query";
import { LineupCardArt } from "@/components/lineup/LineupCardArt";
import { fetchMlbLineup, todayET, useLineupDesign, type MlbLineupResult } from "@/lib/lineupDesign";

/** The designed lineup card on the public site. Shows nothing until it is turned on in Admin > Lineup Card. */
export default function LineupCardShowcase() {
  const { data: design } = useLineupDesign();
  const override = design?.override && design.override.date === todayET() ? design.override : null;

  const { data: mlb } = useQuery<MlbLineupResult>({
    queryKey: ["lineup-card-mlb", todayET()],
    queryFn: () => fetchMlbLineup(todayET(), true),
    enabled: !!design?.enabled && !override,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  });

  if (!design?.enabled) return null;
  const game = override ? override.game : mlb?.game ?? null;
  const lineup = override ? override.lineup : mlb?.lineup ?? [];
  const pitcher = override ? override.pitcher : mlb?.pitcher ?? null;
  if (!game && lineup.length === 0) return null; // no game today

  return (
    <div className="mb-4 sm:mb-6">
      <LineupCardArt design={design} game={game} lineup={lineup} pitcher={pitcher} />
    </div>
  );
}
