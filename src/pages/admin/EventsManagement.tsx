import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Trash2, Plus, Edit } from "lucide-react";
import { format } from "date-fns";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  AdminPage, AdminPageHeader, AdminSearch, AdminList, AdminListCard,
  AdminRow, AdminEmpty, AdminLoading, AdminIconButton,
} from "@/components/admin/AdminUI";

export default function EventsManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    event_date: "",
    location: "",
    image_url: "",
    external_link: "",
    published: false,
  });

  const { data: events, isLoading } = useQuery({
    queryKey: ["admin-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .order("event_date", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from("events").insert([data]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-events"] });
      toast({ title: "Event created successfully" });
      resetForm();
    },
    onError: () => {
      toast({ title: "Failed to create event", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase.from("events").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-events"] });
      toast({ title: "Event updated successfully" });
      resetForm();
    },
    onError: () => {
      toast({ title: "Failed to update event", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-events"] });
      toast({ title: "Event deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete event", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      event_date: "",
      location: "",
      image_url: "",
      external_link: "",
      published: false,
    });
    setIsAdding(false);
    setEditingId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Capture ID before any state changes to prevent null issues
    const idToUpdate = editingId;

    if (idToUpdate) {
      updateMutation.mutate({ id: idToUpdate, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (event: any) => {
    setFormData({
      title: event.title,
      description: event.description || "",
      event_date: event.event_date,
      location: event.location || "",
      image_url: event.image_url || "",
      external_link: event.external_link || "",
      published: event.published,
    });
    setEditingId(event.id);
    setIsAdding(true);
  };

  const filteredEvents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return events || [];
    return (events || []).filter((e: any) =>
      `${e.title} ${e.location || ""}`.toLowerCase().includes(q)
    );
  }, [events, search]);

  return (
    <AdminPage>
      <AdminPageHeader
        icon={Calendar}
        title="Events"
        count={events?.length}
        actions={
          <Button onClick={() => setIsAdding(!isAdding)} size="sm" className="h-8 text-xs">
            <Plus className="w-3.5 h-3.5 mr-1" />
            {isAdding ? "Cancel" : "Add"}
          </Button>
        }
      />

      {isAdding && (
        <Card className="border-border/30">
          <CardHeader className="p-2.5 pb-0">
            <CardTitle className="text-xs">{editingId ? "Edit Event" : "Create New Event"}</CardTitle>
          </CardHeader>
          <CardContent className="p-2.5">
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[10px]">Title *</Label>
                  <Input
                    className="h-8 text-xs"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px]">Event Date & Time *</Label>
                  <Input
                    className="h-8 text-xs"
                    type="datetime-local"
                    value={formData.event_date}
                    onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px]">Location</Label>
                  <Input
                    className="h-8 text-xs"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px]">External Link</Label>
                  <Input
                    className="h-8 text-xs"
                    type="url"
                    value={formData.external_link}
                    onChange={(e) => setFormData({ ...formData, external_link: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px]">Image URL</Label>
                <Input
                  className="h-8 text-xs"
                  type="url"
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px]">Description</Label>
                <Textarea
                  className="text-xs"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.published}
                  onCheckedChange={(checked) => setFormData({ ...formData, published: checked })}
                />
                <Label className="text-xs">Published</Label>
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm" className="h-8 text-xs">
                  {editingId ? "Update" : "Create"} Event
                </Button>
                <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={resetForm}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <AdminSearch value={search} onChange={setSearch} placeholder="Search title or location…" />

      {isLoading ? (
        <AdminLoading label="Loading events…" />
      ) : (
        <AdminList>
          {filteredEvents.length === 0 ? (
            <AdminEmpty message="No events found" />
          ) : (
            filteredEvents.map((event: any) => (
              <AdminListCard key={event.id}>
                <AdminRow
                  title={event.title}
                  badges={
                    <span className={`text-[9px] px-1.5 py-0.5 rounded ${event.published ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"}`}>
                      {event.published ? "Published" : "Draft"}
                    </span>
                  }
                  meta={
                    <span className="flex items-center gap-1">
                      <Calendar className="w-2.5 h-2.5" />
                      {format(new Date(event.event_date), "PPP 'at' p")}
                    </span>
                  }
                  actions={
                    <>
                      <AdminIconButton icon={Edit} title="Edit" onClick={() => handleEdit(event)} />
                      <AdminIconButton icon={Trash2} title="Delete" tone="danger" onClick={() => deleteMutation.mutate(event.id)} />
                    </>
                  }
                />
              </AdminListCard>
            ))
          )}
        </AdminList>
      )}
    </AdminPage>
  );
}
