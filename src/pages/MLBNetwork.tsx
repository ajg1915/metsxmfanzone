import { BarChart3, Trophy, Video } from "lucide-react";
import NetworkStreamPage, { type NetworkPageConfig } from "@/components/streaming/NetworkStreamPage";

const config: NetworkPageConfig = {
  pageKey: "mlb-network",
  route: "/mlb-network",
  seo: {
    title: "MLB Network Live - Watch Baseball Games & Analysis | MetsXMFanZone",
    description: "Watch MLB Network live games, highlights, and expert baseball analysis. Stream 24/7 MLB coverage featuring your favorite teams.",
    keywords: "MLB Network, live baseball, MLB live stream, baseball games live, MLB analysis, baseball coverage",
  },
  brand: { from: "#041E42", to: "#0a2d5c", accent: "#e0345f" },
  mark: (
    <span className="block text-lg font-black leading-none text-white sm:text-3xl">MLB<span className="mt-0.5 block rounded bg-white px-1 text-[7px] font-bold text-[#BF0D3E] sm:text-xs">NETWORK</span></span>
  ),
  title: "MLB",
  titleAccent: "Network",
  tagline: "Your 24/7 destination for live baseball coverage, expert analysis, and exclusive content from across Major League Baseball.",
  badges: ["Official MLB", "HD Quality"],
  facts: ["Nationwide", "24/7 Coverage"],
  features: [
    { icon: Trophy, title: "Live Games", text: "Watch live baseball games from across Major League Baseball with expert commentary." },
    { icon: BarChart3, title: "Expert Analysis", text: "In-depth analysis from former players and baseball experts breaking down every game." },
    { icon: Video, title: "Highlights", text: "Catch all the best plays, home runs, and defensive gems from around the league." }
  ],
  player: { title: "MLB Network Live", description: "Watch live baseball games and expert analysis" },
};

const MLBNetwork = () => <NetworkStreamPage cfg={config} />;

export default MLBNetwork;
