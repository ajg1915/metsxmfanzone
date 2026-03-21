import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Edit, Eye, Image, Search } from "lucide-react";
import { format } from "date-fns";

interface PopupNotif {
  id: string;
  title: string;
  message: string;
  image_url: string | null;
  button_text: string | null;
  button_url: string | null;
  is_active: boolean;
  show_once_per_session: boolean;
  created_at: string;
}

const PopupNotificationsManagement = () => {
  const [popups, setPopups] = useState<PopupNotif[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<PopupNotif | null>(null);
  const [form, setForm] = useState({
    title: "",
    message: "",
    image_url: "",
    button_text: "Learn More",
    button_url: "",
    is_active: false,
    show_once_per_session: true,
  });
  const { toast } = useToast();

  useEffect(() => { fetchPopups(); }, []);

  const fetchPopups = async () => {
    const { data } = await supabase
      .from("popup_notifications")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setPopups(data as PopupNotif[]);
    setLoading(false);
  };

  const resetForm = () => {
    setEditing(null);
    setForm({
      title: "", message: "", image_url: "", button_text: "Learn More",
      button_url: "", is_active: false, show_once_per_session: true,
    });
  };

  const startEdit = (p: PopupNotif) => {
    setEditing(p);
    setForm({
      title: p.title, message: p.message, image_url: p.image_url || "",
      button_text: p.button_text || "Learn More", button_url: p.button_url || "",
      is_active: p.is_active, show_once_per_session: p.show_once_per_session,
    });
  };

  const handleSave = async () => {
    if (!form.title || !form.message) {
      toast({ title: "Error", description: "Title and message are required", variant: "destructive" });
      return;
    }

    const payload = {
      title: form.title,
      message: form.message,
      image_url: form.image_url || null,
      button_text: form.button_text || null,
      button_url: form.button_url || null,
      is_active: form.is_active,
      show_once_per_session: form.show_once_per_session,
    };

    // If activating this popup, deactivate all others first
    if (form.is_active) {
      await supabase.from("popup_notifications").update({ is_active: false }).neq("id", editing?.id || "");
    }

    let error;
    if (editing) {
      ({ error } = await supabase.from("popup_notifications").update(payload).eq("id", editing.id));
    } else {
      ({ error } = await supabase.from("popup_notifications").insert(payload));
    }

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: editing ? "Updated" : "Created", description: "Popup notification saved" });
      resetForm();
      fetchPopups();
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from("popup_notifications").delete().eq("id", id);
    toast({ title: "Deleted" });
    fetchPopups();
  };

  const toggleActive = async (p: PopupNotif) => {
    const newActive = !p.is_active;
    if (newActive) {
      await supabase.from("popup_notifications").update({ is_active: false }).neq("id", p.id);
    }
    await supabase.from("popup_notifications").update({ is_active: newActive }).eq("id", p.id);
    fetchPopups();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Popup Notifications</h1>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{editing ? "Edit Popup" : "Create New Popup"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Title *</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. 🔥 Big Announcement!" />
          </div>
          <div>
            <Label>Message *</Label>
            <Textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Your popup message..." rows={3} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Image URL (optional)</Label>
              <Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://..." />
            </div>
            <div>
              <Label>Button URL (optional)</Label>
              <Input value={form.button_url} onChange={(e) => setForm({ ...form, button_url: e.target.value })} placeholder="/live or https://..." />
            </div>
          </div>
          <div>
            <Label>Button Text</Label>
            <Input value={form.button_text} onChange={(e) => setForm({ ...form, button_text: e.target.value })} placeholder="Learn More" />
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <Label>Active (show on site)</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.show_once_per_session} onCheckedChange={(v) => setForm({ ...form, show_once_per_session: v })} />
              <Label>Show once per session</Label>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSave}>
              {editing ? "Update Popup" : <><Plus className="w-4 h-4 mr-1" /> Create Popup</>}
            </Button>
            {editing && <Button variant="outline" onClick={resetForm}>Cancel</Button>}
          </div>
        </CardContent>
      </Card>

      {/* List */}
      <div className="space-y-3">
        {loading ? (
          <p className="text-muted-foreground text-sm">Loading...</p>
        ) : popups.length === 0 ? (
          <p className="text-muted-foreground text-sm">No popup notifications yet.</p>
        ) : popups.map((p) => (
          <Card key={p.id} className={p.is_active ? "border-primary" : ""}>
            <CardContent className="p-4 flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {p.is_active && (
                    <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded font-medium">LIVE</span>
                  )}
                  <h3 className="font-semibold text-sm truncate">{p.title}</h3>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{p.message}</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Created {format(new Date(p.created_at), "MMM d, yyyy h:mm a")}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleActive(p)} title={p.is_active ? "Deactivate" : "Activate"}>
                  <Eye className={`w-4 h-4 ${p.is_active ? "text-primary" : "text-muted-foreground"}`} />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(p)}>
                  <Edit className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(p.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default PopupNotificationsManagement;
