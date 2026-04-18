import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { Plus, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export function CreateRoomDialog({ onCreated }: { onCreated?: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!user || !name.trim()) return;
    setSubmitting(true);
    const slug =
      "mr-" +
      name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .slice(0, 40) +
      "-" +
      Math.random().toString(36).slice(2, 6);

    const { error } = await supabase.from("gameday_voice_rooms").insert({
      name: name.trim(),
      description: desc.trim() || null,
      livekit_room_name: slug,
      created_by_user_id: user.id,
      status: "pending",
      is_active: true,
    });
    setSubmitting(false);

    if (error) {
      toast({
        title: "Could not submit room",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Room submitted!",
      description: "An admin will review and approve it shortly.",
    });
    setName("");
    setDesc("");
    setOpen(false);
    onCreated?.();
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
