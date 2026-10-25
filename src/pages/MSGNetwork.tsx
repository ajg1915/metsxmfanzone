import { Radio, Clock, Star } from "lucide-react";
import NetworkStreamPage, { type NetworkPageConfig } from "@/components/streaming/NetworkStreamPage";

// The stream key (pageKey) stays the same on purpose: the player, the admin stream assignments and
// the 24/7 streams all use it. Only the names people see changed.
const config: NetworkPageConfig = {
  pageKey: "msg-network",
  route: "/peacock",
  seo: {
    title: "Peacock Live - Watch Mets & MLB Event Games | MetsXMFanZone",
    description: "Watch Peacock event games live on MetsXMFanZone. The same games also stream on our 24/7 live streams.",
    keywords: "Peacock, Peacock baseball, Peacock live stream, Mets event games, live baseball",
  },
  brand: { from: "#12121c", to: "#2a2142", accent: "#ffc83d" },
  mark: (
    <span className="block text-center text-sm font-black leading-tight text-white sm:text-2xl">Peacock</span>
  ),
  title: "Peacock",
  titleAccent: "",
  tagline: "Event games stream live on this page. The same games also play on the MetsXMFanZone 24/7 live streams, so you can watch from either place.",
  badges: ["Event Games", "HD Quality"],
  facts: ["Live Games", "Also on the 24/7 Streams"],
  notice: { title: "Games stream on Peacock", text: "Event games for the Mets and your New York teams stream on this page. The same games also play on the MetsXMFanZone 24/7 live streams, so you can watch from either place." },
  features: [
    { icon: Radio, title: "Live Game Streams", text: "Watch event games live right here with the same player you already use." },
    { icon: Clock, title: "Also on the 24/7 Streams", text: "Every game on this page also plays on the MetsXMFanZone 24/7 live streams." },
    { icon: Star, title: "Event Games", text: "Special game events for the Mets and your New York teams show up here first." }
  ],
  player: { title: "Peacock Live", description: "Watch Peacock event games live" },
};

const MSGNetwork = () => <NetworkStreamPage cfg={config} />;

export default MSGNetwork;
