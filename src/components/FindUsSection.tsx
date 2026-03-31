import { Facebook, Instagram, Twitter, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";
import GlassCard from "@/components/GlassCard";

const TikTokIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.71a8.21 8.21 0 0 0 4.76 1.51v-3.45a4.85 4.85 0 0 1-1-.08z"/>
  </svg>
);

const socials = [
  {
    name: "Facebook",
    icon: Facebook,
    url: "https://www.facebook.com/metsxmfanzoneofficial",
    color: "from-blue-600 to-blue-700",
    handle: "@metsxmfanzoneofficial",
  },
  {
    name: "Instagram",
    icon: Instagram,
    url: "https://www.instagram.com/metsxmfanzone",
    color: "from-purple-500 via-pink-500 to-orange-500",
    handle: "@metsxmfanzone",
  },
  {
    name: "X (Twitter)",
    icon: Twitter,
    url: "https://twitter.com/metsxmfanzone",
    color: "from-black to-black",
    handle: "@metsxmfanzone",
  },
  {
    name: "TikTok",
    icon: TikTokIcon,
    url: "https://www.tiktok.com/@metsxmfanzone",
    color: "from-black to-black",
    handle: "@metsxmfanzone",
  },
];

const FindUsSection = () => {
  return (
    <section className="py-10 sm:py-12 md:py-16 relative overflow-hidden">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl relative z-10">
        <GlassCard variant="default" glow="blue" className="overflow-hidden">
          <div className="p-6 sm:p-8 md:p-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-8"
            >
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-3">
                Find Us On Social Media
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
                Stay connected with MetsXMFanZone across all platforms for the latest news, highlights, and community content.
              </p>
            </motion.div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {socials.map((social, index) => {
                const IconComponent = social.icon;
                return (
                  <motion.a
                    key={social.name}
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    whileHover={{ scale: 1.05 }}
                    className="group text-center p-5 rounded-xl glass-card hover:border-primary/40 transition-all cursor-pointer"
                  >
                    <div className={`inline-flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-r ${social.color} mb-3`}>
                      <IconComponent className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="font-semibold mb-1">{social.name}</h3>
                    <p className="text-xs text-muted-foreground mb-3">{social.handle}</p>
                    <span className="inline-flex items-center gap-1 text-xs text-primary group-hover:underline">
                      <ExternalLink className="w-3 h-3" />
                      Follow Us
                    </span>
                  </motion.a>
                );
              })}
            </div>
          </div>
        </GlassCard>
      </div>
    </section>
  );
};

export default FindUsSection;
