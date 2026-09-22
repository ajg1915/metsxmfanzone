import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Sparkles, Loader2, Film } from "lucide-react";
import { AdminPage, AdminPageHeader, AdminList, AdminListCard, AdminRow, AdminEmpty, AdminLoading, AdminIconButton } from "@/components/admin/AdminUI";
import { format } from "date-fns";

type Recap = {
  id: string;
  title: string;
  slug: string;
  opponent: string | null;
  game_date: string | null;
  home_away: string | null;
  mets_score: number | null;
  opponent_score: number | null;
  result: string | null;
  summary: string | null;
  body: string | null;
  hero_image_url: string | null;
  status: string;
  published_at: string | null;
  created_at: string;
};

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").slice(0, 80);

const blank = {
  title: "", slug: "", opponent: "", game_date: "", home_away: "home",
  mets_score: "", opponent_score: "", summary: "", body: "", hero_image_url: "",
  status: "draft" as "draft" | "published",
};

export default function GameRecapsManagement() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Recap | null>(null);
  const [form, setForm] = useState({ ...blank });
  const [generating, setGenerating] = useState(false);
  const [autoGenerating, setAutoGenerating] = useState(false);

  const generateFromMLB = async () => {
    setAutoGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-game-recap");
      if (error) throw error;
      if (data?.skipped) {
        toast.info(data.reason || "No completed Mets game to recap");
      } else {
        toast.success("Recap generated from MLB data");
        qc.invalidateQueries({ queryKey: ["admin-game-recaps"] });
      }
    } catch (e: any) {
      toast.error(e.message || "Generation failed");
    } finally {
      setAutoGenerating(false);
    }
  };

  const { data: recaps = [], isLoading } = useQuery({
    queryKey: ["admin-game-recaps"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("game_recaps" as any)
        .select("*")
        .order("game_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Recap[];
    },
  });

  const reset = () => { setEditing(null); setForm({ ...blank }); };

  const openNew = () => { reset(); setOpen(true); };
  const openEdit = (r: Recap) => {
    setEditing(r);
    setForm({
      title: r.title, slug: r.slug, opponent: r.opponent || "",
      game_date: r.game_date || "", home_away: r.home_away || "home",
      mets_score: r.mets_score?.toString() ?? "",
      opponent_score: r.opponent_score?.toString() ?? "",
      summary: r.summary || "", body: r.body || "",
      hero_image_url: r.hero_image_url || "",
      status: (r.status as any) || "draft",
    });
    setOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error("Title required");
      const ms = form.mets_score === "" ? null : Number(form.mets_score);
      const os = form.opponent_score === "" ? null : Number(form.opponent_score);
      const result = ms != null && os != null ? (ms > os ? "W" : ms < os ? "L" : "T") : null;
      const slug = (form.slug || slugify(form.title)) || slugify(form.title);
      const payload: any = {
        title: form.title.trim(),
        slug,
        opponent: form.opponent || null,
        game_date: form.game_date || null,
        home_away: form.home_away || null,
        mets_score: ms,
        opponent_score: os,
        result,
        summary: form.summary || null,
        body: form.body || null,
        hero_image_url: form.hero_image_url || null,
        status: form.status,
        published_at: form.status === "published" ? new Date().toISOString() : null,
      };
      if (editing) {
        const { error } = await supabase.from("game_recaps" as any).update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase.from("game_recaps" as any).insert({ ...payload, author_id: user?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Recap updated" : "Recap created");
      qc.invalidateQueries({ queryKey: ["admin-game-recaps"] });
      setOpen(false); reset();
    },
    onError: (e: any) => toast.error(e.message || "Save failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("game_recaps" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Recap deleted");
      qc.invalidateQueries({ queryKey: ["admin-game-recaps"] });
    },
    onError: (e: any) => toast.error(e.message || "Delete failed"),
  });

  const generateAI = async () => {
    if (!form.opponent || form.mets_score === "" || form.opponent_score === "") {
      toast.error("Fill opponent + scores first");
      return;
    }
    setGenerating(true);
    try {
      const prompt = `Write a polished, engaging Mets game recap.
Opponent: ${form.opponent}
Date: ${form.game_date || "recent"}
Location: ${form.home_away === "home" ? "Citi Field (home)" : "Away"}
Final score: Mets ${form.mets_score} - ${form.opponent} ${form.opponent_score}
Output ONLY valid JSON with fields: title (catchy headline), summary (1-2 sentences), body (4-6 paragraphs HTML with <p> tags, mention key plays). No markdown, no code fences.`;
      const { data, error } = await supabase.functions.invoke("ai-generate-text", { body: { prompt } });
      if (error) throw error;
      const full: string = data?.text || "";
      const m = full.match(/\{[\s\S]*\}/);
      if (m) {
        const parsed = JSON.parse(m[0]);
        setForm((f) => ({
          ...f,
          title: parsed.title || f.title,
          summary: parsed.summary || f.summary,
          body: parsed.body || f.body,
          slug: f.slug || slugify(parsed.title || f.title),
        }));
        toast.success("Generated draft");
      } else {
        setForm((f) => ({ ...f, body: full }));
        toast.success("Generated body");
      }
    } catch (e: any) {
      toast.error(e.message || "AI failed");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <AdminPage>
      <AdminPageHeader
        icon={Film}
        title="Game Recaps"
        count={recaps.length}
        description="Write & publish Mets game recaps"
        actions={
          <>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={generateFromMLB} disabled={autoGenerating}>
              {autoGenerating ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1" />}
              Generate from MLB
            </Button>
            <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
              <DialogTrigger asChild>
                <Button size="sm" className="h-8 text-xs" onClick={openNew}><Plus className="w-3.5 h-3.5 mr-1" />New Recap</Button>
              </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Recap" : "Create Recap"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Title</Label>
                <Input value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value, slug: form.slug || slugify(e.target.value) })} />
              </div>
              <div>
                <Label>Slug</Label>
                <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Opponent</Label>
                  <Input value={form.opponent} onChange={(e) => setForm({ ...form, opponent: e.target.value })} placeholder="Braves" />
                </div>
                <div>
                  <Label>Game Date</Label>
                  <Input type="date" value={form.game_date} onChange={(e) => setForm({ ...form, game_date: e.target.value })} />
                </div>
                <div>
                  <Label>Home/Away</Label>
                  <Select value={form.home_away} onValueChange={(v) => setForm({ ...form, home_away: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="home">Home</SelectItem>
                      <SelectItem value="away">Away</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v: any) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Mets Score</Label>
                  <Input type="number" value={form.mets_score} onChange={(e) => setForm({ ...form, mets_score: e.target.value })} />
                </div>
                <div>
                  <Label>Opponent Score</Label>
                  <Input type="number" value={form.opponent_score} onChange={(e) => setForm({ ...form, opponent_score: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Hero Image URL</Label>
                <Input value={form.hero_image_url} onChange={(e) => setForm({ ...form, hero_image_url: e.target.value })} />
              </div>
              <div>
                <Label>Summary</Label>
                <Textarea rows={2} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label>Body (HTML supported)</Label>
                  <Button type="button" size="sm" variant="outline" onClick={generateAI} disabled={generating}>
                    {generating ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
                    AI Draft
                  </Button>
                </div>
                <Textarea rows={10} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Saving..." : "Save"}
              </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
        }
      />

      {isLoading ? (
        <AdminLoading />
      ) : (
        <AdminList>
          {recaps.length === 0 ? (
            <AdminEmpty message="No recaps yet." />
          ) : (
            recaps.map((r) => (
              <AdminListCard key={r.id}>
                <AdminRow
                  title={r.title}
                  badges={
                    <>
                      <Badge variant={r.status === "published" ? "default" : "secondary"} className="h-4 text-[9px]">
                        {r.status}
                      </Badge>
                      {r.result && <Badge variant="outline" className="h-4 text-[9px]">{r.result} {r.mets_score}-{r.opponent_score}</Badge>}
                    </>
                  }
                  meta={<>{r.opponent ? `vs ${r.opponent}` : ""} {r.game_date ? `• ${format(new Date(r.game_date), "MMM d, yyyy")}` : ""}</>}
                  actions={
                    <>
                      <AdminIconButton icon={Pencil} title="Edit" onClick={() => openEdit(r)} />
                      <AdminIconButton icon={Trash2} title="Delete" tone="danger" onClick={() => { if (confirm("Delete recap?")) deleteMutation.mutate(r.id); }} />
                    </>
                  }
                  body={r.summary ? <p className="text-[10px] text-muted-foreground line-clamp-2">{r.summary}</p> : undefined}
                />
              </AdminListCard>
            ))
          )}
        </AdminList>
      )}
    </AdminPage>
  );
}
