import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ImagePlus, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { uploadToR2Key } from "@/lib/r2Upload";
import { artKey, artUrl, fmtShowWhen, type LenoreEpisode } from "@/lib/lenore";

const ART_SIZE = 1080;

/** Crops the picture to a centered square, shrinks it to 1080px and saves it as a JPEG. */
async function toSquareJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const out = Math.min(side, ART_SIZE);
  const canvas = document.createElement("canvas");
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not read that picture");
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, out, out);
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not prepare that picture"))), "image/jpeg", 0.86),
  );
}

type Props = {
  show: LenoreEpisode;
  selected: boolean;
  hasAudio: boolean;
  onSelect: () => void;
};

/** One of Lenore's shows: tap to pick it for recording, and add or replace its fan art. */
export default function StudioShowCard({ show, selected, hasAudio, onSelect }: Props) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [hasArt, setHasArt] = useState<boolean | null>(null);
  const [bust, setBust] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [percent, setPercent] = useState(0);
  const key = artKey(show.available);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Pick a picture", description: "That file is not an image.", variant: "destructive" });
      return;
    }
    setBusy(true);
    setPercent(0);
    try {
      const jpeg = await toSquareJpeg(file);
      await uploadToR2Key(jpeg, key, setPercent);
      setBust(Date.now());
      setHasArt(true);
      toast({ title: "Art saved", description: "It will show on the podcast section." });
    } catch (e) {
      toast({ title: "Upload failed", description: e instanceof Error ? e.message : "Try again", variant: "destructive" });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div
      className={cn(
        "rounded-2xl border-2 p-3 transition-colors",
        selected ? "border-primary bg-primary/5" : "border-border/60 bg-card/60",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        disabled={hasAudio}
        aria-pressed={selected}
        className="flex w-full min-w-0 items-center gap-3 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default"
      >
        <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-muted/30 text-center text-[11px] text-muted-foreground">
          <img
            src={`${artUrl(show.available)}?v=${bust}`}
            alt=""
            className={cn("absolute inset-0 h-full w-full object-cover", hasArt ? "" : "hidden")}
            onLoad={() => setHasArt(true)}
            onError={() => setHasArt(false)}
          />
          {!hasArt && (hasArt === null ? "..." : "No art")}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-[12px] font-bold uppercase tracking-wider text-primary">{fmtShowWhen(show.available)}</p>
          <p className="break-words text-[15px] font-bold leading-tight">{show.title}</p>
          <div className="flex flex-wrap gap-1.5">
            {hasAudio ? (
              <Badge className="gap-1 bg-green-600 text-[11px] hover:bg-green-600">
                <CheckCircle2 className="h-3 w-3" /> Audio attached
              </Badge>
            ) : (
              <Badge variant="outline" className="border-amber-500 text-[11px] text-amber-500">Needs audio</Badge>
            )}
            <Badge variant="secondary" className="text-[11px]">{show.status === "available" ? "Live" : "Scheduled"}</Badge>
          </div>
        </div>
      </button>

      <div className="mt-3">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          aria-label={`Choose fan art for ${show.title}`}
          onChange={(e) => pick(e.target.files?.[0])}
        />
        <Button type="button" variant="outline" className="h-11 w-full" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
          {busy ? `Saving ${percent}%` : hasArt ? "Replace fan art" : "Add fan art"}
        </Button>
      </div>
    </div>
  );
}
