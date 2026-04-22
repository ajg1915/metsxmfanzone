import { Button } from "@/components/ui/button";
import { Share2 } from "lucide-react";
import { normalizeToBlogShareUrl } from "@/lib/blogLinks";

interface SocialShareButtonsProps {
  title?: string;
  url?: string;
}

export default function SocialShareButtons({ title, url }: SocialShareButtonsProps) {
  const baseUrl = url || window.location.href;
  const shareTitle = title || "Check this out on MetsXMFanZone!";

  // All blog article links are routed through the `blog-og-meta` Edge Function
  // first. The function uses the slug from the URL as the key to query
  // `blog_posts` and serves crawler-friendly OG/Twitter/JSON-LD tags before
  // redirecting human visitors to the real article.
  const shareUrl = normalizeToBlogShareUrl(baseUrl);

  const socialLinks = [
    {
      name: "TikTok",
      url: "https://tiktok.com/@metsxmfanzone",
      shareUrl: undefined as string | undefined,
      color: "hover:bg-[#000000]",
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
        </svg>
      )
    },
    {
      name: "Instagram",
      url: "https://www.instagram.com/metsxmfanzone",
      shareUrl: undefined as string | undefined,
      color: "hover:bg-gradient-to-r hover:from-[#833AB4] hover:via-[#FD1D1D] hover:to-[#F77737]",
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M7.8 2h8.4C19.4 2 22 4.6 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8C4.6 22 2 19.4 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2m-.2 2A3.6 3.6 0 0 0 4 7.6v8.8C4 18.39 5.61 20 7.6 20h8.8a3.6 3.6 0 0 0 3.6-3.6V7.6C20 5.61 18.39 4 16.4 4H7.6m9.65 1.5a1.25 1.25 0 0 1 1.25 1.25A1.25 1.25 0 0 1 17.25 8 1.25 1.25 0 0 1 16 6.75a1.25 1.25 0 0 1 1.25-1.25M12 7a5 5 0 0 1 5 5 5 5 0 0 1-5 5 5 5 0 0 1-5-5 5 5 0 0 1 5-5m0 2a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3z"/>
        </svg>
      )
    },
    {
      name: "X (Twitter)",
      url: "https://x.com/metsxmfanzone",
      shareUrl: `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareTitle)}`,
      color: "hover:bg-[#000000]",
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
      )
    },
    {
      name: "Facebook",
      url: "https://www.facebook.com/metsxmfanzoneofficial",
      shareUrl: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
      color: "hover:bg-[#1877F2]",
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
      )
    }
  ];

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      // You could add a toast notification here
      alert('Link copied to clipboard!');
    } catch (error) {
      console.log('Error copying:', error);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          url: shareUrl,
        });
      } catch (error) {
        console.log('Error sharing:', error);
        copyToClipboard();
      }
    } else {
      copyToClipboard();
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Share2 className="w-5 h-5 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">Follow & Share</span>
      </div>
      
      <div className="flex flex-wrap gap-3">
        {socialLinks.map((social) => (
          <Button
            key={social.name}
            variant="outline"
            size="sm"
            className={`transition-all ${social.color} hover:text-white`}
            onClick={() => window.open(social.shareUrl || social.url, '_blank')}
          >
            {social.icon}
            <span className="ml-2">{social.name}</span>
          </Button>
        ))}
        
        <Button
          variant="outline"
          size="sm"
          onClick={handleShare}
          className="hover:bg-primary hover:text-primary-foreground"
        >
          <Share2 className="w-4 h-4 mr-2" />
          Share
        </Button>
      </div>
    </div>
  );
}
