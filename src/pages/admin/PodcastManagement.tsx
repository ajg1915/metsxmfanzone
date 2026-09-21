import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { uploadToR2 } from "@/lib/r2Upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Upload, Loader2, Pencil, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import PodcastAudioRecorder from "@/components/PodcastAudioRecorder";

interface Podcast {
  id: string;
  title: string;
  description: string;
  audio_url: string;
  duration: number;
  published: boolean;
  created_at: string;
}

export default function PodcastManagement() {
  const [podcasts, setPodcasts] = useState<Podcast[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState({ title: "", description: "" });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    audioFile: null as File | null,
  });

  useEffect(() => {
    fetchPodcasts();
  }, []);

  const fetchPodcasts = async () => {
    const { data, error } = await supabase
      .from("podcasts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Error fetching podcasts",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setPodcasts(data || []);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "audio/mpeg") {
      setFormData({ ...formData, audioFile: file });
    } else {
      toast({
        title: "Invalid file type",
        description: "Please upload an MP3 file",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.audioFile) {
      toast({
        title: "No file selected",
        description: "Please select an MP3 file",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      // Upload audio file
      const fileExt = "mp3";
      const fileName = `${Date.now()}.${fileExt}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("podcasts")
        .upload(fileName, formData.audioFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("podcasts")
        .getPublicUrl(fileName);

      // Create podcast record
      const { error: insertError } = await supabase.from("podcasts").insert({
        title: formData.title,
        description: formData.description,
        audio_url: publicUrl,
        duration: 0,
      });

      if (insertError) throw insertError;

      toast({
        title: "Podcast uploaded successfully",
      });

      setFormData({ title: "", description: "", audioFile: null });
      fetchPodcasts();
    } catch (error: any) {
      toast({
        title: "Error uploading podcast",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const togglePublished = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from("podcasts")
      .update({ 
        published: !currentStatus,
        published_at: !currentStatus ? new Date().toISOString() : null 
      })
      .eq("id", id);

    if (error) {
      toast({
        title: "Error updating podcast",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: `Podcast ${!currentStatus ? "published" : "unpublished"}`,
      });
      fetchPodcasts();
    }
  };

  const deletePodcast = async (id: string, audioUrl: string) => {
    if (!confirm("Are you sure you want to delete this podcast?")) return;

    try {
      // Extract filename from URL
      const filename = audioUrl.split("/").pop();
      if (filename) {
        await supabase.storage.from("podcasts").remove([filename]);
      }

      const { error } = await supabase.from("podcasts").delete().eq("id", id);

      if (error) throw error;

      toast({
        title: "Podcast deleted successfully",
      });
      fetchPodcasts();
    } catch (error: any) {
      toast({
        title: "Error deleting podcast",
        description: error.message,
        variant: "destructive",
      });
    }
  };
  const startEditing = (podcast: Podcast) => {
    setEditingId(podcast.id);
    setEditData({ title: podcast.title, description: podcast.description || "" });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditData({ title: "", description: "" });
  };

  const saveEdit = async (id: string) => {
    if (!editData.title.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("podcasts")
        .update({ title: editData.title, description: editData.description })
        .eq("id", id);
      if (error) throw error;
      toast({ title: "Podcast updated" });
      setEditingId(null);
      fetchPodcasts();
    } catch (error: any) {
      toast({ title: "Error updating podcast", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-full px-2 py-3 space-y-4 overflow-x-hidden">
      <div>
        <h1 className="text-lg sm:text-xl font-bold">Podcasts</h1>
        <p className="text-xs text-muted-foreground">Manage episodes</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload New Podcast</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="title">Podcast Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                required
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="audio">MP3 File</Label>
              <Input
                id="audio"
                type="file"
                accept="audio/mpeg"
                onChange={handleFileChange}
                required
              />
            </div>

            <Button type="submit" disabled={uploading}>
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Podcast
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <PodcastAudioRecorder />

      <Card>
        <CardHeader>
          <CardTitle>All Podcasts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {podcasts.map((podcast) => (
              <div key={podcast.id} className="p-3 border rounded-lg space-y-2">
                {editingId === podcast.id ? (
                  <div className="space-y-2">
                    <Input
                      value={editData.title}
                      onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                      placeholder="Title"
                    />
                    <Textarea
                      value={editData.description}
                      onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                      placeholder="Description"
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => saveEdit(podcast.id)} disabled={saving}>
                        {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                        Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={cancelEditing}>
                        <X className="w-3 h-3 mr-1" /> Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-sm truncate">{podcast.title}</h3>
                      <p className="text-xs text-muted-foreground line-clamp-2">{podcast.description}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => startEditing(podcast)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Switch
                        checked={podcast.published}
                        onCheckedChange={() => togglePublished(podcast.id, podcast.published)}
                      />
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => deletePodcast(podcast.id, podcast.audio_url)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
                <audio controls className="w-full h-8">
                  <source src={podcast.audio_url} type="audio/mpeg" />
                </audio>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
