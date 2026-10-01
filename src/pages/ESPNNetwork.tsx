import { Mic2, Newspaper, TrendingUp } from "lucide-react";
import NetworkStreamPage, { type NetworkPageConfig } from "@/components/streaming/NetworkStreamPage";

const config: NetworkPageConfig = {
  pageKey: "espn-network",
  route: "/espn-network",
  seo: {
    title: "ESPN Network Live - Watch ESPN Baseball Coverage | MetsXMFanZone",
    description: "Watch ESPN Network live baseball coverage, game analysis, and expert commentary. Stream ESPN content 24/7 on MetsXMFanZone.",
    keywords: "ESPN network, ESPN baseball, ESPN live stream, baseball coverage, sports network, live baseball",
  },
  brand: { from: "#CC0000", to: "#8B0000", accent: "#ff5a5a" },
  mark: (
    <span className="text-2xl font-black italic leading-none tracking-tight text-white sm:text-4xl">ESPN</span>
  ),
  title: "ESPN",
  titleAccent: "Network",
  tagline: "The worldwide leader in sports. Watch live baseball coverage, breaking news, and expert analysis from the most trusted name in sports.",
  badges: ["Sports Leader", "HD Quality"],
  facts: ["Worldwide", "24/7 Sports"],
  features: [
    { icon: Newspaper, title: "Breaking News", text: "Stay updated with the latest breaking news from across Major League Baseball." },
    { icon: Mic2, title: "Expert Commentary", text: "Insights from ESPN's team of expert analysts and former players." },
    { icon: TrendingUp, title: "Stats & Trends", text: "Deep statistical analysis and trending topics from around the league." }
  ],
  player: { title: "ESPN Network", description: "Watch ESPN Network live baseball coverage and analysis" },
};

const ESPNNetwork = () => <NetworkStreamPage cfg={config} />;

export default ESPNNetwork;
