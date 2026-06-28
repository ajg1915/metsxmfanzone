import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, UserPlus, Check, RefreshCw, KeyRound } from "lucide-react";
import { maskEmail, maskSensitiveField } from "@/utils/secureDataVault";

interface SignupRow {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
  sub_status: string | null;
  sub_plan: string | null;
  sub_id: string | null;
}

export default function SignupsTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState<SignupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<"7" | "30" | "90" | "all">("30");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => { fetch(); }, []);

  const fetch = async () => {
    setLoading(true);
    try {
      const [{ data: profiles }, { data: subs }] = await Promise.all([
        supabase.from("profiles").select("id, email, full_name, created_at").order("created_at", { ascending: false }).limit(250),
        supabase.from("subscriptions").select("id, user_id, plan_type, status").order("created_at", { ascending: false }),
      ]);
      const merged: SignupRow[] = (profiles || []).map(p => {
        const s = subs?.find(x => x.user_id === p.id && x.status === "active") || subs?.find(x => x.user_id === p.id);
        return {
          id: p.id, email: p.email, full_name: p.full_name, created_at: p.created_at || "",
          sub_status: s?.status || null, sub_plan: s?.plan_type || null, sub_id: s?.id || null,
        };
      });
      setRows(merged);
    } finally { setLoading(false); }
  };

  const filtered = useMemo(() => {
    if (range === "all") return rows;
    const days = parseInt(range);
    const cutoff = Date.now() - days * 86400_000;
    return rows.filter(r => r.created_at && new Date(r.created_at).getTime() >= cutoff);
  }, [rows, range]);

  const stats = useMemo(() => ({
    total: filtered.length,
    paid: filtered.filter(r => r.sub_status === "active" && r.sub_plan && r.sub_plan !== "free").length,
    pending: filtered.filter(r => r.sub_status === "pending").length,
    nosub: filtered.filter(r => !r.sub_status || r.sub_status === "none").length,
  }), [filtered]);

  const activate = async (r: SignupRow, plan: "premium" | "annual") => {
    setBusyId(r.id);
    try {
      const end = new Date();
      if (plan === "annual") end.setFullYear(end.getFullYear() + 1); else end.setMonth(end.getMonth() + 1);
      const payload: any = {
        plan_type: plan, status: "active", amount: plan === "annual" ? 129.99 : 9.99,
        payment_method: "manual", start_date: new Date().toISOString(), end_date: end.toISOString(),
      };
      if (r.sub_id) await supabase.from("subscriptions").update(payload).eq("id", r.sub_id);
      else await supabase.from("subscriptions").insert({ user_id: r.id, ...payload });
      toast({ title: "Activated", description: `${plan} active for ${maskEmail(r.email)}` });
      fetch();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setBusyId(null); }
  };

  const reset = async (r: SignupRow) => {
    if (!r.email) return;
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(r.email, {
        redirectTo: `${window.location.origin}/auth?mode=reset`,
      });
      if (error) throw error;
      toast({ title: "Reset sent" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Signups", value: stats.total },
          { label: "Paid", value: stats.paid, color: "text-affirmative" },
          { label: "Pending", value: stats.pending, color: "text-yellow-500" },
          { label: "No subscription", value: stats.nosub, color: "text-muted-foreground" },
        ].map(s => (
          <Card key={s.label}><CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color || ""}`}>{s.value}</p>
          </CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><UserPlus className="w-4 h-4 text-primary" /> New signups</CardTitle>
          <div className="flex gap-2 items-center">
            <Select value={range} onValueChange={(v: any) => setRange(v)}>
              <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="h-8" onClick={fetch}><RefreshCw className="w-3.5 h-3.5" /></Button>
          </div>
        </CardHeader>
        <CardContent className="px-0">
          {loading ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div> : (
            <div className="overflow-x-auto">
              <Table className="text-sm">
                <TableHeader><TableRow>
                  <TableHead>User</TableHead><TableHead>Signed up</TableHead><TableHead>Status</TableHead><TableHead>Plan</TableHead><TableHead className="text-right pr-4">Quick action</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {filtered.map(r => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <p className="font-mono text-xs font-medium">{r.full_name ? maskSensitiveField(r.full_name) : "—"}</p>
                        <p className="font-mono text-xs text-muted-foreground">{maskEmail(r.email)}</p>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {r.created_at ? new Date(r.created_at).toLocaleString() : "—"}
                      </TableCell>
                      <TableCell>
                        {r.sub_status === "active" ? <Badge className="bg-affirmative text-white text-[10px]">active</Badge>
                          : r.sub_status === "pending" ? <Badge className="bg-yellow-500 text-white text-[10px]">pending</Badge>
                          : <Badge variant="outline" className="text-[10px]">no sub</Badge>}
                      </TableCell>
                      <TableCell className="text-xs capitalize">{r.sub_plan || "—"}</TableCell>
                      <TableCell className="text-right pr-3">
                        <div className="flex items-center justify-end gap-1">
                          {busyId === r.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => activate(r, "premium")} disabled={busyId === r.id}>
                            <Check className="w-3 h-3 mr-1" /> Premium
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => activate(r, "annual")} disabled={busyId === r.id}>
                            <Check className="w-3 h-3 mr-1" /> Annual
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => reset(r)} title="Send password reset">
                            <KeyRound className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No signups in this range.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
