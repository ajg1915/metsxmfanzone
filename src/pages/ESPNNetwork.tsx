import { Newspaper, Mic2, TrendingUp } from "lucide-react";
import NetworkStreamPage, { type NetworkPageConfig } from "@/components/streaming/NetworkStreamPage";

// The stream key (pageKey) stays the same on purpose: the player, the admin stream assignments and
// the 24/7 streams all use it. Only the names people see changed.
const config: NetworkPageConfig = {
  pageKey: "espn-network",
  route: "/prime-video",
  seo: {
    title: "Prime Video Live - Watch Mets & MLB Event Games | MetsXMFanZone",
    description: "Watch Prime Video event games live on MetsXMFanZone. The same games also stream on our 24/7 live streams.",
    keywords: "Prime Video, Amazon Prime Video, Prime Video baseball, Prime Video live stream, Mets event games, live baseball",
  },
  brand: { from: "#06202e", to: "#0b3a52", accent: "#38c6ff" },
  mark: (
    <span className="block text-center text-sm font-black leading-tight text-white sm:text-2xl">Prime Video</span>
  ),
  title: "Prime",
  titleAccent: "Video",
  tagline: "Event games stream live on this page. The same games also play on the MetsXMFanZone 24/7 live streams, so you can watch from either place.",
  badges: ["Event Games", "HD Quality"],
  facts: ["Live Games", "Also on the 24/7 Streams"],
  notice: { title: "Games stream on Prime Video", text: "Event games for the Mets and your New York teams stream on this page. The same games also play on the MetsXMFanZone 24/7 live streams, so you can watch from either place." },
  features: [
    { icon: Newspaper, title: "Live Game Streams", text: "Watch event games live right here with the same player you already use." },
    { icon: Mic2, title: "Also on the 24/7 Streams", text: "Every game on this page also plays on the MetsXMFanZone 24/7 live streams." },
    { icon: TrendingUp, title: "Event Games", text: "Special game events for the Mets and your New York teams show up here first." }
  ],
  player: { title: "Prime Video Live", description: "Watch Prime Video event games live" },
};

const ESPNNetwork = () => <NetworkStreamPage cfg={config} />;

export default ESPNNetwork;
