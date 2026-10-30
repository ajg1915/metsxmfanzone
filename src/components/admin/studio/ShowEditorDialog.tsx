import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ImagePlus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { uploadToR2Key } from "@/lib/r2Upload";
import { artKey, buildShow, etToIso, newShowId, saveShow, showDate, showTime, type LenoreEpisode } from "@/lib/lenore";
import { toSquareJpeg } from "@/components/admin/studio/StudioShowCard";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  show: LenoreEpisode | null; // null = a new show
  onSaved: () => void;
};

const TIMES = [
  ["06:00", "6:00 AM"],
  ["08:30", "8:30 AM"],
  ["17:00", "5:00 PM"],
];

/** Create, edit or delete a podcast show: title, date, time, description and fan art. */
export default function ShowEditorDialog({ open, onOpenChange, show, onSaved }: Props) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("06:00");
  const [art, setArt] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(show?.title ?? "");
    setDescription(show?.description ?? "");
    setDate(show ? showDate(show.available) : "");
    setTime(show ? showTime(show.available) : "06:00");
    setArt(null);
    setConfirmDelete(false);
  }, [open, show]);

  const save = async () => {
    if (!title.trim() || !date || !time) {
      toast({ title: "Add a title, date and time", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const available = etToIso(date, time);
      await saveShow(buildShow(show?.id ?? newShowId(), title.trim(), description.trim(), available));
      if (art) await uploadToR2Key(await toSquareJpeg(art), artKey(available));
      toast({ title: show ? "Show updated" : "Show added", description: "It shows on the podcast section." });
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast({ title: "Could not save", description: e instanceof Error ? e.message : "Try again", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!show) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setBusy(true);
    try {
      await saveShow(show, "delete");
      toast({ title: "Show deleted" });
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast({ title: "Could not delete", description: e instanceof Error ? e.message : "Try again", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{show ? "Edit show" : "New show"}</DialogTitle>
          <DialogDescription>Times are New York time. The show appears on the podcast section until it goes live.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="show-title">Title</Label>
            <Input id="show-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Monday: Mets offseason moves" className="h-11" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="show-date">Date</Label>
              <Input id="show-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="show-time">Time (ET)</Label>
              <Input id="show-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-11" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2" aria-label="Usual show times">
            {TIMES.map(([v, label]) => (
              <Button key={v} type="button" size="sm" variant={time === v ? "default" : "outline"} onClick={() => setTime(v)}>{label}</Button>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="show-desc">Description (optional)</Label>
            <Textarea id="show-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="What the show covers" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="show-art">Fan art</Label>
            <input ref={fileRef} id="show-art" type="file" accept="image/*" className="sr-only" onChange={(e) => setArt(e.target.files?.[0] ?? null)} />
            <Button type="button" variant="outline" className="h-11 w-full justify-start" onClick={() => fileRef.current?.click()}>
              <ImagePlus className="mr-2 h-4 w-4" />
              <span className="truncate">{art ? art.name : show ? "Replace fan art (optional)" : "Choose fan art"}</span>
            </Button>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {show ? (
            <Button type="button" variant="outline" disabled={busy} onClick={remove} className="h-11 border-destructive text-destructive">
              <Trash2 className="mr-2 h-4 w-4" /> {confirmDelete ? "Tap again to delete" : "Delete show"}
            </Button>
          ) : <span />}
          <Button type="button" disabled={busy} onClick={save} className="h-11">
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {show ? "Save changes" : "Add show"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
