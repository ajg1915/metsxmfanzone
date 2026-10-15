import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2, Pencil, Mic, Video, Loader2, Download, Check, X } from "lucide-react";
import { downloadAudio } from "@/utils/downloadAudio";
import { useToast } from "@/hooks/use-toast";

interface Episode {
  id: string;
  title: string;
  description: string | null;
  published: boolean;
  published_at: string | null;
  created_at: string;
  type: "podcast" | "video";
  url: string;
}

const when = (ep: Episode) =>
  new Date(ep.published_at || ep.created_at).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  }) + " ET";

/** Episode list built as cards so it reads well on a phone, tablet or computer. */
export default function StudioEpisodes() {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "podcast" | "video">("all");
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const [p, v] = await Promise.all([
        supabase.from("podcasts").select("*").order("created_at", { ascending: false }),
        supabase.from("videos").select("*").order("created_at", { ascending: false }),
      ]);
      const podcasts: Episode[] = (p.data || []).map((x: any) => ({
        id: x.id, title: x.title, description: x.description, published: x.published,
        published_at: x.published_at ?? null, created_at: x.created_at, type: "podcast", url: x.audio_url,
      }));
      const videos: Episode[] = (v.data || []).map((x: any) => ({
        id: x.id, title: x.title, description: x.description, published: x.published,
        published_at: x.published_at ?? null, created_at: x.created_at, type: "video", url: x.video_url,
      }));
      setEpisodes(
        [...podcasts, ...videos].sort(
          (a, b) =>
            new Date(b.published_at || b.created_at).getTime() - new Date(a.published_at || a.created_at).getTime(),
        ),
      );
    } catch {
      toast({ title: "Failed to load episodes", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const table = (ep: Episode) => (ep.type === "podcast" ? "podcasts" : "videos");

  const togglePublished = async (ep: Episode) => {
    const update: any = { published: !ep.published };
    if (!ep.published && !ep.published_at) update.published_at = new Date().toISOString();
    const { error } = await supabase.from(table(ep)).update(update).eq("id", ep.id);
    if (error) toast({ title: "Update failed", description: error.message, variant: "destructive" });
    else { toast({ title: ep.published ? "Hidden from the site" : "Shown on the site" }); load(); }
  };

  const remove = async (ep: Episode) => {
    if (!confirm(`Delete "${ep.title}"?`)) return;
    const { error } = await supabase.from(table(ep)).delete().eq("id", ep.id);
    if (error) toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    else { toast({ title: "Deleted" }); load(); }
  };

  const saveTitle = async (ep: Episode) => {
    if (!draftTitle.trim()) { toast({ title: "Title is required", variant: "destructive" }); return; }
    const { error } = await supabase.from(table(ep)).update({ title: draftTitle.trim() }).eq("id", ep.id);
    if (error) toast({ title: "Update failed", description: error.message, variant: "destructive" });
    else { setEditingKey(null); toast({ title: "Title saved" }); load(); }
  };

  const shown = filter === "all" ? episodes : episodes.filter((e) => e.type === filter);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-lg">Episodes</CardTitle>
          <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <TabsList className="h-9">
              <TabsTrigger value="all" className="h-8 px-3 text-xs">All ({episodes.length})</TabsTrigger>
              <TabsTrigger value="podcast" className="h-8 px-3 text-xs"><Mic className="mr-1 h-3 w-3" /> Audio</TabsTrigger>
              <TabsTrigger value="video" className="h-8 px-3 text-xs"><Video className="mr-1 h-3 w-3" /> Video</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : shown.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No episodes yet. Attach audio to a show to add one.</p>
        ) : (
          shown.map((ep) => {
            const key = `${ep.type}-${ep.id}`;
            const future = ep.published && ep.published_at && new Date(ep.published_at).getTime() > Date.now();
            return (
              <div key={key} className="min-w-0 space-y-2 rounded-xl border p-3">
                <div className="flex items-start gap-2">
                  {ep.type === "podcast" ? <Mic className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" /> : <Video className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />}
                  <div className="min-w-0 flex-1">
                    {editingKey === key ? (
                      <div className="flex gap-2">
                        <Input value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} className="h-10" aria-label="Episode title" />
                        <Button size="icon" className="h-10 w-10 shrink-0" onClick={() => saveTitle(ep)} aria-label="Save title"><Check className="h-4 w-4" /></Button>
                        <Button size="icon" variant="outline" className="h-10 w-10 shrink-0" onClick={() => setEditingKey(null)} aria-label="Cancel"><X className="h-4 w-4" /></Button>
                      </div>
                    ) : (
                      <p className="break-words text-sm font-semibold leading-snug">{ep.title}</p>
                    )}
                    <p className="mt-0.5 text-xs text-muted-foreground">{when(ep)}</p>
                  </div>
                </div>

                {ep.type === "podcast" && ep.url && <audio controls preload="none" className="h-9 w-full" src={ep.url} />}

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Switch checked={ep.published} onCheckedChange={() => togglePublished(ep)} aria-label="Show on the site" />
                    <Badge variant={ep.published ? "default" : "secondary"} className={ep.published ? (future ? "bg-amber-600" : "bg-green-600") : ""}>
                      {!ep.published ? "Hidden" : future ? "Coming soon" : "Live"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    {ep.type === "podcast" && ep.url && (
                      <Button variant="ghost" size="icon" className="h-10 w-10" title="Download audio" aria-label="Download audio" onClick={() => downloadAudio(ep.url, ep.title)}>
                        <Download className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-10 w-10" aria-label="Edit title" onClick={() => { setEditingKey(key); setDraftTitle(ep.title); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-10 w-10 text-destructive hover:text-destructive" aria-label="Delete episode" onClick={() => remove(ep)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
