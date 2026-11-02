import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, Edit, ArrowUp, ArrowDown, HelpCircle } from "lucide-react";
import { AdminPage, AdminPageHeader, AdminList, AdminListCard, AdminRow, AdminEmpty, AdminLoading, AdminIconButton, AdminFilterChips } from "@/components/admin/AdminUI";
import { GUIDE_SECTIONS, PLATFORMS, type GuideItem } from "@/hooks/useGuideItems";
import { useQueryClient } from "@tanstack/react-query";

// Table is new, so it isn't in the generated Supabase types yet.
const table = () => supabase.from("guide_items" as never) as any;

const BLANK = { kind: "find", title: "", body: "", where_label: "", path: "/", section: "", place: "below", enabled: true, suggested: false, highlight_new: false, platforms: ["mobile", "tablet", "desktop", "tv", "app"] as string[] };
type Form = typeof BLANK;

export default function GuideManagement() {
  const qc = useQueryClient();
  const [items, setItems] = useState<GuideItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"find" | "tour">("find");
  const [editing, setEditing] = useState<GuideItem | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(BLANK);

  const load = async () => {
    const { data, error } = await table().select("*").order("sort_order", { ascending: true });
    if (error) toast({ title: "Could not load the guide", description: error.message, variant: "destructive" });
    setItems((data || []) as GuideItem[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);
  const refresh = async () => { await load(); qc.invalidateQueries({ queryKey: ["guide-items"] }); };

  const known = !form.section || GUIDE_SECTIONS.some((g) => g.key === form.section);
  const shown = useMemo(() => items.filter((i) => i.kind === tab), [items, tab]);

  const startNew = () => { setEditing(null); setForm({ ...BLANK, kind: tab, path: tab === "tour" ? "" : "/" }); setOpen(true); };
  const startEdit = (it: GuideItem) => {
    setEditing(it);
    setForm({ kind: it.kind, title: it.title, body: it.body || "", where_label: it.where_label || "", path: it.path || "/", section: it.section || "", place: it.place, enabled: it.enabled, suggested: it.suggested, highlight_new: it.highlight_new, platforms: it.platforms || BLANK.platforms });
    setOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    if (!form.platforms.length) return toast({ title: "Pick at least one device", variant: "destructive" });
    const row = { ...form, title: form.title.trim(), body: form.body.trim() || null, where_label: form.where_label.trim() || null, path: form.path.trim() || null, section: form.section || null };
    const { error } = editing
      ? await table().update(row).eq("id", editing.id)
      : await table().insert({ ...row, sort_order: (Math.max(0, ...items.map((i) => i.sort_order)) + 1) });
    if (error) return toast({ title: "Save failed", description: error.message, variant: "destructive" });
    toast({ title: editing ? "Saved" : "Added" });
    setOpen(false);
    refresh();
  };

  const patch = async (it: GuideItem, p: Partial<GuideItem>) => {
    const { error } = await table().update(p).eq("id", it.id);
    if (error) toast({ title: "Update failed", description: error.message, variant: "destructive" });
    refresh();
  };

  const remove = async (it: GuideItem) => {
    if (!confirm(`Delete "${it.title}"?`)) return;
    const { error } = await table().delete().eq("id", it.id);
    if (error) toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    refresh();
  };

  const move = async (it: GuideItem, dir: -1 | 1) => {
    const idx = shown.findIndex((i) => i.id === it.id);
    const other = shown[idx + dir];
    if (!other) return;
    await Promise.all([
      table().update({ sort_order: other.sort_order }).eq("id", it.id),
      table().update({ sort_order: it.sort_order }).eq("id", other.id),
    ]);
    refresh();
  };

  if (loading) return <AdminLoading label="Loading guide…" />;

  return (
    <AdminPage>
      <AdminPageHeader
        icon={HelpCircle}
        title="Mobile Guide"
        count={shown.length}
        description="Edit what phone users see in the tour and in “Where do I find…?”. Turn items on or off, mark Suggested, or flag New to make that section glow for everyone until they tap it."
        actions={<Button size="sm" className="h-8 text-xs gap-1" onClick={startNew}><Plus className="h-3.5 w-3.5" />Add</Button>}
      />
      <AdminFilterChips
        filters={[{ key: "find", label: "Where do I find…?" }, { key: "tour", label: "Tour steps" }]}
        active={tab}
        onChange={(k: string) => setTab(k as "find" | "tour")}
      />
      <AdminList>
        {shown.length === 0 && <AdminEmpty message="No items yet. Tap Add." />}
        {shown.map((it, idx) => (
          <AdminListCard key={it.id} highlight={it.highlight_new}>
            <AdminRow
              title={it.title}
              meta={[it.body, it.where_label, it.section && `jumps to: ${GUIDE_SECTIONS.find((s) => s.key === it.section)?.label || it.section}`, it.path, (it.platforms || []).map((p) => PLATFORMS.find((x) => x.key === p)?.label || p).join("/")].filter(Boolean).join("  ·  ")}
              badges={<>
                {it.suggested && <Badge className="h-4 px-1 text-[9px]">Suggested</Badge>}
                {it.highlight_new && <Badge variant="outline" className="h-4 px-1 text-[9px] border-primary text-primary">NEW glow</Badge>}
                {!it.enabled && <Badge variant="secondary" className="h-4 px-1 text-[9px]">Off</Badge>}
              </>}
              actions={<>
                <Switch checked={it.enabled} onCheckedChange={(v) => patch(it, { enabled: v })} aria-label="Show in guide" />
                <AdminIconButton icon={ArrowUp} title="Move up" onClick={() => move(it, -1)} disabled={idx === 0} />
                <AdminIconButton icon={ArrowDown} title="Move down" onClick={() => move(it, 1)} disabled={idx === shown.length - 1} />
                <AdminIconButton icon={Edit} title="Edit" onClick={() => startEdit(it)} />
                <AdminIconButton icon={Trash2} title="Delete" tone="danger" onClick={() => remove(it)} />
              </>}
            />
          </AdminListCard>
        ))}
      </AdminList>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto bg-background">
          <DialogHeader><DialogTitle>{editing ? "Edit item" : "Add item"}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-3">
            <div><Label>{form.kind === "tour" ? "Step title" : "What are they looking for?"}</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Watch a live game" required /></div>
            {form.kind === "tour" ? (
              <>
                <div><Label>Explanation</Label>
                  <Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={3} /></div>
                <div><Label>Page to show it on (optional)</Label>
                  <Input value={form.path} onChange={(e) => setForm({ ...form, path: e.target.value })} placeholder="/ (leave blank to stay on the current page)" /></div>
                <div><Label>Where the guide card sits (phone and tablet)</Label>
                  <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={form.place} onChange={(e) => setForm({ ...form, place: e.target.value })}>
                    <option value="below">Just below the glow</option>
                    <option value="above">Just above the glow</option>
                    <option value="top">Top of the screen</option>
                    <option value="center">Middle of the screen</option>
                    <option value="bottom">Bottom of the screen</option>
                  </select></div>
              </>
            ) : (
              <>
                <div><Label>Description (optional, shown under the title)</Label>
                  <Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={2} placeholder="A short line that explains it" /></div>
                <div><Label>Where it lives (shown as a pill)</Label>
                  <Input value={form.where_label} onChange={(e) => setForm({ ...form, where_label: e.target.value })} placeholder="Menu › Picks" /></div>
                <div><Label>Page or link it opens (a /page or a full https:// link)</Label>
                  <Input value={form.path} onChange={(e) => setForm({ ...form, path: e.target.value })} placeholder="/picks" /></div>
              </>
            )}
            <div><Label>{form.kind === "tour" ? "Spot to highlight" : "Section to jump to (optional)"}</Label>
              <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={known ? form.section : "__custom"} onChange={(e) => setForm({ ...form, section: e.target.value === "__custom" ? "." : e.target.value })}>
                <option value="">{form.kind === "tour" ? "None (centered card)" : "None, just open the page"}</option>
                {Array.from(new Set(GUIDE_SECTIONS.map((g) => g.group))).map((grp) => (
                  <optgroup key={grp} label={grp}>{GUIDE_SECTIONS.filter((g) => g.group === grp).map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}</optgroup>
                ))}
                <option value="__custom">Custom (CSS selector)…</option>
              </select>
              {!known && <Input className="mt-1.5" value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} placeholder="#my-section or .some-class or [data-guide=&quot;x&quot;]" />}
              <Button type="button" variant="outline" size="sm" className="mt-1.5 h-8 text-xs" onClick={() => window.open(`${(form.path && form.path.startsWith("/") ? form.path : "/")}${(form.path || "/").includes("?") ? "&" : "?"}guidepick=1`, "_blank")}>
                Pick a button on the page…
              </Button>
              <p className="mt-1 text-[11px] text-muted-foreground">Opens that page. Tap the button you want, press Copy, then choose Custom above and paste.</p>
              <p className="mt-1 text-[11px] text-muted-foreground">A new home section just needs data-guide="name" on it, then type that name above as a custom spot.</p></div>
            <div><Label>Show on</Label>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {PLATFORMS.map((p) => {
                  const on = form.platforms.includes(p.key);
                  return <button key={p.key} type="button" onClick={() => setForm({ ...form, platforms: on ? form.platforms.filter((x) => x !== p.key) : [...form.platforms, p.key] })}
                    className={`h-8 rounded-full border px-3 text-xs font-semibold ${on ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}>{p.label}</button>;
                })}
              </div></div>
            <div className="flex items-center justify-between"><Label>Show in guide</Label><Switch checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} /></div>
            {form.kind === "find" && <div className="flex items-center justify-between"><Label>Suggested (pinned at the top)</Label><Switch checked={form.suggested} onCheckedChange={(v) => setForm({ ...form, suggested: v })} /></div>}
            <div className="flex items-center justify-between"><div><Label>Highlight as NEW</Label><p className="text-[11px] text-muted-foreground">Glow on that section for every phone user until they tap it. Changing the text or turning this on again makes it glow again.</p></div>
              <Switch checked={form.highlight_new} onCheckedChange={(v) => setForm({ ...form, highlight_new: v })} /></div>
            <Button type="submit" className="w-full">{editing ? "Save" : "Add"}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </AdminPage>
  );
}
