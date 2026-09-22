import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Copy, Sparkles, Loader2, GripVertical, ListMusic } from "lucide-react";
import { AdminPage, AdminPageHeader, AdminEmpty, AdminLoading } from "@/components/admin/AdminUI";

type Segment = { title: string; duration: string; notes: string };
type Template = {
  id: string;
  name: string;
  description: string | null;
  show_type: string | null;
  duration_minutes: number | null;
  segments: Segment[];
  notes: string | null;
  created_at: string;
};

const blankSeg = (): Segment => ({ title: "", duration: "", notes: "" });

const blankForm = {
  name: "", description: "", show_type: "Game Recap",
  duration_minutes: "30", notes: "",
  segments: [
    { title: "Cold Open / Hook", duration: "1", notes: "Tease the biggest story of the day" },
    { title: "Intro & Show Branding", duration: "2", notes: "Welcome listeners, intro hosts" },
    { title: "Main Topic", duration: "15", notes: "Key discussion / breakdown" },
    { title: "Listener Q&A / Hot Takes", duration: "8", notes: "" },
    { title: "Outro & CTA", duration: "4", notes: "Subscribe, social handles, next show" },
  ] as Segment[],
};

export default function PodcastOutlineTemplates() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const [form, setForm] = useState<typeof blankForm>({ ...blankForm });
  const [generating, setGenerating] = useState(false);
  const [aiTopic, setAiTopic] = useState("");

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["podcast-outline-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("podcast_outline_templates" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data || []) as any[]).map((t) => ({
        ...t,
        segments: Array.isArray(t.segments) ? t.segments : [],
      })) as Template[];
    },
  });

  const reset = () => {
    setEditing(null);
    setForm({ ...blankForm, segments: blankForm.segments.map((s) => ({ ...s })) });
    setAiTopic("");
  };

  const openNew = () => { reset(); setOpen(true); };
  const openEdit = (t: Template) => {
    setEditing(t);
    setForm({
      name: t.name, description: t.description || "",
      show_type: t.show_type || "", duration_minutes: t.duration_minutes?.toString() ?? "",
      notes: t.notes || "", segments: t.segments?.length ? t.segments : [blankSeg()],
    });
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Name required");
      const payload: any = {
        name: form.name.trim(),
        description: form.description || null,
        show_type: form.show_type || null,
        duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : null,
        segments: form.segments,
        notes: form.notes || null,
      };
      if (editing) {
        const { error } = await supabase.from("podcast_outline_templates" as any).update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase.from("podcast_outline_templates" as any).insert({ ...payload, author_id: user?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Template updated" : "Template created");
      qc.invalidateQueries({ queryKey: ["podcast-outline-templates"] });
      setOpen(false); reset();
    },
    onError: (e: any) => toast.error(e.message || "Save failed"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("podcast_outline_templates" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["podcast-outline-templates"] });
    },
  });

  const duplicate = async (t: Template) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("podcast_outline_templates" as any).insert({
      name: `${t.name} (Copy)`, description: t.description, show_type: t.show_type,
      duration_minutes: t.duration_minutes, segments: t.segments, notes: t.notes,
      author_id: user?.id,
    });
    if (error) toast.error(error.message); else {
      toast.success("Duplicated");
      qc.invalidateQueries({ queryKey: ["podcast-outline-templates"] });
    }
  };

  const updateSeg = (i: number, patch: Partial<Segment>) => {
    setForm((f) => ({ ...f, segments: f.segments.map((s, idx) => idx === i ? { ...s, ...patch } : s) }));
  };
  const addSeg = () => setForm((f) => ({ ...f, segments: [...f.segments, blankSeg()] }));
  const removeSeg = (i: number) => setForm((f) => ({ ...f, segments: f.segments.filter((_, idx) => idx !== i) }));
  const moveSeg = (i: number, dir: -1 | 1) => {
    setForm((f) => {
      const arr = [...f.segments];
      const j = i + dir;
      if (j < 0 || j >= arr.length) return f;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return { ...f, segments: arr };
    });
  };

  const generateAI = async () => {
    if (!aiTopic.trim()) { toast.error("Enter a topic / show idea"); return; }
    setGenerating(true);
    try {
      const prompt = `Generate a podcast script outline for a Mets fan podcast.
Show type: ${form.show_type || "general"}
Total duration target: ${form.duration_minutes || "30"} minutes
Topic / focus: ${aiTopic}

Output ONLY valid JSON (no markdown, no fences) with shape:
{
  "name": "string short title for the template",
  "description": "1-2 sentence pitch",
  "segments": [{ "title": "string", "duration": "minutes string", "notes": "talking points / script bullets" }]
}
Include 5-8 segments covering hook, intro, main, sub-segments, listener interaction, sponsor/CTA, outro.`;
      const { data, error } = await supabase.functions.invoke("ai-generate-text", { body: { prompt } });
      if (error) throw error;
      const m: string = data?.text || "";
      const j = m.match(/\{[\s\S]*\}/);
      if (!j) throw new Error("Could not parse AI output");
      const parsed = JSON.parse(j[0]);
      setForm((f) => ({
        ...f,
        name: parsed.name || f.name,
        description: parsed.description || f.description,
        segments: Array.isArray(parsed.segments) && parsed.segments.length
          ? parsed.segments.map((s: any) => ({ title: s.title || "", duration: String(s.duration || ""), notes: s.notes || "" }))
          : f.segments,
      }));
      toast.success("Outline generated");
    } catch (e: any) {
      toast.error(e.message || "AI failed");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <AdminPage>
      <AdminPageHeader
        icon={ListMusic}
        title="Podcast Outline Templates"
        count={templates.length}
        countLabel="templates"
        description="Reusable script outlines for your podcast shows"
        actions={
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
          <DialogTrigger asChild>
            <Button size="sm" className="h-8 text-xs" onClick={openNew}><Plus className="w-3.5 h-3.5 mr-1" />New Template</Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Template" : "New Template"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Template Name</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div>
                  <Label>Show Type</Label>
                  <Input value={form.show_type} onChange={(e) => setForm({ ...form, show_type: e.target.value })} placeholder="Game Recap, Interview, Roundtable..." />
                </div>
                <div>
                  <Label>Total Duration (min)</Label>
                  <Input type="number" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <Label>Description</Label>
                  <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
              </div>

              <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2">
                <Label className="text-xs">AI Outline Generator</Label>
                <div className="flex gap-2">
                  <Input placeholder="e.g. Recap of Mets vs Braves series, or Soto trade reaction" value={aiTopic} onChange={(e) => setAiTopic(e.target.value)} />
                  <Button type="button" variant="outline" onClick={generateAI} disabled={generating}>
                    {generating ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
                    Generate
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Segments</Label>
                  <Button type="button" size="sm" variant="outline" onClick={addSeg}><Plus className="w-3 h-3 mr-1" />Add Segment</Button>
                </div>
                {form.segments.map((s, i) => (
                  <div key={i} className="border border-border rounded-md p-2 space-y-2 bg-muted/20">
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col">
                        <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => moveSeg(i, -1)}>▲</button>
                        <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => moveSeg(i, 1)}>▼</button>
                      </div>
                      <Input className="flex-1" placeholder="Segment title" value={s.title} onChange={(e) => updateSeg(i, { title: e.target.value })} />
                      <Input className="w-20" placeholder="min" value={s.duration} onChange={(e) => updateSeg(i, { duration: e.target.value })} />
                      <Button type="button" size="icon" variant="ghost" onClick={() => removeSeg(i)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                    <Textarea rows={2} placeholder="Talking points / script bullets" value={s.notes} onChange={(e) => updateSeg(i, { notes: e.target.value })} />
                  </div>
                ))}
              </div>

              <div>
                <Label>Production Notes</Label>
                <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Music cues, ad reads, guest links..." />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => save.mutate()} disabled={save.isPending}>
                {save.isPending ? "Saving..." : "Save Template"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        }
      />

      <Card className="border-border/30">
        <CardHeader className="p-2.5 pb-1"><CardTitle className="text-xs font-semibold">Saved Templates</CardTitle></CardHeader>
        <CardContent className="p-2.5 pt-1">
          {isLoading ? <AdminLoading />
          : templates.length === 0 ? <AdminEmpty message="No templates yet — create your first." />
          : (
            <div className="grid gap-3 md:grid-cols-2">
              {templates.map((t) => (
                <Card key={t.id} className="bg-muted/20">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm truncate">{t.name}</h3>
                        <div className="flex gap-1 flex-wrap mt-1">
                          {t.show_type && <Badge variant="secondary" className="text-[10px]">{t.show_type}</Badge>}
                          {t.duration_minutes && <Badge variant="outline" className="text-[10px]">{t.duration_minutes} min</Badge>}
                          <Badge variant="outline" className="text-[10px]">{t.segments?.length || 0} segments</Badge>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => duplicate(t)}><Copy className="w-4 h-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => openEdit(t)}><Pencil className="w-4 h-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => { if (confirm("Delete template?")) del.mutate(t.id); }}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    {t.description && <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>}
                    <ol className="text-xs space-y-0.5 list-decimal list-inside text-muted-foreground">
                      {(t.segments || []).slice(0, 6).map((s, i) => (
                        <li key={i} className="truncate">
                          <span className="text-foreground">{s.title}</span>{s.duration ? ` · ${s.duration}m` : ""}
                        </li>
                      ))}
                    </ol>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </AdminPage>
  );
}