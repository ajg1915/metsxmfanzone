import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Smartphone, Tablet, Monitor, CloudUpload, Loader2 } from "lucide-react";
import ArticleBody from "@/components/blog/ArticleBody";
import { cn } from "@/lib/utils";

type Device = "phone" | "tablet" | "desktop";
const WIDTHS: Record<Device, number> = { phone: 390, tablet: 820, desktop: 1200 };

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  category: string;
  content: string;
  featuredImage?: string;
  readMinutes: number;
  onPublish: () => void;
  publishing?: boolean;
  canPublish?: boolean;
}

export default function ArticlePreviewDialog({
  open, onOpenChange, title, category, content, featuredImage, readMinutes, onPublish, publishing, canPublish = true,
}: Props) {
  const [device, setDevice] = useState<Device>("phone");
  const devices: { key: Device; label: string; Icon: typeof Smartphone }[] = [
    { key: "phone", label: "Phone", Icon: Smartphone },
    { key: "tablet", label: "Tablet", Icon: Tablet },
    { key: "desktop", label: "Computer", Icon: Monitor },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(1280px,98vw)] w-[98vw] h-[94vh] p-0 flex flex-col gap-0 overflow-hidden">
        <DialogHeader className="px-3 py-2 border-b border-border/40 space-y-0">
          <div className="flex items-center gap-2 flex-wrap pr-8">
            <DialogTitle className="text-sm">Preview</DialogTitle>
            <div className="flex rounded-md border border-border/50 p-0.5">
              {devices.map(({ key, label, Icon }) => (
                <Button
                  key={key}
                  type="button"
                  size="sm"
                  variant={device === key ? "default" : "ghost"}
                  className="h-7 px-2 text-xs"
                  onClick={() => setDevice(key)}
                >
                  <Icon className="w-3.5 h-3.5 sm:mr-1" />
                  <span className="hidden sm:inline">{label}</span>
                </Button>
              ))}
            </div>
            <Button size="sm" className="h-7 text-xs ml-auto" onClick={onPublish} disabled={publishing || !canPublish}>
              {publishing ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <CloudUpload className="w-3.5 h-3.5 mr-1" />}
              Looks good — Publish
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto bg-muted/30 p-3 sm:p-6">
          <div
            className={cn(
              "mx-auto bg-background shadow-xl transition-all duration-300 overflow-hidden",
              device === "desktop" ? "rounded-md" : "rounded-[1.5rem] border-4 border-border",
            )}
            style={{ width: "100%", maxWidth: WIDTHS[device] }}
          >
            <article className={cn(device === "phone" ? "p-4" : device === "tablet" ? "p-6" : "p-10")}>
              {featuredImage && (
                <img src={featuredImage} alt="" className="w-full aspect-video object-cover rounded-lg mb-4" />
              )}
              <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-1">{category}</p>
              <h1 className={cn("font-bold leading-tight mb-2", device === "phone" ? "text-2xl" : "text-4xl")}>
                {title || "Untitled article"}
              </h1>
              <p className="text-xs text-muted-foreground mb-6">{readMinutes} min read</p>
              <ArticleBody
                content={content || "<p>Start writing to see your article here.</p>"}
                className={device === "phone" ? "!prose-sm" : device === "tablet" ? "!prose-base" : "!prose-lg"}
              />
            </article>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
