import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ImagePlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { uploadToR2Key } from "@/lib/r2Upload";
import { artKey, artUrl, fetchAllShows, fmtShowWhen, type LenoreEpisode } from "@/lib/lenore";

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

function ShowCard({ show }: { show: LenoreEpisode }) {
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
    <div className="space-y-3 rounded-2xl border border-border/60 bg-card/60 p-3.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-bold uppercase tracking-wider text-primary">{fmtShowWhen(show.available)}</p>
        <Badge variant="secondary" className="text-[11px] uppercase tracking-wider">
          {show.status === "available" ? "Available" : "Scheduled"}
        </Badge>
      </div>
      <p className="text-[17px] font-bold leading-tight">{show.title}</p>
      <div className="flex items-center gap-3">
        <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-muted/30 p-1.5 text-center text-xs text-muted-foreground">
          <img
            src={`${artUrl(show.available)}?v=${bust}`}
            alt=""
            className={`absolute inset-0 h-full w-full object-cover ${hasArt ? "" : "hidden"}`}
            onLoad={() => setHasArt(true)}
            onError={() => setHasArt(false)}
          />
          {!hasArt && (hasArt === null ? "Checking..." : "No art yet")}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            aria-label={`Choose fan art for ${show.title}`}
            onChange={(e) => pick(e.target.files?.[0])}
          />
          <Button type="button" className="h-11 w-full" disabled={busy} onClick={() => inputRef.current?.click()}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
            {busy ? `Saving ${percent}%` : hasArt ? "Replace art" : "Upload art"}
          </Button>
          <p className="break-all text-xs text-muted-foreground">Saves as {key}</p>
        </div>
      </div>
    </div>
  );
}

export default function LenoreTab() {
  const [shows, setShows] = useState<LenoreEpisode[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchAllShows().then(setShows).catch(() => setError(true));
  }, []);

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-xl font-extrabold uppercase tracking-wide">Lenore, your producer</h2>
        <p className="text-sm text-muted-foreground">
          Monday, Wednesday and Friday shows. They publish on their own at the time shown. Add fan art for each one below.
        </p>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">Could not reach Lenore. Try again in a minute.</p>}
      {!shows && !error && <p className="text-sm text-muted-foreground">Loading shows...</p>}
      {shows && shows.length === 0 && (
        <p className="text-sm text-muted-foreground">No shows are scheduled yet. Lenore adds the next three every Sunday morning.</p>
      )}
      {shows?.map((s) => <ShowCard key={s.id} show={s} />)}
      <p className="text-[13px] text-muted-foreground">
        Any picture works. It is cropped to a square and shrunk for you. The new picture shows on the home podcast section and the podcast page.
      </p>
    </div>
  );
}
