import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Share2, Link2, Check, Twitter, Facebook, Linkedin, MessageCircle, Send, Mail, Smartphone } from "lucide-react";

interface BlogShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  url: string;
  excerpt?: string;
  image?: string;
}

export const BlogShareDialog = ({ open, onOpenChange, title, url, excerpt, image }: BlogShareDialogProps) => {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  const encodedText = encodeURIComponent(excerpt || title);

  const canNativeShare = typeof navigator !== "undefined" && !!navigator.share;

  const handleNativeShare = async () => {
    try {
      await navigator.share({ title, text: excerpt || title, url });
      onOpenChange(false);
    } catch (err) {
      // user cancelled or unsupported
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast({ title: "Link copied!", description: "Share it anywhere you like." });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Couldn't copy link", variant: "destructive" });
    }
  };

  const platforms = [
    { name: "X", icon: Twitter, url: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`, color: "bg-black hover:bg-black/80 text-white" },
    { name: "Facebook", icon: Facebook, url: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, color: "bg-[#1877F2] hover:bg-[#1877F2]/90 text-white" },
    { name: "LinkedIn", icon: Linkedin, url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`, color: "bg-[#0A66C2] hover:bg-[#0A66C2]/90 text-white" },
    { name: "WhatsApp", icon: MessageCircle, url: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`, color: "bg-[#25D366] hover:bg-[#25D366]/90 text-white" },
    { name: "Telegram", icon: Send, url: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`, color: "bg-[#229ED9] hover:bg-[#229ED9]/90 text-white" },
    { name: "Email", icon: Mail, url: `mailto:?subject=${encodedTitle}&body=${encodedText}%0A%0A${encodedUrl}`, color: "bg-muted hover:bg-muted/80 text-foreground" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card/95 backdrop-blur-xl border-border/50">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-primary" />
            Share this article
          </DialogTitle>
          <DialogDescription className="line-clamp-2">{title}</DialogDescription>
        </DialogHeader>

        {/* Preview card */}
        <div className="rounded-xl overflow-hidden border border-border/50 bg-background/50">
          {image && (
            <div className="aspect-[16/9] w-full overflow-hidden bg-muted">
              <img src={image} alt={title} className="w-full h-full object-cover" loading="lazy" />
            </div>
          )}
          <div className="p-3">
            <p className="text-sm font-semibold line-clamp-2">{title}</p>
            <p className="text-xs text-muted-foreground truncate mt-1">{url.replace(/^https?:\/\//, "")}</p>
          </div>
        </div>

        {/* Native share (mobile) */}
        {canNativeShare && (
          <Button onClick={handleNativeShare} className="w-full gap-2" size="lg">
            <Smartphone className="w-4 h-4" />
            Share via device
          </Button>
        )}

        {/* Platform grid */}
        <div className="grid grid-cols-3 gap-2">
          {platforms.map((p) => (
            <a
              key={p.name}
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all hover:scale-105 ${p.color}`}
            >
              <p.icon className="w-5 h-5" />
              <span className="text-xs font-medium">{p.name}</span>
            </a>
          ))}
        </div>

        {/* Copy link */}
        <div className="flex items-center gap-2 p-2 rounded-xl border border-border/50 bg-background/50">
          <Link2 className="w-4 h-4 text-muted-foreground ml-2 shrink-0" />
          <span className="flex-1 text-xs text-muted-foreground truncate">{url}</span>
          <Button size="sm" variant={copied ? "default" : "secondary"} onClick={handleCopy} className="gap-1.5">
            {copied ? <><Check className="w-3.5 h-3.5" /> Copied</> : <>Copy</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BlogShareDialog;
