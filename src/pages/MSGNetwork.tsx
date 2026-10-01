import { Clock, Radio, Star } from "lucide-react";
import NetworkStreamPage, { type NetworkPageConfig } from "@/components/streaming/NetworkStreamPage";

const config: NetworkPageConfig = {
  pageKey: "msg-network",
  route: "/msg-network",
  seo: {
    title: "MSG Network Live - Watch Mets Baseball Coverage | MetsXMFanZone",
    description: "Watch MSG Network live Mets baseball coverage, pre-game and post-game shows, and exclusive behind-the-scenes content. Stream MSG Network on MetsXMFanZone.",
    keywords: "MSG network, MSG baseball, MSG live stream, Mets coverage, New York sports, live baseball, MSG sports",
  },
  brand: { from: "#003DA5", to: "#002D72", accent: "#F4A100" },
  mark: (
    <span className="text-2xl font-black leading-none tracking-tight text-white sm:text-4xl">MSG</span>
  ),
  title: "MSG",
  titleAccent: "Network",
  tagline: "Your home for New York Mets baseball. Watch live game broadcasts, pre-game and post-game coverage, and exclusive behind-the-scenes content.",
  badges: ["NY Sports", "HD Quality"],
  facts: ["New York", "Game Day Coverage"],
  features: [
    { icon: Radio, title: "Live Game Broadcasts", text: "Full live coverage of Mets games with professional play-by-play and color commentary." },
    { icon: Clock, title: "Pre & Post Game", text: "In-depth pre-game analysis and post-game breakdowns with expert hosts and analysts." },
    { icon: Star, title: "Exclusive Content", text: "Behind-the-scenes access, player interviews, and exclusive Mets features you won't find anywhere else." }
  ],
  player: { title: "MSG Network", description: "Watch MSG Network live Mets baseball coverage" },
};

const MSGNetwork = () => <NetworkStreamPage cfg={config} />;

export default MSGNetwork;
