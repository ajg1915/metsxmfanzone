import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Users } from "lucide-react";
import { AdminPage, AdminPageHeader, AdminLoading } from "@/components/admin/AdminUI";
import { toast } from "@/hooks/use-toast";

interface Info {
  player_id: number;
  player_name: string;
  contract_years: string;
  contract_total: string;
  contract_aav: string;
  contract_through: string;
  contract_notes: string;
  watch_note: string;
}
const blank = (id: number, name: string): Info => ({
  player_id: id, player_name: name, contract_years: "", contract_total: "", contract_aav: "",
  contract_through: "", contract_notes: "", watch_note: "",
});

const RosterDetailsManagement = () => {
  const [players, setPlayers] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [form, setForm] = useState<Info | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("https://statsapi.mlb.com/api/v1/teams/121/roster?rosterType=40Man");
        const json = await res.json();
        setPlayers(
          (json.roster ?? [])
            .map((e: any) => ({ id: e.person.id as number, name: e.person.fullName as string }))
            .sort((a: any, b: any) => a.name.localeCompare(b.name)),
        );
      } catch {
        toast({ title: "Couldn't load the roster", variant: "destructive" });
      }
      setLoading(false);
    })();
  }, []);

  const pick = async (id: number) => {
    setSelected(id);
    const name = players.find((p) => p.id === id)?.name ?? "";
    const { data } = await supabase.from("mets_player_info" as any).select("*").eq("player_id", id).maybeSingle();
    const d = (data ?? {}) as Partial<Info>;
    setForm({ ...blank(id, name), ...Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v ?? ""])) } as Info);
  };

  const save = async () => {
    if (!form) return;
    setSaving(true);
    const { error } = await supabase
      .from("mets_player_info" as any)
      .upsert({ ...form, updated_at: new Date().toISOString() } as any);
    setSaving(false);
    toast(error ? { title: "Save failed", description: error.message, variant: "destructive" } : { title: "Saved" });
  };

  const field = (k: keyof Info, label: string, ph?: string) => (
    <div>
      <Label>{label}</Label>
      <Input value={form?.[k] as string} placeholder={ph} onChange={(e) => setForm((f) => f && { ...f, [k]: e.target.value })} />
    </div>
  );

  return (
    <AdminPage>
      <AdminPageHeader icon={Users} title="Roster Details" description="Contracts and Player Watch notes shown on each player's card in Game Center." />
      {loading ? (
        <AdminLoading />
      ) : (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div>
              <Label>Player</Label>
              <select
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={selected ?? ""}
                onChange={(e) => pick(Number(e.target.value))}
              >
                <option value="" disabled>Choose a player…</option>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            {form && (
              <>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {field("contract_years", "Length", "5 years")}
                  {field("contract_total", "Total", "$75M")}
                  {field("contract_aav", "Per year", "$15M")}
                  {field("contract_through", "Through", "2028")}
                </div>
                <div>
                  <Label>Contract notes</Label>
                  <Textarea value={form.contract_notes} placeholder="Opt-outs, club options, deferrals…" onChange={(e) => setForm({ ...form, contract_notes: e.target.value })} />
                </div>
                <div>
                  <Label>Player Watch note</Label>
                  <Textarea value={form.watch_note} placeholder="Shown at the top of the player's card" onChange={(e) => setForm({ ...form, watch_note: e.target.value })} />
                </div>
                <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </AdminPage>
  );
};

export default RosterDetailsManagement;
