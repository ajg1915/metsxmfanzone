import { useParams, Navigate } from "react-router-dom";
import MatchupPage from "./MatchupPage";
import { metsData2026 } from "./metsRoster2026";
import { getOpponent } from "./opponentRegistry";
import springImage from "@/assets/spring-mets-yankees.jpg";

export default function DynamicMatchup() {
  const { opponent: slug } = useParams<{ opponent: string }>();
  const opponent = slug ? getOpponent(slug) : undefined;

  if (!opponent) {
    return <Navigate to="/mets-schedule-2026" replace />;
  }

  const anthonyPick = {
    pick: `Mets vs ${opponent.name} — see analysis`,
    confidence: 65,
    reasoning: opponent.rivalryNote,
    whereToBet: ["DraftKings", "FanDuel", "BetMGM", "Caesars"],
    recommendation: `Watch the moneyline movement leading up to first pitch — ${opponent.name} matchups always have value plays.`,
  };

  return (
    <MatchupPage
      opponent={{ ...opponent, logo: "" }}
      metsData={metsData2026}
      bettingLines={opponent.bettingLines}
      anthonyPick={anthonyPick}
      headToHead={opponent.headToHead}
      heroImage={springImage}
      matchupDate="2026 Season"
    />
  );
}
