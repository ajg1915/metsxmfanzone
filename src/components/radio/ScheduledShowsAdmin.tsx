import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Trash2, Plus } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Show {
  id: string;
  title: string;
  host_name: string;
  description: string | null;
  cover_image_url: string | null;
  scheduled_start: string;
  duration_minutes: number;
  stream_url: string | null;
  is_live: boolean;
  published: boolean;
}

export function ScheduledShowsAdmin() {
  const { user } = useAuth();
  const [shows, setShows] = useState<Show[]>([]);
  const [title, setTitle] = useState("");
  const [host, setHost] = useState("");
  const [desc, setDesc] = useState("");
  const [cover, setCover] = useState("");
  const [start, setStart] = useState("");
  const [duration, setDuration] = useState(60);
  const [streamUrl, setStreamUrl] = useState("");

  const load = async () => {
    const { data } = await supabase
      .from("radio_scheduled_shows")
      .select("*")
      .order("scheduled_start", { ascending: true });
    setShows((data as Show[]) ?? []);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    if (!title.trim() || !host.trim() || !start) {
      toast({ title: "Missing fields", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("radio_scheduled_shows").insert({
      title: title.trim(),
      host_name: host.trim(),
      description: desc.trim() || null,
      cover_image_url: cover.trim() || null,
      scheduled_start: new Date(start).toISOString(),
      duration_minutes: duration,
      stream_url: streamUrl.trim() || null,
      created_by: user?.id ?? null,
    });
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
      return;
    }
    setTitle("");
    setHost("");
    setDesc("");
    setCover("");
    setStart("");
    setDuration(60);
    setStreamUrl("");
    load();
    toast({ title: "Show scheduled" });
  };

  const toggleLive = async (id: string, is_live: boolean) => {
    await supabase.from("radio_scheduled_shows").update({ is_live }).eq("id", id);
    load();
  };

  const togglePublished = async (id: string, published: boolean) => {
    await supabase.from("radio_scheduled_shows").update({ published }).eq("id", id);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this show?")) return;
    await supabase.from("radio_scheduled_shows").delete().eq("id", id);
    load();
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h3 className="font-semibold mb-3">Schedule a Live Show</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <Input
            placeholder="Show title *"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Input
            placeholder="Host name *"
            value={host}
            onChange={(e) => setHost(e.target.value)}
          />
          <Input
            type="datetime-local"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
          <Input
            type="number"
            placeholder="Duration (min)"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value) || 60)}
          />
          <Input
            placeholder="Cover image URL (optional)"
            value={cover}
            onChange={(e) => setCover(e.target.value)}
            className="md:col-span-2"
          />
          <Input
            placeholder="Stream / Listen URL (optional)"
            value={streamUrl}
            onChange={(e) => setStreamUrl(e.target.value)}
            className="md:col-span-2"
          />
          <Textarea
            placeholder="Description (optional)"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={2}
            className="md:col-span-2"
          />
        </div>
        <Button onClick={create} className="mt-3">
          <Plus className="w-4 h-4 mr-1" /> Schedule Show
        </Button>
      </Card>

      <div className="space-y-2">
        {shows.map((s) => (
          <Card key={s.id} className="p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{s.title}</p>
                <p className="text-xs text-muted-foreground">
                  {s.host_name} • {format(new Date(s.scheduled_start), "EEE MMM d, h:mm a")} •{" "}
                  {s.duration_minutes}m
                </p>
                {s.description && (
                  <p className="text-xs text-muted-foreground mt-1">{s.description}</p>
                )}
              </div>
              <Button variant="ghost" size="icon" onClick={() => remove(s.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex items-center gap-4 mt-2 pt-2 border-t border-border/50">
              <div className="flex items-center gap-2">
                <Switch
                  checked={s.is_live}
                  onCheckedChange={(v) => toggleLive(s.id, v)}
                />
                <Label className="text-xs">Live now</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={s.published}
                  onCheckedChange={(v) => togglePublished(s.id, v)}
                />
                <Label className="text-xs">Published</Label>
              </div>
            </div>
          </Card>
        ))}
        {shows.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-6">
            No scheduled shows yet.
          </p>
        )}
      </div>
    </div>
  );
}
