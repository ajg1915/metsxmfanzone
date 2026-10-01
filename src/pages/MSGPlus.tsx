import NetworkStreamPage, { type NetworkPageConfig } from "@/components/streaming/NetworkStreamPage";

const config: NetworkPageConfig = {
  pageKey: "msg-plus",
  route: "/msg-plus",
  seo: {
    title: "MSG Plus Live - Watch Mets Baseball Coverage | MetsXMFanZone",
    description: "Watch MSG Plus live Mets baseball coverage, pre-game and post-game shows on MetsXMFanZone.",
    keywords: "MSG Plus, MSG+, MSG Plus live, Mets coverage, live baseball",
  },
  brand: { from: "#003DA5", to: "#002D72", accent: "#F4A100" },
  mark: (
    <span className="text-2xl font-black leading-none tracking-tight text-white sm:text-4xl">MSG+</span>
  ),
  title: "MSG",
  titleAccent: "Plus",
  tagline: "Your alternate MSG feed — additional Mets and NY sports coverage, live and on-demand.",
  badges: ["NY Sports", "HD Quality"],
  facts: ["New York", "Game Day Coverage"],
  features: [
    
  ],
  player: { title: "MSG Plus", description: "Watch MSG Plus live Mets baseball coverage" },
};

const MSGPlus = () => <NetworkStreamPage cfg={config} />;

export default MSGPlus;
