import { Radio, Clock, Star } from "lucide-react";
import NetworkStreamPage, { type NetworkPageConfig } from "@/components/streaming/NetworkStreamPage";

// The stream key (pageKey) stays the same on purpose: the player, the admin stream assignments and
// the live streams all use it. Only the names people see changed.
const config: NetworkPageConfig = {
  pageKey: "msg-network",
  route: "/peacock",
  seo: {
    title: "Peacock Live - Watch Mets & MLB Event Games | MetsXMFanZone",
    description: "Watch Mets game events live on Peacock. Premium, included with every paid MetsXMFanZone plan.",
    keywords: "Peacock, Peacock baseball, Peacock live stream, Mets event games, live baseball",
  },
  brand: { from: "#12121c", to: "#2a2142", accent: "#ffc83d" },
  mark: (
    <span className="block text-center text-sm font-black leading-tight text-white sm:text-2xl">Peacock</span>
  ),
  title: "Peacock",
  titleAccent: "",
  tagline: "Mets game events stream live on this page. Premium, and included with every paid plan.",
  badges: ["Mets Game Events", "Premium"],
  facts: ["Live Game Events", "Included with Paid Plans"],
  notice: { title: "Mets game events stream on Peacock", text: "Mets game events on Peacock are a premium feature, included with every paid plan (Weekly, Monthly and Yearly). Free and trial members get a short preview." },
  features: [
    { icon: Radio, title: "Live Game Streams", text: "Watch event games live right here with the same player you already use." },
    { icon: Clock, title: "Included With Paid Plans", text: "Premium Mets game events are included with Weekly, Monthly and Yearly plans." },
    { icon: Star, title: "Mets Game Events", text: "Mets game events stream here live, right in the same player you already use." }
  ],
  player: { title: "Peacock Game Events", description: "Watch Mets game events on Peacock live" },
};

const MSGNetwork = () => <NetworkStreamPage cfg={config} />;

export default MSGNetwork;
