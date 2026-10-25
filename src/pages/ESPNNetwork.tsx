import { Newspaper, Mic2, TrendingUp } from "lucide-react";
import NetworkStreamPage, { type NetworkPageConfig } from "@/components/streaming/NetworkStreamPage";

// The stream key (pageKey) stays the same on purpose: the player, the admin stream assignments and
// the live streams all use it. Only the names people see changed.
const config: NetworkPageConfig = {
  pageKey: "espn-network",
  route: "/prime-video",
  seo: {
    title: "Prime Video Live - Watch Mets & MLB Event Games | MetsXMFanZone",
    description: "Watch Mets game events live on Prime Video. Premium, included with every paid MetsXMFanZone plan.",
    keywords: "Prime Video, Amazon Prime Video, Prime Video baseball, Prime Video live stream, Mets event games, live baseball",
  },
  brand: { from: "#06202e", to: "#0b3a52", accent: "#38c6ff" },
  mark: (
    <span className="block text-center text-sm font-black leading-tight text-white sm:text-2xl">Prime Video</span>
  ),
  title: "Prime",
  titleAccent: "Video",
  tagline: "Mets game events stream live on this page. Premium, and included with every paid plan.",
  badges: ["Mets Game Events", "Premium"],
  facts: ["Live Game Events", "Included with Paid Plans"],
  notice: { title: "Mets game events stream on Prime Video", text: "Mets game events on Prime Video are a premium feature, included with every paid plan (Weekly, Monthly and Yearly). Free and trial members get a short preview." },
  features: [
    { icon: Newspaper, title: "Live Game Streams", text: "Watch event games live right here with the same player you already use." },
    { icon: Mic2, title: "Included With Paid Plans", text: "Premium Mets game events are included with Weekly, Monthly and Yearly plans." },
    { icon: TrendingUp, title: "Mets Game Events", text: "Mets game events stream here live, right in the same player you already use." }
  ],
  player: { title: "Prime Video Game Events", description: "Watch Mets game events on Prime Video live" },
};

const ESPNNetwork = () => <NetworkStreamPage cfg={config} />;

export default ESPNNetwork;
