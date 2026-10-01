import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Trash2, Pencil, Mic, Video, Loader2, Download } from "lucide-react";
import { downloadAudio } from "@/utils/downloadAudio";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Episode {
  id: string;
  title: string;
  description: string | null;
  published: boolean;
  created_at: string;
  type: "podcast" | "video";
  url: string;
  duration: number | null;
}

interface EpisodesTabProps {
  onEditEpisode: (id: string) => void;
}

export default function EpisodesTab({ onEditEpisode }: EpisodesTabProps) {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "podcast" | "video">("all");
  const { toast } = useToast();

  const fetchEpisodes = async () => {
    setLoading(true);
    try {
      const [podcastRes, videoRes] = await Promise.all([
        supabase.from("podcasts").select("*").order("created_at", { ascending: false }),
        supabase.from("videos").select("*").order("created_at", { ascending: false }),
      ]);

      const podcasts: Episode[] = (podcastRes.data || []).map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        published: p.published,
        created_at: p.created_at,
        type: "podcast" as const,
        url: p.audio_url,
        duration: p.duration,
      }));

      const videos: Episode[] = (videoRes.data || []).map((v) => ({
        id: v.id,
        title: v.title,
        description: v.description,
        published: v.published,
        created_at: v.created_at,
        type: "video" as const,
        url: v.video_url,
        duration: v.duration,
      }));

      const all = [...podcasts, ...videos].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setEpisodes(all);
    } catch {
      toast({ title: "Failed to load episodes", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEpisodes(); }, []);

  const togglePublished = async (ep: Episode) => {
    const table = ep.type === "podcast" ? "podcasts" : "videos";
    const updateData: any = { published: !ep.published };
    if (!ep.published) updateData.published_at = new Date().toISOString();

    const { error } = await supabase.from(table).update(updateData).eq("id", ep.id);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `${!ep.published ? "Published" : "Unpublished"}` });
      fetchEpisodes();
    }
  };

  const deleteEpisode = async (ep: Episode) => {
    if (!confirm(`Delete "${ep.title}"?`)) return;
    const table = ep.type === "podcast" ? "podcasts" : "videos";
    const { error } = await supabase.from(table).delete().eq("id", ep.id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Deleted" });
      fetchEpisodes();
    }
  };

  const filtered = filter === "all" ? episodes : episodes.filter((e) => e.type === filter);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-lg">Episodes</CardTitle>
          <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
            <TabsList className="h-8">
              <TabsTrigger value="all" className="text-xs h-7 px-3">All ({episodes.length})</TabsTrigger>
              <TabsTrigger value="podcast" className="text-xs h-7 px-3">
                <Mic className="w-3 h-3 mr-1" /> Podcasts
              </TabsTrigger>
              <TabsTrigger value="video" className="text-xs h-7 px-3">
                <Video className="w-3 h-3 mr-1" /> Videos
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No episodes found.</p>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">Type</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead className="hidden sm:table-cell">Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((ep) => (
                  <TableRow key={`${ep.type}-${ep.id}`} className="group">
                    <TableCell>
                      {ep.type === "podcast" ? (
                        <Mic className="w-4 h-4 text-orange-500" />
                      ) : (
                        <Video className="w-4 h-4 text-blue-500" />
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate max-w-[200px] sm:max-w-none">{ep.title}</p>
                        {ep.description && (
                          <p className="text-xs text-muted-foreground truncate max-w-[200px] sm:max-w-[300px]">{ep.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(ep.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={ep.published}
                          onCheckedChange={() => togglePublished(ep)}
                          className="scale-90"
                        />
                        <Badge variant={ep.published ? "default" : "secondary"} className={`text-[10px] ${ep.published ? "bg-green-600" : ""}`}>
                          {ep.published ? "Live" : "Draft"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {ep.type === "podcast" && ep.url && (
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Download audio" onClick={() => downloadAudio(ep.url as string, ep.title)}>
                            <Download className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => onEditEpisode(ep.id)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => deleteEpisode(ep)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
