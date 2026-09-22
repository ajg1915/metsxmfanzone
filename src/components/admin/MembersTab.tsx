import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Loader2, Trash2, Users, UserCheck, UserX, Lock, Unlock, Eye, EyeOff,
  KeyRound, MoreHorizontal, CalendarPlus, DollarSign, ShieldPlus, Search, Filter, RefreshCw, Ban, Check, Timer,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useAuth";
import { maskEmail, maskSensitiveField, vaultAuthHeaders } from "@/utils/secureDataVault";

interface MemberRow {
  user_id: string;
  subscription_id: string | null;
  email: string | null;
  full_name: string | null;
  phone_number: string | null;
  plan_type: string;
  status: string;
  end_date: string | null;
  roles: string[];
  joined_date: string;
  payment_method: string | null;
  amount: number | null;
  last_payment_date: string | null;
  cancellation_count: number;
  limited_access: boolean;
}

type StatusFilter = "all" | "active" | "pending" | "cancelled" | "none";
type PlanFilter = "all" | "free" | "trial" | "premium" | "annual";

export default function MembersTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [decrypted, setDecrypted] = useState(false);
  const [decrypting, setDecrypting] = useState(false);
  const [decryptedData, setDecryptedData] = useState<Map<string, { email: string; full_name: string; phone_number: string }>>(new Map());
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [planFilter, setPlanFilter] = useState<PlanFilter>("all");
  const [pendingDelete, setPendingDelete] = useState<MemberRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [customTarget, setCustomTarget] = useState<{ member: MemberRow; mode: "trial" | "extend" } | null>(null);
  const [customDays, setCustomDays] = useState("14");

  useEffect(() => { fetchMembers(); }, []);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const [{ data: profiles }, { data: subscriptions }, { data: roles }, { data: accessActivity }] = await Promise.all([
        supabase.from("profiles").select("id, email, full_name, phone_number, created_at").order("created_at", { ascending: false }),
        supabase.from("subscriptions").select("id, user_id, plan_type, status, end_date, payment_method, amount, last_payment_date").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("subscription_activity").select("user_id, action, created_at").in("action", ["membership_cancelled", "account_cancelled_deleted", "access_restored"]).order("created_at", { ascending: false }),
      ]);

      const roleMap = new Map<string, string[]>();
      roles?.forEach(r => {
        const existing = roleMap.get(r.user_id) || [];
        existing.push(r.role);
        roleMap.set(r.user_id, existing);
      });
      const accessMap = new Map<string, number>();
      const activityByUser = new Map<string, typeof accessActivity>();
      (accessActivity || []).forEach((event) => {
        activityByUser.set(event.user_id, [...(activityByUser.get(event.user_id) || []), event]);
      });
      activityByUser.forEach((events, userId) => {
        const latestRestore = events?.find((event) => event.action === "access_restored")?.created_at;
        accessMap.set(userId, (events || []).filter((event) =>
          event.action !== "access_restored" && (!latestRestore || event.created_at > latestRestore)
        ).length);
      });

      const rows: MemberRow[] = (profiles || []).map(p => {
        const sub = subscriptions?.find(s => s.user_id === p.id && s.status === "active")
          || subscriptions?.find(s => s.user_id === p.id);
        return {
          user_id: p.id,
          subscription_id: sub?.id || null,
          email: p.email,
          full_name: p.full_name,
          phone_number: p.phone_number || null,
          plan_type: sub?.plan_type || "free",
          status: sub?.status || "none",
          end_date: sub?.end_date || null,
          roles: roleMap.get(p.id) || [],
          joined_date: p.created_at || "",
          payment_method: sub?.payment_method || null,
          amount: sub?.amount || null,
          last_payment_date: sub?.last_payment_date || null,
          cancellation_count: accessMap.get(p.id) || 0,
          limited_access: (accessMap.get(p.id) || 0) > 2,
        };
      });
      setMembers(rows);
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "Failed to load members", variant: "destructive" });
    } finally { setLoading(false); }
  };

  const handleDecryptToggle = async () => {
    if (decrypted) { setDecrypted(false); setDecryptedData(new Map()); return; }
    setDecrypting(true);
    try {
      const { data, error } = await supabase.functions.invoke("secure-data-vault", {
        headers: await vaultAuthHeaders(),
        body: { action: "fetch-decrypted", dataType: "profiles", data: { limit: 500, offset: 0 } },
      });
      if (error) throw error;
      const map = new Map<string, { email: string; full_name: string; phone_number: string }>();
      (data?.records || []).forEach((r: any) => {
        map.set(r.id, { email: r.email || "", full_name: r.full_name || "", phone_number: r.phone_number || "" });
      });
      setDecryptedData(map);
      setDecrypted(true);
      toast({ title: "🔓 Decrypted", description: "Sensitive data visible." });
    } catch {
      toast({ title: "Decryption Failed", description: "Admin access required.", variant: "destructive" });
    } finally { setDecrypting(false); }
  };

  const dispName = (m: MemberRow) => decrypted ? (decryptedData.get(m.user_id)?.full_name || "—") : (m.full_name ? maskSensitiveField(m.full_name) : "—");
  const dispEmail = (m: MemberRow) => decrypted ? (decryptedData.get(m.user_id)?.email || "—") : maskEmail(m.email);
  const dispPhone = (m: MemberRow) => decrypted ? (decryptedData.get(m.user_id)?.phone_number || "—") : (m.phone_number ? maskSensitiveField(m.phone_number) : "—");

  const planMonths = (plan: string) => plan === "annual" ? 12 : plan === "premium" ? 1 : 0;
  const planPrice = (plan: string) => plan === "annual" ? 129.99 : plan === "premium" ? 9.99 : 0;

  const logActivity = async (m: MemberRow, action: string, details: any) => {
    if (!m.subscription_id) return;
    try {
      await supabase.from("subscription_activity").insert({
        subscription_id: m.subscription_id, user_id: m.user_id, action, details, performed_by: user?.id,
      });
    } catch { /* non-fatal */ }
  };

  const changePlan = async (m: MemberRow, plan: string) => {
    // Trials are date-based — hand off so the end date is set correctly.
    if (plan === "trial") return grantTrial({ ...m, plan_type: "free" }, 2);
    setBusyId(m.user_id);
    try {
      const end = new Date();
      const months = planMonths(plan);
      if (months > 0) end.setMonth(end.getMonth() + months);
      const payload = {
        plan_type: plan, status: plan === "free" ? "cancelled" : "active",
        amount: planPrice(plan), payment_method: m.payment_method || "manual",
        start_date: new Date().toISOString(),
        end_date: months > 0 ? end.toISOString() : new Date().toISOString(),
      };
      if (m.subscription_id) {
        await supabase.from("subscriptions").update(payload).eq("id", m.subscription_id);
      } else {
        await supabase.from("subscriptions").insert({ user_id: m.user_id, ...payload });
      }
      await logActivity(m, "plan_changed", { new_plan: plan });
      toast({ title: "Plan updated", description: `Set to ${plan}` });
      fetchMembers();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setBusyId(null); }
  };

  const changeStatus = async (m: MemberRow, status: string) => {
    if (!m.subscription_id) {
      toast({ title: "No subscription", description: "Set a plan first to manage status.", variant: "destructive" });
      return;
    }
    if (status === "cancelled") {
      setBusyId(m.user_id);
      try {
        const result = await supabase.functions.invoke("cancel-subscription", { body: { userId: m.user_id } });
        if (result.error || (result.data as any)?.error) throw new Error((result.data as any)?.error || result.error?.message || "Cancellation failed");
        toast({ title: "Membership cancelled", description: "PayPal renewal stopped and the member account was retained." });
        fetchMembers();
      } catch (e: any) {
        toast({ title: "Cancellation failed", description: e.message, variant: "destructive" });
      } finally { setBusyId(null); }
      return;
    }
    setBusyId(m.user_id);
    try {
      const update: any = { status };
      if (status === "cancelled") update.end_date = new Date().toISOString();
      await supabase.from("subscriptions").update(update).eq("id", m.subscription_id);
      await logActivity(m, "status_changed", { new_status: status });
      toast({ title: "Status updated", description: `Now ${status}` });
      fetchMembers();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setBusyId(null); }
  };

  const extend = async (m: MemberRow, days: number) => {
    // No subscription row yet? Fall back to granting a trial for that many days.
    if (!m.subscription_id) return grantTrial(m, days);
    setBusyId(m.user_id);
    try {
      // Extend from the current end date if it's still in the future, otherwise from today.
      const current = m.end_date ? new Date(m.end_date) : null;
      const base = current && current > new Date() ? current : new Date();
      base.setDate(base.getDate() + days);
      await supabase.from("subscriptions").update({ end_date: base.toISOString(), status: "active" }).eq("id", m.subscription_id);
      await logActivity(m, "extended", { days, new_end_date: base.toISOString() });
      toast({ title: "Extended", description: `+${days} days · ends ${base.toLocaleDateString()}` });
      fetchMembers();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setBusyId(null); }
  };

  const grantTrial = async (m: MemberRow, days: number) => {
    setBusyId(m.user_id);
    try {
      const current = m.end_date ? new Date(m.end_date) : null;
      const end = current && current > new Date() && m.plan_type === "trial" ? current : new Date();
      end.setDate(end.getDate() + days);
      const payload = {
        plan_type: "trial",
        status: "active",
        amount: 0,
        payment_method: "trial",
        start_date: new Date().toISOString(),
        end_date: end.toISOString(),
      };
      if (m.subscription_id) {
        await supabase.from("subscriptions").update(payload).eq("id", m.subscription_id);
      } else {
        await supabase.from("subscriptions").insert({ user_id: m.user_id, ...payload });
      }
      await logActivity(m, "trial_granted", { days, ends: end.toISOString() });
      toast({ title: "Trial granted", description: `${days}-day trial · ends ${end.toLocaleDateString()}` });
      fetchMembers();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setBusyId(null); }
  };

  const applyCustom = async () => {
    if (!customTarget) return;
    const days = parseInt(customDays, 10);
    if (!days || days < 1 || days > 3650) {
      toast({ title: "Invalid length", description: "Enter between 1 and 3650 days.", variant: "destructive" });
      return;
    }
    const { member, mode } = customTarget;
    setCustomTarget(null);
    if (mode === "trial") await grantTrial(member, days);
    else await extend(member, days);
  };


  const markPaid = async (m: MemberRow) => {
    if (!m.subscription_id) {
      toast({ title: "No subscription", description: "Set a plan first.", variant: "destructive" });
      return;
    }
    setBusyId(m.user_id);
    try {
      const amt = planPrice(m.plan_type);
      await supabase.from("subscription_payments").insert({
        subscription_id: m.subscription_id, user_id: m.user_id, amount: amt, currency: "USD",
        payment_method: m.payment_method || "manual", payment_date: new Date().toISOString(),
        status: "completed", recorded_by: user?.id,
      });
      await supabase.from("subscriptions").update({
        last_payment_date: new Date().toISOString(), last_payment_amount: amt, status: "active",
      }).eq("id", m.subscription_id);
      await logActivity(m, "payment_recorded", { amount: amt });
      toast({ title: "Payment recorded", description: `$${amt}` });
      fetchMembers();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setBusyId(null); }
  };

  const toggleRole = async (m: MemberRow, role: string) => {
    setBusyId(m.user_id);
    try {
      if (m.roles.includes(role)) {
        await supabase.from("user_roles").delete().eq("user_id", m.user_id).eq("role", role as any);
        toast({ title: "Role removed", description: role });
      } else {
        await supabase.from("user_roles").insert({ user_id: m.user_id, role: role as any });
        toast({ title: "Role added", description: role });
      }
      fetchMembers();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setBusyId(null); }
  };

  const sendPasswordReset = async (m: MemberRow) => {
    const email = (decrypted && decryptedData.get(m.user_id)?.email) || m.email;
    if (!email) { toast({ title: "No email", variant: "destructive" }); return; }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth?mode=reset`,
      });
      if (error) throw error;
      toast({ title: "Reset sent", description: decrypted ? email : maskEmail(email) });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const restoreAccess = async (m: MemberRow) => {
    if (!m.subscription_id) {
      toast({ title: "No membership record", description: "Set a plan before restoring paid eligibility.", variant: "destructive" });
      return;
    }
    setBusyId(m.user_id);
    try {
      const { error } = await supabase.from("subscription_activity").insert({
        subscription_id: m.subscription_id, user_id: m.user_id, action: "access_restored",
        details: { restored_by_admin: true }, performed_by: user?.id,
      });
      if (error) throw error;
      toast({ title: "Access eligibility restored", description: "The cancellation safeguard has been reset for this member." });
      fetchMembers();
    } catch (e: any) {
      toast({ title: "Restore failed", description: e.message, variant: "destructive" });
    } finally { setBusyId(null); }
  };

  const deleteAccount = async (m: MemberRow) => {
    setBusyId(m.user_id);
    try {
      const r = await supabase.functions.invoke("delete-user-account", { body: { user_id: m.user_id } });
      if (r.error || (r.data as any)?.error) throw new Error((r.data as any)?.error || r.error?.message || "Failed to delete account");
      toast({ title: "Account deleted", description: "PayPal billing was cancelled first, then the member account was removed." });
      setPendingDelete(null);
      fetchMembers();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members.filter(m => {
      if (statusFilter !== "all" && m.status !== statusFilter) return false;
      if (planFilter !== "all" && m.plan_type !== planFilter) return false;
      if (!q) return true;
      const fields = [m.full_name, m.email, m.phone_number].filter(Boolean).join(" ").toLowerCase();
      return fields.includes(q);
    });
  }, [members, query, statusFilter, planFilter]);

  const stats = useMemo(() => ({
    total: members.length,
    active: members.filter(m => m.status === "active").length,
    pending: members.filter(m => m.status === "pending").length,
    inactive: members.filter(m => m.status !== "active").length,
    paid: members.filter(m => m.status === "active" && m.plan_type !== "free").length,
  }), [members]);

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      active: "bg-affirmative text-white", pending: "bg-yellow-500 text-white",
      cancelled: "bg-destructive text-destructive-foreground", suspended: "bg-orange-500 text-white",
    };
    return <Badge className={`text-[10px] ${map[s] || "bg-muted text-muted-foreground"}`}>{s}</Badge>;
  };

  if (loading) return <div className="flex items-center justify-center min-h-[300px]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4 mt-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Total", value: stats.total, icon: <Users className="w-5 h-5 text-primary" />, color: "" },
          { label: "Active", value: stats.active, icon: <UserCheck className="w-5 h-5 text-affirmative" />, color: "text-affirmative" },
          { label: "Paid", value: stats.paid, icon: <DollarSign className="w-5 h-5 text-primary" />, color: "text-primary" },
          { label: "Pending", value: stats.pending, icon: <RefreshCw className="w-5 h-5 text-yellow-500" />, color: "text-yellow-500" },
          { label: "Inactive", value: stats.inactive, icon: <UserX className="w-5 h-5 text-destructive" />, color: "text-destructive" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                </div>
                <div className="opacity-60">{s.icon}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Encryption + Filters bar */}
      <Card>
        <CardContent className="pt-4 pb-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search by name, email, phone…" value={query} onChange={e => setQuery(e.target.value)} className="pl-9 h-9" />
            </div>
            <Select value={statusFilter} onValueChange={(v: StatusFilter) => setStatusFilter(v)}>
              <SelectTrigger className="w-[140px] h-9"><Filter className="w-3.5 h-3.5 mr-1" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="none">No subscription</SelectItem>
              </SelectContent>
            </Select>
            <Select value={planFilter} onValueChange={(v: PlanFilter) => setPlanFilter(v)}>
              <SelectTrigger className="w-[130px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All plans</SelectItem>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="trial">Trial</SelectItem>
                <SelectItem value="premium">Premium</SelectItem>
                <SelectItem value="annual">Annual</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={fetchMembers} className="h-9"><RefreshCw className="w-3.5 h-3.5 mr-1" />Refresh</Button>
            <Button variant={decrypted ? "destructive" : "outline"} size="sm" onClick={handleDecryptToggle} disabled={decrypting} className="h-9 gap-1">
              {decrypting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : decrypted ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {decrypted ? "Hide PII" : "Show PII"}
            </Button>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {decrypted ? <Unlock className="w-3.5 h-3.5 text-warning" /> : <Lock className="w-3.5 h-3.5 text-affirmative" />}
            <span>{decrypted ? "Sensitive PII visible — handle with care." : "PII is masked. Click Show PII to decrypt."}</span>
            <span className="ml-auto">Showing {filtered.length} of {members.length}</span>
          </div>
        </CardContent>
      </Card>

      {/* Members Table */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Members</CardTitle></CardHeader>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <Table className="text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Renews</TableHead>
                  <TableHead>Last Payment</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right pr-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(m => (
                  <TableRow key={m.user_id}>
                    <TableCell>
                      <div className="min-w-[160px]">
                        <p className={`font-medium truncate max-w-[220px] ${!decrypted ? "font-mono text-xs" : ""}`}>{dispName(m)}</p>
                        <p className={`truncate max-w-[220px] text-xs text-muted-foreground ${!decrypted ? "font-mono" : ""}`}>{dispEmail(m)}</p>
                        {m.phone_number && <p className={`truncate max-w-[220px] text-[10px] text-muted-foreground ${!decrypted ? "font-mono" : ""}`}>{dispPhone(m)}</p>}
                         <div className="mt-1 flex flex-wrap gap-1">
                           <Badge variant="outline" className="text-[9px]">{m.payment_method === "paypal" ? "PayPal linked" : "PayPal not linked"}</Badge>
                           {m.cancellation_count > 0 && <Badge variant={m.limited_access ? "destructive" : "secondary"} className="text-[9px]">{m.cancellation_count} cancellation{m.cancellation_count === 1 ? "" : "s"}</Badge>}
                           {m.limited_access && <Badge variant="destructive" className="text-[9px]">Limited access</Badge>}
                         </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select value={m.plan_type} onValueChange={(v) => changePlan(m, v)}>
                        <SelectTrigger className="h-7 w-[110px] text-xs capitalize">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="free">Free</SelectItem>
                          <SelectItem value="trial">Trial</SelectItem>
                          <SelectItem value="premium">Premium</SelectItem>
                          <SelectItem value="annual">Annual</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select value={m.status === "none" ? "none" : m.status} onValueChange={(v) => changeStatus(m, v)}>
                        <SelectTrigger className="h-7 w-[120px] text-xs">
                          <SelectValue>{statusBadge(m.status)}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="suspended">Suspended</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {m.end_date ? new Date(m.end_date).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {m.last_payment_date ? (
                        <>
                          <p>{new Date(m.last_payment_date).toLocaleDateString()}</p>
                          <p className="text-muted-foreground">${m.amount ?? 0} · {m.payment_method || "—"}</p>
                        </>
                      ) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap max-w-[140px]">
                        {m.roles.length > 0
                          ? m.roles.map(r => <Badge key={r} variant="outline" className="text-[10px] capitalize">{r}</Badge>)
                          : <span className="text-[10px] text-muted-foreground">member</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {m.joined_date ? new Date(m.joined_date).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell className="text-right pr-3">
                      <div className="flex items-center justify-end gap-1">
                        {busyId === m.user_id && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="w-4 h-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56 bg-popover">
                            <DropdownMenuLabel className="text-xs">Manage member</DropdownMenuLabel>
                            <DropdownMenuSeparator />

                            <DropdownMenuItem onClick={() => markPaid(m)} className="text-xs">
                              <DollarSign className="w-3.5 h-3.5 mr-2" /> Mark as paid
                            </DropdownMenuItem>

                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger className="text-xs"><CalendarPlus className="w-3.5 h-3.5 mr-2" /> Extend membership</DropdownMenuSubTrigger>
                              <DropdownMenuSubContent className="bg-popover">
                                <DropdownMenuItem onClick={() => extend(m, 7)} className="text-xs">+ 7 days</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => extend(m, 30)} className="text-xs">+ 30 days</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => extend(m, 90)} className="text-xs">+ 90 days</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => extend(m, 365)} className="text-xs">+ 1 year</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => { setCustomDays("30"); setCustomTarget({ member: m, mode: "extend" }); }} className="text-xs">
                                  Custom…
                                </DropdownMenuItem>
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>

                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger className="text-xs"><Timer className="w-3.5 h-3.5 mr-2" /> Grant / extend trial</DropdownMenuSubTrigger>
                              <DropdownMenuSubContent className="bg-popover">
                                <DropdownMenuItem onClick={() => grantTrial(m, 2)} className="text-xs">2-day trial</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => grantTrial(m, 7)} className="text-xs">7-day trial</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => grantTrial(m, 14)} className="text-xs">14-day trial</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => grantTrial(m, 30)} className="text-xs">30-day trial</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => { setCustomDays("14"); setCustomTarget({ member: m, mode: "trial" }); }} className="text-xs">
                                  Custom…
                                </DropdownMenuItem>
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>


                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger className="text-xs"><ShieldPlus className="w-3.5 h-3.5 mr-2" /> Toggle role</DropdownMenuSubTrigger>
                              <DropdownMenuSubContent className="bg-popover">
                                {["admin", "writer", "moderator", "user"].map(r => (
                                  <DropdownMenuItem key={r} onClick={() => toggleRole(m, r)} className="text-xs capitalize">
                                    {m.roles.includes(r) ? <Check className="w-3.5 h-3.5 mr-2 text-affirmative" /> : <span className="w-3.5 h-3.5 mr-2" />}
                                    {r}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>

                            <DropdownMenuSeparator />
                             {m.limited_access && (
                               <DropdownMenuItem onClick={() => restoreAccess(m)} className="text-xs text-affirmative focus:text-affirmative">
                                 <Unlock className="w-3.5 h-3.5 mr-2" /> Restore paid eligibility
                               </DropdownMenuItem>
                             )}
                            <DropdownMenuItem onClick={() => sendPasswordReset(m)} className="text-xs">
                              <KeyRound className="w-3.5 h-3.5 mr-2" /> Send password reset
                            </DropdownMenuItem>
                            {m.status === "active" && (
                              <DropdownMenuItem onClick={() => changeStatus(m, "cancelled")} className="text-xs text-destructive focus:text-destructive">
                                <Ban className="w-3.5 h-3.5 mr-2" /> Cancel subscription
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            {m.user_id !== user?.id && (
                              <DropdownMenuItem onClick={() => setPendingDelete(m)} className="text-xs text-destructive focus:text-destructive">
                                <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete account
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No members match these filters.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete account?</AlertDialogTitle>
            <AlertDialogDescription>
              This cancels every linked PayPal billing agreement first, then permanently removes <strong>{pendingDelete ? dispEmail(pendingDelete) : ""}</strong>, their subscription, and all related data. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingDelete && deleteAccount(pendingDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >Delete permanently</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!customTarget} onOpenChange={(o) => !o && setCustomTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {customTarget?.mode === "trial" ? "Grant trial access" : "Extend membership"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {customTarget?.mode === "trial"
                ? "Sets this member to a trial plan ending after the number of days you choose."
                : "Adds days to the current membership end date (or starts from today if it already expired)."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Number of days</label>
            <Input
              type="number"
              min={1}
              max={3650}
              value={customDays}
              onChange={(e) => setCustomDays(e.target.value)}
              className="h-9"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={applyCustom}>Apply</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
