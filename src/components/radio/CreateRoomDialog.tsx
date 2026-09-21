import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { uploadToR2 } from "@/lib/r2Upload";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Loader2, ImagePlus, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export function CreateRoomDialog({ onCreated }: { onCreated?: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onPickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      toast({ title: "Image too large", description: "Max 5MB", variant: "destructive" });
      return;
    }
    setImageFile(f);
    setImagePreview(URL.createObjectURL(f));
  };

  const submit = async () => {
    if (!user || !name.trim()) return;
    setSubmitting(true);
    try {
      const slug =
        "mr-" +
        name
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .slice(0, 40) +
        "-" +
        Math.random().toString(36).slice(2, 6);

      let image_url: string | null = null;
      if (imageFile) {
        const ext = imageFile.name.split(".").pop() || "jpg";
        const path = `voice-rooms/${user.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("media_library")
          .upload(path, imageFile, { upsert: false });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("media_library").getPublicUrl(path);
        image_url = pub.publicUrl;
      }

      const { error } = await supabase.from("gameday_voice_rooms").insert({
        name: name.trim(),
        description: desc.trim() || null,
        livekit_room_name: slug,
        created_by_user_id: user.id,
        status: "pending",
        is_active: true,
        image_url,
      });
      if (error) throw error;

      toast({
        title: "Room submitted!",
        description: "An admin will review and approve it shortly.",
      });
      setName("");
      setDesc("");
      setImageFile(null);
      setImagePreview(null);
      setOpen(false);
      onCreated?.();
    } catch (e: any) {
      toast({
        title: "Could not submit room",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="w-4 h-4" />
          Create Room
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a Voice Room</DialogTitle>
          <DialogDescription>
            Submit your room for admin approval. Once approved, fans can hop in.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium mb-1 block">Room name *</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Diaz Saves Lounge"
              maxLength={60}
            />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block">Description (optional)</label>
            <Textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="What's this room about?"
              maxLength={200}
              rows={3}
            />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block">Cover image (optional)</label>
            {imagePreview ? (
              <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-border">
                <img src={imagePreview} alt="" className="w-full h-full object-cover" />
                <Button
                  size="icon"
                  variant="destructive"
                  className="absolute top-2 right-2 h-7 w-7"
                  onClick={() => {
                    setImageFile(null);
                    setImagePreview(null);
                  }}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 w-full h-24 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-accent/40 transition text-sm text-muted-foreground">
                <ImagePlus className="w-4 h-4" />
                Upload image
                <input type="file" accept="image/*" className="hidden" onChange={onPickImage} />
              </label>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting || !name.trim()}>
            {submitting && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
            Submit for Approval
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
