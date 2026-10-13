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
import { Facebook, Instagram, Twitter, Share2, Loader2, Copy, Link2, Send, Check } from "lucide-react";

interface BlogShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Shows the "Published" header, for right after an article goes live. */
  justPublished?: boolean;
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

export default function BlogShareDialog({ open, onOpenChange, post, justPublished = false }: BlogShareDialogProps) {
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

  const copyCaption = async (where?: string) => {
    try {
      await navigator.clipboard.writeText(caption);
      toast({
        title: "Caption copied",
        description: where ? `Paste it in ${where} with the cover image.` : undefined,
      });
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

  const tile =
    "min-h-[52px] rounded-xl border border-white/15 bg-[#14223F] px-3 text-[15px] font-bold text-white hover:bg-[#1b2d52] active:bg-[#1b2d52]";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-md grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-2xl border-white/15 bg-[#0B1730] p-0 text-white sm:max-h-[calc(100dvh-2rem)]">
        <DialogHeader className="space-y-1 border-b border-white/10 px-4 py-4 pr-12 text-left">
          <DialogTitle className="flex items-center gap-2 text-[22px] font-extrabold">
            {justPublished ? (
              <>
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-800 text-emerald-100">
                  <Check className="h-5 w-5" />
                </span>
                Published
              </>
            ) : (
              <>
                <Share2 className="h-5 w-5" /> Share article
              </>
            )}
          </DialogTitle>
          <DialogDescription className="line-clamp-2 break-words text-[14px] leading-snug text-slate-300">
            {justPublished ? `${post?.title} is live and subscribers got the alert.` : post?.title}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 space-y-5 overflow-y-auto overscroll-contain px-4 py-4">
          <div className="space-y-2">
            <p className="text-[12px] font-extrabold tracking-wider text-[#FF9A6B]">ARTICLE LINK</p>
            <div className="flex gap-2">
              <div className="flex min-h-[52px] min-w-0 flex-1 items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-3">
                <Link2 className="h-4 w-4 shrink-0 text-slate-300" />
                <span className="truncate text-[14px]">{shareUrl.replace(/^https?:\/\//, "")}</span>
              </div>
              <button type="button" onClick={copyLink} className="min-h-[52px] shrink-0 rounded-xl bg-[#FF5910] px-5 text-[15px] font-extrabold text-[#0B1730] active:opacity-90">
                Copy
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[12px] font-extrabold tracking-wider text-[#FF9A6B]">SHARE TO</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className={tile} onClick={() => openIntent("facebook")}>
                <Facebook className="mr-1.5 inline h-4 w-4" /> Facebook
              </button>
              <button type="button" className={tile} onClick={() => openIntent("twitter")}>
                <Twitter className="mr-1.5 inline h-4 w-4" /> X
              </button>
              <button type="button" className={tile} onClick={() => copyCaption("Instagram")}>
                <Instagram className="mr-1.5 inline h-4 w-4" /> Instagram
              </button>
              <button type="button" className={tile} onClick={() => copyCaption("TikTok")}>
                <Share2 className="mr-1.5 inline h-4 w-4" /> TikTok
              </button>
              <button type="button" className={tile} onClick={() => openIntent("whatsapp")}>
                <Send className="mr-1.5 inline h-4 w-4" /> WhatsApp
              </button>
              <button type="button" className={tile} onClick={nativeShare}>
                <Share2 className="mr-1.5 inline h-4 w-4" /> Share sheet
              </button>
            </div>
            <p className="text-[12px] text-slate-300">Instagram and TikTok copy the caption so you can paste it in the app.</p>
          </div>

          <div className="space-y-2">
            <p className="text-[12px] font-extrabold tracking-wider text-[#FF9A6B]">READY-TO-POST CAPTION</p>
            <Textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={5}
              className="rounded-xl border-white/20 bg-white/5 text-[15px] leading-snug text-white"
            />
            <button type="button" onClick={() => copyCaption()} className="min-h-11 w-full rounded-xl border border-white/25 text-[14px] font-bold text-white active:bg-white/10">
              Copy caption
            </button>
          </div>

          <div className="space-y-2">
            <p className="text-[12px] font-extrabold tracking-wider text-[#FF9A6B]">POST TO YOUR CONNECTED ACCOUNTS</p>
            {loading ? (
              <p className="text-[13px] text-slate-300">Loading…</p>
            ) : connections.length === 0 ? (
              <p className="text-[13px] text-slate-300">No connected accounts yet. Connect them in Settings, Social Media.</p>
            ) : (
              <div className="space-y-2">
                {connections.map((c) => (
                  <button
                    type="button"
                    key={c.platform}
                    onClick={() => toggle(c.platform)}
                    className="flex min-h-[52px] w-full items-center gap-3 rounded-xl border border-white/15 bg-[#14223F] px-3 text-left"
                  >
                    <Checkbox checked={selected.includes(c.platform)} />
                    {icon(c.platform)}
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-bold capitalize">{c.platform}</p>
                      <p className="truncate text-[12px] text-slate-300">{c.page_name || c.account_username || "Connected"}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="shrink-0 flex-row gap-2 border-t border-white/10 bg-[#0E1C43] px-4 py-3 sm:space-x-0">
          <button type="button" onClick={() => onOpenChange(false)} className="min-h-[52px] flex-1 rounded-xl border border-white/25 text-[15px] font-bold text-white active:bg-white/10">
            {justPublished ? "Back to Drafts" : "Close"}
          </button>
          <button
            type="button"
            onClick={postToAccounts}
            disabled={posting || selected.length === 0}
            className="min-h-[52px] flex-1 rounded-xl bg-[#FF5910] text-[16px] font-extrabold text-[#0B1730] active:opacity-90 disabled:opacity-40"
          >
            {posting ? "Posting…" : "Post now"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
