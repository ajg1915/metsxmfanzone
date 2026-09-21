import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { uploadToR2 } from "@/lib/r2Upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus, Upload, RefreshCw, Loader2, Cloud, Pencil, Calendar, MapPin, Clock }from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface SpringTrainingGame {
  id: string;
  opponent: string;
  game_date: string;
  game_time?: string;
  location?: string;
  preview_image_url: string;
  display_order: number | null;
  published: boolean | null;
  is_home_game?: boolean;
  is_auto_generated?: boolean;
  game_status?: string;
  last_synced_at?: string;
  mlb_game_pk?: number;
}

export default function SpringTrainingManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [formData, setFormData] = useState({
    opponent: "",
    game_date: "",
    game_time: "",
    location: "",
    preview_image_url: "",
    display_order: 0,
    published: true,
    is_home_game: true,
  });

  const { data: games, isLoading } = useQuery({
    queryKey: ["admin-spring-training-games"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("spring_training_games")
        .select("*")
        .order("game_date", { ascending: true });

      if (error) throw error;
      return data as SpringTrainingGame[];
    },
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { publicUrl } = await uploadToR2(file, "spring-training");

      setFormData({ ...formData, preview_image_url: publicUrl });
      toast({ title: "Image uploaded successfully" });
    } catch (error) {
      toast({ title: "Failed to upload image", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const syncFromMLB = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-spring-training-schedule');
      
      if (error) throw error;
      
      toast({ 
        title: "Sync Complete", 
        description: `${data.inserted || 0} new, ${data.updated || 0} updated, ${data.skipped || 0} skipped` 
      });
      
      queryClient.invalidateQueries({ queryKey: ["admin-spring-training-games"] });
    } catch (error) {
      console.error("Sync error:", error);
      toast({ title: "Failed to sync from MLB", variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const insertData = {
        ...data,
        is_auto_generated: false, // Manual entries are never auto-generated
      };
      const { error } = await supabase.from("spring_training_games").insert([insertData]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-spring-training-games"] });
      toast({ title: "Game created successfully" });
      resetForm();
    },
    onError: () => {
      toast({ title: "Failed to create game", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const updateData = {
        ...data,
        is_auto_generated: false, // Once edited, mark as manual
      };
      const { error } = await supabase.from("spring_training_games").update(updateData).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-spring-training-games"] });
      toast({ title: "Game updated successfully" });
      resetForm();
    },
    onError: () => {
      toast({ title: "Failed to update game", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("spring_training_games").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-spring-training-games"] });
      toast({ title: "Game deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete game", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      opponent: "",
      game_date: "",
      game_time: "",
      location: "",
      preview_image_url: "",
      display_order: 0,
      published: true,
      is_home_game: true,
    });
    setIsAdding(false);
    setEditingId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const idToUpdate = editingId;
    
    if (idToUpdate) {
      updateMutation.mutate({ id: idToUpdate, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (game: SpringTrainingGame) => {
    setFormData({
      opponent: game.opponent,
      game_date: game.game_date,
      game_time: game.game_time || "",
      location: game.location || "",
      preview_image_url: game.preview_image_url || "",
      display_order: game.display_order || 0,
      published: game.published ?? true,
      is_home_game: game.is_home_game ?? true,
    });
    setEditingId(game.id);
    setIsAdding(true);
  };

  const formatGameDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "EEE, MMM d");
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="w-full max-w-full px-2 sm:px-4 py-4 sm:py-6 overflow-x-hidden">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4 sm:mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold">Spring Training</h2>
          <p className="text-xs text-muted-foreground">MLB API synced + manual edits</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={syncFromMLB} 
            disabled={syncing}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cloud className="w-4 h-4" />}
            Sync MLB
          </Button>
          <Button onClick={() => setIsAdding(!isAdding)} size="sm" className="w-full sm:w-auto">
            <Plus className="w-4 h-4 mr-2" />
            {isAdding ? "Cancel" : "Add Game"}
          </Button>
        </div>
      </div>

      {isAdding && (
        <Card className={`mb-6 ${editingId ? "ring-2 ring-primary" : ""}`}>
          <CardHeader>
            <CardTitle>{editingId ? "Edit Game" : "Add New Game"}</CardTitle>
            <CardDescription>
              {editingId ? "Manual edits won't be overwritten by MLB sync" : "Manually added games are preserved during sync"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-1.5 sm:space-y-2">
                  <Label>Opponent Team *</Label>
                  <Input
                    value={formData.opponent}
                    onChange={(e) => setFormData({ ...formData, opponent: e.target.value })}
                    placeholder="e.g., Yankees, Red Sox"
                    required
                  />
                </div>
                <div className="space-y-1.5 sm:space-y-2">
                  <Label>Game Date *</Label>
                  <Input
                    type="date"
                    value={formData.game_date}
                    onChange={(e) => setFormData({ ...formData, game_date: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1.5 sm:space-y-2">
                  <Label>Game Time</Label>
                  <Input
                    value={formData.game_time}
                    onChange={(e) => setFormData({ ...formData, game_time: e.target.value })}
                    placeholder="1:05 PM ET"
                  />
                </div>
                <div className="space-y-1.5 sm:space-y-2">
                  <Label>Location</Label>
                  <Input
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="Clover Park"
                  />
                </div>
              </div>
              <div className="space-y-1.5 sm:space-y-2">
                <Label>Preview Image</Label>
                <div className="flex gap-2">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={uploading}
                  />
                  {uploading && <p className="text-sm text-muted-foreground">Uploading...</p>}
                </div>
                {formData.preview_image_url && (
                  <img src={formData.preview_image_url} alt="Preview" className="w-32 h-20 object-cover mt-2 rounded" />
                )}
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.is_home_game}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_home_game: checked })}
                  />
                  <Label>Home Game</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.published}
                    onCheckedChange={(checked) => setFormData({ ...formData, published: checked })}
                  />
                  <Label>Published</Label>
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={uploading}>
                  {editingId ? "Update" : "Create"} Game
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : games?.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground mb-4">No Spring Training games yet</p>
            <Button onClick={syncFromMLB} disabled={syncing}>
              {syncing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Cloud className="w-4 h-4 mr-2" />}
              Sync from MLB API
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {games?.map((game) => (
            <Card key={game.id} className={!game.published ? "opacity-60" : ""}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg truncate flex items-center gap-2">
                      {game.is_home_game ? "vs" : "@"} {game.opponent}
                      {game.is_auto_generated && (
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          <Cloud className="w-3 h-3 mr-1" />
                          MLB
                        </Badge>
                      )}
                    </CardTitle>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatGameDate(game.game_date)}
                      </span>
                      {game.game_time && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {game.game_time}
                        </span>
                      )}
                    </div>
                    {game.location && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <MapPin className="w-3 h-3" />
                        {game.location}
                      </p>
                    )}
                  </div>
                  <div className={`text-[10px] px-2 py-0.5 rounded shrink-0 ${game.published ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400"}`}>
                    {game.published ? "Published" : "Draft"}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {game.preview_image_url && (
                  <img src={game.preview_image_url} alt={game.opponent} className="w-full h-24 object-cover mb-3 rounded" />
                )}
                {game.game_status && game.game_status !== 'Scheduled' && (
                  <Badge variant="secondary" className="mb-2 text-[10px]">
                    {game.game_status}
                  </Badge>
                )}
                <div className="flex gap-2">
                  <Button onClick={() => handleEdit(game)} variant="outline" size="sm" className="flex-1">
                    <Pencil className="w-3 h-3 mr-1" />
                    Edit
                  </Button>
                  <Button
                    onClick={() => deleteMutation.mutate(game.id)}
                    variant="destructive"
                    size="sm"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
