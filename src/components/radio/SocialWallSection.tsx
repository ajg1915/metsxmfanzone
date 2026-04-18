import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Facebook, Instagram, Twitter, ExternalLink, Share2 } from "lucide-react";

const TikTokIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.71a8.21 8.21 0 0 0 4.76 1.51v-3.45a4.85 4.85 0 0 1-1-.08z" />
  </svg>
);

const socials = [
  {
    name: "Facebook",
    Icon: Facebook,
    url: "https://www.facebook.com/metsxmfanzoneofficial",
    handle: "@metsxmfanzoneofficial",
    color: "from-blue-600 to-blue-700",
  },
  {
    name: "Instagram",
    Icon: Instagram,
    url: "https://www.instagram.com/metsxmfanzone",
    handle: "@metsxmfanzone",
    color: "from-purple-500 via-pink-500 to-orange-500",
  },
  {
    name: "X (Twitter)",
    Icon: Twitter,
    url: "https://twitter.com/metsxmfanzone",
    handle: "@metsxmfanzone",
    color: "from-zinc-700 to-zinc-900",
  },
  {
    name: "TikTok",
    Icon: TikTokIcon,
    url: "https://www.tiktok.com/@metsxmfanzone",
    handle: "@metsxmfanzone",
    color: "from-zinc-700 to-zinc-900",
  },
];

export function SocialWallSection() {
  return (
    <Card className="p-4 bg-card/50 backdrop-blur-sm border-border">
      <div className="flex items-center gap-2 mb-3">
        <Share2 className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm">Follow the Network</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Catch every post, clip, and behind-the-scenes moment on social.
      </p>

      <div className="grid grid-cols-2 gap-2">
        {socials.map(({ name, Icon, url, handle, color }) => (
          <a
            key={name}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={`group relative overflow-hidden rounded-lg bg-gradient-to-br ${color} p-3 text-white transition-transform hover:scale-[1.02]`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Icon className="w-4 h-4" />
              <span className="text-xs font-bold">{name}</span>
            </div>
            <p className="text-[10px] opacity-90 truncate">{handle}</p>
            <ExternalLink className="absolute top-2 right-2 w-3 h-3 opacity-60 group-hover:opacity-100" />
          </a>
        ))}
      </div>

      <Button asChild variant="outline" size="sm" className="w-full mt-3 h-8 text-xs">
        <a
          href="https://www.facebook.com/metsxmfanzoneofficial"
          target="_blank"
          rel="noopener noreferrer"
        >
          View Latest Posts
        </a>
      </Button>
    </Card>
  );
}
