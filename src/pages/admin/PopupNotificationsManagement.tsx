import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Edit, Eye, Image, Search, Bell } from "lucide-react";
import { AdminPage, AdminPageHeader, AdminList, AdminListCard, AdminRow, AdminIconButton, AdminEmpty, AdminLoading, AdminSearch } from "@/components/admin/AdminUI";
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
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [mediaFiles, setMediaFiles] = useState<{ id: string; file_url: string; file_name: string; file_type: string | null }[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaSearch, setMediaSearch] = useState("");
  const { toast } = useToast();

  const fetchMediaFiles = async () => {
    setMediaLoading(true);
    const { data } = await supabase
      .from("media_library")
      .select("id, file_url, file_name, file_type")
      .order("created_at", { ascending: false });
    if (data) setMediaFiles(data);
    setMediaLoading(false);
  };

  const openMediaPicker = () => {
    setMediaSearch("");
    if (mediaFiles.length === 0) fetchMediaFiles();
    setMediaPickerOpen(true);
  };

  const filteredMedia = mediaFiles.filter(f =>
    f.file_name.toLowerCase().includes(mediaSearch.toLowerCase()) &&
    (f.file_type?.startsWith("image") ?? true)
  );

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
    <AdminPage>
      <AdminPageHeader icon={Bell} title="Popup Notifications" count={popups.length} />

      {/* Form */}
      <Card className="border-border/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">{editing ? "Edit Popup" : "Create New Popup"}</CardTitle>
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
              <Label>Image (optional)</Label>
              <div className="flex gap-2 mt-1">
                {form.image_url ? (
                  <div className="relative w-20 h-14 rounded border overflow-hidden flex-shrink-0">
                    <img src={form.image_url} alt="" className="w-full h-full object-cover" />
                    <button onClick={() => setForm({ ...form, image_url: "" })} className="absolute top-0 right-0 bg-black/60 text-white text-[10px] px-1 rounded-bl">✕</button>
                  </div>
                ) : null}
                <Button type="button" variant="outline" size="sm" onClick={openMediaPicker} className="gap-1.5">
                  <Image className="w-3.5 h-3.5" /> {form.image_url ? "Change" : "Select from Media Library"}
                </Button>
              </div>
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
      {loading ? (
        <AdminLoading label="Loading popups…" />
      ) : (
        <AdminList>
          {popups.length === 0 ? (
            <AdminEmpty message="No popup notifications yet." />
          ) : popups.map((p) => (
            <AdminListCard key={p.id} highlight={p.is_active}>
              <AdminRow
                title={p.title}
                badges={p.is_active && (
                  <Badge className="h-4 text-[9px] bg-primary text-primary-foreground">LIVE</Badge>
                )}
                meta={`Created ${format(new Date(p.created_at), "MMM d, yyyy h:mm a")}`}
                actions={
                  <>
                    <AdminIconButton
                      icon={Eye}
                      title={p.is_active ? "Deactivate" : "Activate"}
                      tone={p.is_active ? "primary" : "default"}
                      onClick={() => toggleActive(p)}
                    />
                    <AdminIconButton icon={Edit} title="Edit" onClick={() => startEdit(p)} />
                    <AdminIconButton icon={Trash2} title="Delete" tone="danger" onClick={() => handleDelete(p.id)} />
                  </>
                }
                body={<p className="text-[10px] text-muted-foreground line-clamp-2">{p.message}</p>}
              />
            </AdminListCard>
          ))}
        </AdminList>
      )}

      {/* Media Library Picker */}
      <Dialog open={mediaPickerOpen} onOpenChange={setMediaPickerOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Select Image from Media Library</DialogTitle>
          </DialogHeader>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search images..." value={mediaSearch} onChange={(e) => setMediaSearch(e.target.value)} className="pl-9" />
          </div>
          <ScrollArea className="h-[50vh]">
            {mediaLoading ? (
              <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>
            ) : filteredMedia.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No images found</p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {filteredMedia.map((file) => (
                  <button
                    key={file.id}
                    onClick={() => {
                      setForm({ ...form, image_url: file.file_url });
                      setMediaPickerOpen(false);
                      toast({ title: "Image selected", description: file.file_name });
                    }}
                    className="group relative aspect-square rounded-md overflow-hidden border border-border hover:border-primary transition-colors"
                  >
                    <img src={file.file_url} alt={file.file_name} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-end">
                      <span className="text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity p-1 truncate w-full">{file.file_name}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </AdminPage>
  );
};

export default PopupNotificationsManagement;
