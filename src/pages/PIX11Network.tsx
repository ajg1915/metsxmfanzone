import { Calendar, Radio, Trophy } from "lucide-react";
import NetworkStreamPage, { type NetworkPageConfig } from "@/components/streaming/NetworkStreamPage";

const config: NetworkPageConfig = {
  pageKey: "pix11-network",
  route: "/pix11-network",
  seo: {
    title: "MetsXMFanZone Game Events - Live Non-Mets Games & Events",
    description: "Stream live game events on MetsXMFanZone - non-Mets games, special events and extra live sports coverage beyond the Mets.",
    keywords: "MetsXMFanZone game events, live game stream, non-Mets games, live sports events, extra games stream",
  },
  brand: { from: "#1e3a5f", to: "#0d2137", accent: "#ff5a1f" },
  mark: (
    <span className="block text-center text-sm font-black leading-tight text-white sm:text-xl">GAME<span className="block text-[#ff5a1f]">EVENTS</span></span>
  ),
  title: "MetsXMFanZone",
  titleAccent: "Game Events",
  tagline: "Live games and events beyond the Mets — non-Mets matchups, special broadcasts and extra sports coverage, streamed by MetsXMFanZone.",
  badges: ["Beyond the Mets", "HD Quality"],
  facts: ["New York, NY", "Live Event Coverage"],
  features: [
    { icon: Trophy, title: "Non-Mets Games", text: "Live matchups from around the league and beyond — the games that aren't Mets broadcasts." },
    { icon: Calendar, title: "Special Events", text: "One-off live broadcasts, fan events and special streams you won't find on the main channel." },
    { icon: Radio, title: "Extra Coverage", text: "Bonus live sports coverage streamed by MetsXMFanZone whenever big events are on." }
  ],
  player: { title: "MetsXMFanZone Game Events Live", description: "Watch live non-Mets games and special event broadcasts on MetsXMFanZone" },
};

const PIX11Network = () => <NetworkStreamPage cfg={config} />;

export default PIX11Network;
