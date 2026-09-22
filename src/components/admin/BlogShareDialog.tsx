import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { getBlogShareUrl } from "@/lib/blogLinks";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Facebook, Instagram, Twitter, Share2, Loader2, Copy, Link2, Send } from "lucide-react";

interface BlogShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  post: {
    id: string;
    title: string;
    slug: string;
    excerpt?: string | null;
    featured_image_url?: string | null;
  } | null;
}

interface SocialConnection {
  platform: string;
  page_name: string | null;
  account_username: string | null;
}

export default function BlogShareDialog({ open, onOpenChange, post }: BlogShareDialogProps) {
  const { toast } = useToast();
  const [connections, setConnections] = useState<SocialConnection[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [caption, setCaption] = useState("");
  const [posting, setPosting] = useState(false);
  const [loading, setLoading] = useState(false);

  const shareUrl = post ? getBlogShareUrl(post.slug) : "";

  useEffect(() => {
    if (!open || !post) return;
    setCaption(`${post.title}\n\n${post.excerpt || ""}\n\n${getBlogShareUrl(post.slug)}`.replace(/\n{3,}/g, "\n\n"));
    setSelected([]);
    setLoading(true);
    supabase
      .from("social_media_connections")
      .select("platform, page_name, account_username")
      .eq("status", "active")
      .then(({ data }) => {
        setConnections((data as SocialConnection[]) || []);
        setLoading(false);
      });
  }, [open, post]);

  const toggle = (p: string) =>
    setSelected((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));

  const icon = (platform: string) => {
    switch (platform) {
      case "facebook": return <Facebook className="w-4 h-4" />;
      case "instagram": return <Instagram className="w-4 h-4" />;
      case "twitter": return <Twitter className="w-4 h-4" />;
      default: return <Share2 className="w-4 h-4" />;
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({ title: "Link copied" });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const nativeShare = async () => {
    if (!post) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: post.title, text: post.excerpt || post.title, url: shareUrl });
      } catch { /* cancelled */ }
    } else {
      copyLink();
    }
  };

  const openIntent = (kind: "facebook" | "twitter" | "whatsapp" | "email") => {
    if (!post) return;
    const u = encodeURIComponent(shareUrl);
    const t = encodeURIComponent(post.title);
    const map = {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
      twitter: `https://twitter.com/intent/tweet?url=${u}&text=${t}`,
      whatsapp: `https://api.whatsapp.com/send?text=${t}%20${u}`,
      email: `mailto:?subject=${t}&body=${u}`,
    };
    window.open(map[kind], "_blank", "noopener,noreferrer");
  };

  const postToAccounts = async () => {
    if (!post || selected.length === 0) return;
    setPosting(true);
    let ok = 0;
    let failed = 0;
    let firstError = "";

    for (const platform of selected) {
      try {
        const { data: conn } = await supabase
          .from("social_media_connections")
          .select("access_token, page_id")
          .eq("platform", platform)
          .maybeSingle();
        if (!conn) { failed++; firstError ||= "No connection found"; continue; }

        let body: Record<string, unknown> = {
          imageUrl: post.featured_image_url || "",
          caption,
          linkUrl: shareUrl,
        };
        if (platform === "facebook") {
          body.pageId = conn.page_id;
          body.accessToken = conn.access_token;
        } else if (platform === "instagram") {
          body.instagramAccountId = conn.page_id;
          body.accessToken = conn.access_token;
        } else if (platform === "twitter") {
          try { body = { ...body, ...JSON.parse(conn.access_token as string) }; } catch { /* ignore */ }
        }

        const { data, error } = await supabase.functions.invoke(`post-to-${platform}`, { body });
        if (error || (data as any)?.error) {
          failed++;
          firstError ||= (data as any)?.error || error?.message || "Failed";
          continue;
        }
        ok++;
        await supabase.from("social_media_posts").insert({
          platform,
          external_post_id: (data as any)?.postId ?? null,
          external_post_url: (data as any)?.postUrl ?? null,
          caption,
          status: "posted",
          posted_at: new Date().toISOString(),
        } as any);
      } catch (e: unknown) {
        failed++;
        firstError ||= e instanceof Error ? e.message : "Unknown error";
      }
    }

    setPosting(false);
    if (ok && !failed) {
      toast({ title: "Shared", description: `Posted to ${ok} account(s)` });
      onOpenChange(false);
    } else if (ok) {
      toast({ title: "Partly shared", description: `${ok} posted, ${failed} failed` });
    } else {
      toast({ title: "Could not share", description: firstError, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-md grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-h-[calc(100dvh-2rem)]">
        <DialogHeader className="border-b border-border/40 px-4 py-3 pr-11 text-left sm:px-5 sm:py-4">
          <DialogTitle className="text-base flex items-center gap-2">
            <Share2 className="w-4 h-4" /> Share article
          </DialogTitle>
          <DialogDescription className="line-clamp-2 break-words text-[11px] leading-4">{post?.title}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          <div className="rounded-md border border-border/40 p-2 flex items-center gap-2">
            <Link2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className="text-[11px] truncate flex-1">{shareUrl}</span>
            <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={copyLink}>
              <Copy className="w-3.5 h-3.5" />
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
            <Button type="button" variant="outline" size="sm" className="h-9 text-xs" onClick={nativeShare}>
              <Share2 className="w-3.5 h-3.5 mr-1.5" /> Share sheet
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-9 text-xs" onClick={() => openIntent("facebook")}>
              <Facebook className="w-3.5 h-3.5 mr-1.5" /> Facebook
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-9 text-xs" onClick={() => openIntent("twitter")}>
              <Twitter className="w-3.5 h-3.5 mr-1.5" /> X / Twitter
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-9 text-xs" onClick={() => openIntent("whatsapp")}>
              <Send className="w-3.5 h-3.5 mr-1.5" /> WhatsApp
            </Button>
          </div>

          <div>
            <Label className="text-[11px]">Caption</Label>
            <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={4} className="text-xs mt-1" />
          </div>

          <div>
            <Label className="text-[11px]">Post to your connected accounts</Label>
            {loading ? (
              <p className="text-[11px] text-muted-foreground mt-2">Loading…</p>
            ) : connections.length === 0 ? (
              <p className="text-[11px] text-muted-foreground mt-2">
                No connected accounts yet — connect them in Settings → Social Media.
              </p>
            ) : (
              <div className="space-y-1.5 mt-2">
                {connections.map((c) => (
                  <button
                    type="button"
                    key={c.platform}
                    onClick={() => toggle(c.platform)}
                    className="w-full flex items-center gap-3 p-2 rounded-lg border border-border/40 hover:bg-muted/40 text-left"
                  >
                    <Checkbox checked={selected.includes(c.platform)} />
                    {icon(c.platform)}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium capitalize">{c.platform}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {c.page_name || c.account_username || "Connected"}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t border-border/40 bg-background px-4 py-3 sm:px-5">
          <Button variant="outline" size="sm" className="h-9 text-xs" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button size="sm" className="h-9 text-xs" onClick={postToAccounts} disabled={posting || selected.length === 0}>
            {posting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Share2 className="w-3.5 h-3.5 mr-1.5" />}
            {posting ? "Posting…" : "Post now"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
