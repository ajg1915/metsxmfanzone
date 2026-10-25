import { Trophy, Video, BarChart3 } from "lucide-react";
import NetworkStreamPage, { type NetworkPageConfig } from "@/components/streaming/NetworkStreamPage";

// The stream key (pageKey) stays the same on purpose: the player, the admin stream assignments and
// the live streams all use it. Only the names people see changed.
const config: NetworkPageConfig = {
  pageKey: "mlb-network",
  route: "/apple-tv",
  seo: {
    title: "Apple TV Live - Watch Mets & MLB Event Games | MetsXMFanZone",
    description: "Watch Mets game events live on Apple TV. Premium, included with every paid MetsXMFanZone plan.",
    keywords: "Apple TV, Apple TV baseball, Apple TV live stream, Mets event games, live baseball",
  },
  brand: { from: "#0b1020", to: "#1d2740", accent: "#9fb4ff" },
  mark: (
    <span className="block text-center text-sm font-black leading-tight text-white sm:text-2xl">Apple TV</span>
  ),
  title: "Apple",
  titleAccent: "TV",
  tagline: "Mets game events stream live on this page. Premium, and included with every paid plan.",
  badges: ["Mets Game Events", "Premium"],
  facts: ["Live Game Events", "Included with Paid Plans"],
  notice: { title: "Mets game events stream on Apple TV", text: "Mets game events on Apple TV are a premium feature, included with every paid plan (Weekly, Monthly and Yearly). Free and trial members get a short preview." },
  features: [
    { icon: Trophy, title: "Live Game Streams", text: "Watch event games live right here with the same player you already use." },
    { icon: Video, title: "Included With Paid Plans", text: "Premium Mets game events are included with Weekly, Monthly and Yearly plans." },
    { icon: BarChart3, title: "Mets Game Events", text: "Mets game events stream here live, right in the same player you already use." }
  ],
  player: { title: "Apple TV Game Events", description: "Watch Mets game events on Apple TV live" },
};

const MLBNetwork = () => <NetworkStreamPage cfg={config} />;

export default MLBNetwork;
