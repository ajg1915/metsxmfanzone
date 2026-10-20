import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, RotateCcw, RotateCw } from "lucide-react";

/**
 * Crop an image before it is uploaded. Opens when `file` is set.
 * - onDone gets the cropped image as a JPEG File (max 1600px wide)
 * - onCancel closes without uploading anything
 */

const MAX_OUTPUT_WIDTH = 1600;
const MIN_CROP = 48; // smallest crop side, in source pixels
const MAX_STAGE_HEIGHT = 400;

const SHAPES: { label: string; aspect: number | null }[] = [
  { label: "Free", aspect: null },
  { label: "16:9", aspect: 16 / 9 },
  { label: "Share card", aspect: 1200 / 630 },
  { label: "4:3", aspect: 4 / 3 },
  { label: "Square", aspect: 1 },
];

type Crop = { x: number; y: number; w: number; h: number };
type Handle = "move" | "nw" | "ne" | "sw" | "se";

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

interface Props {
  file: File | null;
  defaultAspect?: number | null;
  onCancel: () => void;
  onDone: (cropped: File) => void;
}

export default function ImageCropDialog({ file, defaultAspect = null, onCancel, onDone }: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [nat, setNat] = useState({ w: 0, h: 0 });
  const [aspect, setAspect] = useState<number | null>(defaultAspect);
  const [crop, setCrop] = useState<Crop>({ x: 0, y: 0, w: 0, h: 0 });
  const [scale, setScale] = useState(1);
  const [busy, setBusy] = useState(false);

  const imgRef = useRef<HTMLImageElement | null>(null);
  const holderRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ type: Handle; p0: { x: number; y: number }; c0: Crop } | null>(null);
  const urlRef = useRef<string | null>(null);

  const setUrl = useCallback((url: string | null) => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = url;
    setSrc(url);
  }, []);

  // Load the chosen file
  useEffect(() => {
    if (!file) { setUrl(null); return; }
    setAspect(defaultAspect);
    setUrl(URL.createObjectURL(file));
    return () => { if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = null; } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  const fitCrop = useCallback((a: number | null, w0: number, h0: number) => {
    let w: number; let h: number;
    if (!a) { w = w0 * 0.9; h = h0 * 0.9; }
    else { w = Math.min(w0 * 0.92, h0 * 0.92 * a); h = w / a; }
    setCrop({ x: (w0 - w) / 2, y: (h0 - h) / 2, w, h });
  }, []);

  const measure = useCallback((w0: number, h0: number) => {
    const cw = Math.max(200, (holderRef.current?.clientWidth ?? 600) - 2);
    setScale(Math.min(cw / w0, MAX_STAGE_HEIGHT / h0, 1));
  }, []);

  const onImgLoad = () => {
    const im = imgRef.current;
    if (!im) return;
    const w0 = im.naturalWidth, h0 = im.naturalHeight;
    setNat({ w: w0, h: h0 });
    measure(w0, h0);
    fitCrop(aspect, w0, h0);
  };

  // Re-fit the preview when the window size changes
  useEffect(() => {
    const onResize = () => { if (nat.w) measure(nat.w, nat.h); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [nat, measure]);

  const pickShape = (a: number | null) => {
    setAspect(a);
    if (nat.w) fitCrop(a, nat.w, nat.h);
  };

  const rotate = (dir: 1 | -1) => {
    const im = imgRef.current;
    if (!im || !im.naturalWidth) return;
    const c = document.createElement("canvas");
    c.width = im.naturalHeight; c.height = im.naturalWidth;
    const g = c.getContext("2d");
    if (!g) return;
    g.translate(c.width / 2, c.height / 2);
    g.rotate((dir * Math.PI) / 2);
    g.drawImage(im, -im.naturalWidth / 2, -im.naturalHeight / 2);
    c.toBlob((b) => { if (b) setUrl(URL.createObjectURL(b)); }, "image/jpeg", 0.92);
  };

  const pointer = (e: React.PointerEvent) => {
    const r = (imgRef.current as HTMLImageElement).getBoundingClientRect();
    return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
  };

  const down = (type: Handle) => (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { type, p0: pointer(e), c0: { ...crop } };
  };

  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const p = pointer(e);
    const W = nat.w, H = nat.h, c0 = d.c0;
    if (d.type === "move") {
      setCrop({ ...c0, x: clamp(c0.x + (p.x - d.p0.x), 0, W - c0.w), y: clamp(c0.y + (p.y - d.p0.y), 0, H - c0.h) });
      return;
    }
    // Resize from a corner: the opposite corner stays put
    const ax = d.type.includes("w") ? c0.x + c0.w : c0.x;
    const ay = d.type.includes("n") ? c0.y + c0.h : c0.y;
    const px = clamp(p.x, 0, W), py = clamp(p.y, 0, H);
    const dx = px >= ax ? 1 : -1, dy = py >= ay ? 1 : -1;
    const roomX = dx > 0 ? W - ax : ax, roomY = dy > 0 ? H - ay : ay;
    let w = Math.abs(px - ax), h = Math.abs(py - ay);
    if (aspect) {
      w = Math.max(w, h * aspect, MIN_CROP);
      w = Math.min(w, roomX, roomY * aspect);
      h = w / aspect;
    } else {
      w = Math.min(Math.max(w, MIN_CROP), roomX);
      h = Math.min(Math.max(h, MIN_CROP), roomY);
    }
    setCrop({ x: dx > 0 ? ax : ax - w, y: dy > 0 ? ay : ay - h, w, h });
  };

  const up = () => { drag.current = null; };

  const onKey = (e: React.KeyboardEvent) => {
    const step = (e.shiftKey ? 20 : 4) / scale;
    const m: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step],
    };
    const v = m[e.key];
    if (!v) return;
    e.preventDefault();
    setCrop((c) => ({ ...c, x: clamp(c.x + v[0], 0, nat.w - c.w), y: clamp(c.y + v[1], 0, nat.h - c.h) }));
  };

  const outW = Math.round(crop.w > MAX_OUTPUT_WIDTH ? MAX_OUTPUT_WIDTH : crop.w);
  const outH = Math.round(crop.w > 0 ? (crop.h * outW) / crop.w : 0);

  const finish = () => {
    const im = imgRef.current;
    if (!im || !file || outW < 1 || outH < 1) return;
    setBusy(true);
    const c = document.createElement("canvas");
    c.width = outW; c.height = outH;
    const g = c.getContext("2d");
    if (!g) { setBusy(false); return; }
    g.fillStyle = "#ffffff"; // JPEG has no transparency
    g.fillRect(0, 0, outW, outH);
    g.drawImage(im, crop.x, crop.y, crop.w, crop.h, 0, 0, outW, outH);
    c.toBlob(
      (b) => {
        setBusy(false);
        if (!b) return;
        const base = file.name.replace(/\.[^.]+$/, "") || "image";
        onDone(new File([b], `${base}.jpg`, { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.9,
    );
  };

  const dw = Math.round(nat.w * scale), dh = Math.round(nat.h * scale);
  const handle = "absolute w-6 h-6 touch-none after:content-[''] after:absolute after:w-3.5 after:h-3.5 after:bg-orange-500 after:border-2 after:border-white after:rounded-[2px]";

  return (
    <Dialog open={!!file} onOpenChange={(o) => { if (!o && !busy) onCancel(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Crop image</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div ref={holderRef} className="flex justify-center rounded-md bg-black/80 p-3 min-h-[200px]">
            {src && (
              <div className="relative select-none touch-none leading-[0]" style={{ width: dw || undefined, height: dh || undefined }}>
                <img ref={imgRef} src={src} alt="Image to crop" onLoad={onImgLoad} draggable={false}
                  className="block max-w-none pointer-events-none"
                  style={{ width: dw || undefined, height: dh || undefined }} />
                {nat.w > 0 && (
                  <div
                    tabIndex={0}
                    aria-label="Crop area. Drag to move, arrow keys to nudge."
                    onPointerDown={down("move")} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
                    onKeyDown={onKey}
                    className="absolute border-2 border-white cursor-move touch-none outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
                    style={{
                      left: crop.x * scale, top: crop.y * scale, width: crop.w * scale, height: crop.h * scale,
                      boxShadow: "0 0 0 9999px rgba(0,0,0,0.65)",
                    }}
                  >
                    <span className={`${handle} -left-3 -top-3 cursor-nwse-resize after:left-1.5 after:top-1.5`}
                      onPointerDown={down("nw")} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
                    <span className={`${handle} -right-3 -top-3 cursor-nesw-resize after:right-1.5 after:top-1.5`}
                      onPointerDown={down("ne")} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
                    <span className={`${handle} -left-3 -bottom-3 cursor-nesw-resize after:left-1.5 after:bottom-1.5`}
                      onPointerDown={down("sw")} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
                    <span className={`${handle} -right-3 -bottom-3 cursor-nwse-resize after:right-1.5 after:bottom-1.5`}
                      onPointerDown={down("se")} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {SHAPES.map((s) => (
              <Button key={s.label} type="button" size="sm"
                variant={aspect === s.aspect ? "default" : "outline"}
                onClick={() => pickShape(s.aspect)}>
                {s.label}
              </Button>
            ))}
            <span className="mx-1 h-5 w-px bg-border" />
            <Button type="button" size="sm" variant="outline" onClick={() => rotate(-1)} aria-label="Rotate left">
              <RotateCcw className="w-4 h-4" />
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => rotate(1)} aria-label="Rotate right">
              <RotateCw className="w-4 h-4" />
            </Button>
          </div>

          <p className="text-xs text-muted-foreground tabular-nums">
            Uploads as {outW} &times; {outH} px (original {nat.w} &times; {nat.h} px)
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button type="button" onClick={finish} disabled={busy || !nat.w}>
            {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Crop &amp; upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
