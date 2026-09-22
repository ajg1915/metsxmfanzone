import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Plus, Trash2, Edit, ThumbsUp, ThumbsDown } from "lucide-react";
import { AdminPage, AdminPageHeader, AdminList, AdminListCard, AdminEmpty, AdminLoading, AdminIconButton } from "@/components/admin/AdminUI";
import { toast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface PlayerEntry {
  id: string;
  player_name: string;
  player_image_url: string | null;
  month: string;
  year: number;
  admin_opinion: string;
  is_active: boolean;
  created_at: string;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const PlayerOfTheMonthManagement = () => {
  const { user } = useAuth();
  const [entries, setEntries] = useState<PlayerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [voteCounts, setVoteCounts] = useState<Record<string, { agree: number; disagree: number }>>({});

  const [form, setForm] = useState({
    player_name: "",
    player_image_url: "",
    month: MONTHS[new Date().getMonth()],
    year: new Date().getFullYear(),
    admin_opinion: "",
    is_active: true,
  });

  useEffect(() => {
    fetchEntries();
  }, []);

  const fetchEntries = async () => {
    const { data, error } = await supabase
      .from("player_of_the_month")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setEntries(data as PlayerEntry[]);

      // Fetch votes for all entries
      const counts: Record<string, { agree: number; disagree: number }> = {};
      for (const entry of data) {
        const { data: votes } = await supabase
          .from("player_of_the_month_votes")
          .select("vote_type")
          .eq("player_of_the_month_id", entry.id);
        counts[entry.id] = {
          agree: votes?.filter(v => v.vote_type === "agree").length || 0,
          disagree: votes?.filter(v => v.vote_type === "disagree").length || 0,
        };
      }
      setVoteCounts(counts);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setForm({
      player_name: "",
      player_image_url: "",
      month: MONTHS[new Date().getMonth()],
      year: new Date().getFullYear(),
      admin_opinion: "",
      is_active: true,
    });
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!form.player_name || !form.admin_opinion) {
      toast({ title: "Missing fields", description: "Player name and opinion are required.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        player_name: form.player_name,
        player_image_url: form.player_image_url || null,
        month: form.month,
        year: form.year,
        admin_opinion: form.admin_opinion,
        is_active: form.is_active,
        created_by: user?.id,
      };

      if (editingId) {
        const { error } = await supabase.from("player_of_the_month").update(payload).eq("id", editingId);
        if (error) throw error;
        toast({ title: "Updated", description: "Player of the Month updated." });
      } else {
        const { error } = await supabase.from("player_of_the_month").insert(payload);
        if (error) throw error;
        toast({ title: "Created", description: "Player of the Month created." });
      }
      resetForm();
      fetchEntries();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (entry: PlayerEntry) => {
    setEditingId(entry.id);
    setForm({
      player_name: entry.player_name,
      player_image_url: entry.player_image_url || "",
      month: entry.month,
      year: entry.year,
      admin_opinion: entry.admin_opinion,
      is_active: entry.is_active,
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this entry?")) return;
    await supabase.from("player_of_the_month").delete().eq("id", id);
    toast({ title: "Deleted" });
    fetchEntries();
  };

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from("player_of_the_month").update({ is_active: !current }).eq("id", id);
    fetchEntries();
  };

  return (
    <AdminPage>
      <AdminPageHeader icon={Trophy} title="Player of the Month" count={entries.length} />

      {/* Form */}
      <Card className="border-border/30">
        <CardHeader className="p-2.5 pb-1">
          <CardTitle className="text-xs">
            {editingId ? "Edit Entry" : "Create New Entry"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Player Name *</Label>
              <Input
                value={form.player_name}
                onChange={e => setForm(f => ({ ...f, player_name: e.target.value }))}
                placeholder="e.g. Francisco Lindor"
              />
            </div>
            <div className="space-y-2">
              <Label>Player Image URL</Label>
              <Input
                value={form.player_image_url}
                onChange={e => setForm(f => ({ ...f, player_image_url: e.target.value }))}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <Label>Month</Label>
              <Select value={form.month} onValueChange={v => setForm(f => ({ ...f, month: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Year</Label>
              <Input
                type="number"
                value={form.year}
                onChange={e => setForm(f => ({ ...f, year: parseInt(e.target.value) || 2026 }))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Your Opinion / Write-up *</Label>
            <Textarea
              value={form.admin_opinion}
              onChange={e => setForm(f => ({ ...f, admin_opinion: e.target.value }))}
              placeholder="Share your thoughts on why this player deserves Player of the Month..."
              rows={5}
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
            <Label>Active (visible on homepage)</Label>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving}>
              {editingId ? "Update" : "Create"}
            </Button>
            {editingId && (
              <Button variant="outline" onClick={resetForm}>Cancel</Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Entries List */}
      <div className="space-y-1.5">
        <h2 className="text-xs font-semibold text-foreground">All Entries</h2>
        {loading ? (
          <AdminLoading />
        ) : entries.length === 0 ? (
          <AdminEmpty message="No entries yet." />
        ) : (
          <AdminList>
            {entries.map(entry => {
              const vc = voteCounts[entry.id] || { agree: 0, disagree: 0 };
              return (
                <AdminListCard key={entry.id} className={!entry.is_active ? "opacity-60" : ""}>
                  <div className="flex flex-col sm:flex-row gap-2 items-start">
                    {entry.player_image_url && (
                      <img src={entry.player_image_url} alt={entry.player_name} className="w-12 h-16 object-cover rounded-md flex-shrink-0" />
                    )}
                    <div className="flex-1 space-y-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-medium truncate">{entry.player_name}</span>
                        <Badge variant="secondary" className="h-4 text-[9px]">{entry.month} {entry.year}</Badge>
                        {entry.is_active && <Badge className="h-4 text-[9px] bg-green-500 text-white">Active</Badge>}
                      </div>
                      <p className="text-[10px] text-muted-foreground line-clamp-2">{entry.admin_opinion}</p>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1"><ThumbsUp className="w-3 h-3" /> {vc.agree}</span>
                        <span className="flex items-center gap-1"><ThumbsDown className="w-3 h-3" /> {vc.disagree}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      <Button variant="outline" size="sm" className="h-7 text-[10px] px-2" onClick={() => toggleActive(entry.id, entry.is_active)}>
                        {entry.is_active ? "Deactivate" : "Activate"}
                      </Button>
                      <AdminIconButton icon={Edit} title="Edit" onClick={() => handleEdit(entry)} />
                      <AdminIconButton icon={Trash2} title="Delete" tone="danger" onClick={() => handleDelete(entry.id)} />
                    </div>
                  </div>
                </AdminListCard>
              );
            })}
          </AdminList>
        )}
      </div>
    </AdminPage>
  );
};

export default PlayerOfTheMonthManagement;
