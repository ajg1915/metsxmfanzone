import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Trash2, Users, UserCheck, UserX, Lock, Unlock, ShieldCheck, Eye, EyeOff, Pencil, Check, X, KeyRound } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useAuth";
import { maskEmail, maskSensitiveField } from "@/utils/secureDataVault";

interface MemberRow {
  user_id: string;
  email: string | null;
  full_name: string | null;
  phone_number: string | null;
  plan_type: string;
  status: string;
  end_date: string | null;
  roles: string[];
  created_at: string;
  joined_date: string;
  payment_method: string | null;
  amount: number | null;
  last_payment_date: string | null;
}

export default function MembersTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [decrypted, setDecrypted] = useState(false);
  const [decrypting, setDecrypting] = useState(false);
  const [decryptedData, setDecryptedData] = useState<Map<string, { email: string; full_name: string; phone_number: string }>>(new Map());

  // Editable count overrides
  const [countOverrides, setCountOverrides] = useState<{ total: number | null; active: number | null; inactive: number | null }>({ total: null, active: null, inactive: null });
  const [editingCount, setEditingCount] = useState<"total" | "active" | "inactive" | null>(null);
  const [editValue, setEditValue] = useState("");

  useEffect(() => {
    fetchMembers();
    fetchCountOverrides();
  }, []);

  const fetchCountOverrides = async () => {
    const { data } = await supabase
      .from("site_settings")
      .select("setting_value")
      .eq("setting_key", "member_count_overrides")
      .maybeSingle();
    if (data?.setting_value) {
      const val = data.setting_value as any;
      setCountOverrides({
        total: val.total ?? null,
        active: val.active ?? null,
        inactive: val.inactive ?? null,
      });
    }
  };

  const saveCountOverride = async (key: "total" | "active" | "inactive", value: number) => {
    const newOverrides = { ...countOverrides, [key]: value };
    setCountOverrides(newOverrides);
    setEditingCount(null);

    const settingValue: Record<string, number | null> = {};
    if (newOverrides.total !== null) settingValue.total = newOverrides.total;
    if (newOverrides.active !== null) settingValue.active = newOverrides.active;
    if (newOverrides.inactive !== null) settingValue.inactive = newOverrides.inactive;

    await supabase
      .from("site_settings")
      .upsert({ setting_key: "member_count_overrides", setting_value: settingValue, updated_at: new Date().toISOString() }, { onConflict: "setting_key" });

    toast({ title: "Saved", description: `${key} count updated to ${value}` });
  };

  const resetCountOverride = async (key: "total" | "active" | "inactive") => {
    const newOverrides = { ...countOverrides, [key]: null };
    setCountOverrides(newOverrides);
    setEditingCount(null);

    const settingValue: Record<string, number | null> = {};
    if (newOverrides.total !== null) settingValue.total = newOverrides.total;
    if (newOverrides.active !== null) settingValue.active = newOverrides.active;
    if (newOverrides.inactive !== null) settingValue.inactive = newOverrides.inactive;

    await supabase
      .from("site_settings")
      .upsert({ setting_key: "member_count_overrides", setting_value: settingValue, updated_at: new Date().toISOString() }, { onConflict: "setting_key" });

    toast({ title: "Reset", description: `${key} count reset to actual value` });
  };

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, full_name, phone_number, created_at")
        .order("created_at", { ascending: false });
      if (profilesError) throw profilesError;

      const { data: subscriptions } = await supabase
        .from("subscriptions")
        .select("user_id, plan_type, status, end_date, payment_method, amount, last_payment_date")
        .order("created_at", { ascending: false });

      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role");

      const roleMap = new Map<string, string[]>();
      roles?.forEach(r => {
        const existing = roleMap.get(r.user_id) || [];
        existing.push(r.role);
        roleMap.set(r.user_id, existing);
      });

      const membersData: MemberRow[] = (profiles || []).map(profile => {
        const activeSub = subscriptions?.find(s => s.user_id === profile.id && s.status === "active")
          || subscriptions?.find(s => s.user_id === profile.id);

        return {
          user_id: profile.id,
          email: profile.email,
          full_name: profile.full_name,
          phone_number: profile.phone_number || null,
          plan_type: activeSub?.plan_type || "free",
          status: activeSub?.status || "none",
          end_date: activeSub?.end_date || null,
          roles: roleMap.get(profile.id) || [],
          created_at: profile.created_at || "",
          joined_date: profile.created_at || "",
          payment_method: activeSub?.payment_method || null,
          amount: activeSub?.amount || null,
          last_payment_date: activeSub?.last_payment_date || null,
        };
      });

      setMembers(membersData);
    } catch (error) {
      console.error("Error fetching members:", error);
      toast({ title: "Error", description: "Failed to load members", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDecryptToggle = async () => {
    if (decrypted) {
      setDecrypted(false);
      setDecryptedData(new Map());
      return;
    }

    setDecrypting(true);
    try {
      const { data, error } = await supabase.functions.invoke("secure-data-vault", {
        body: {
          action: "fetch-decrypted",
          dataType: "profiles",
          data: { limit: 500, offset: 0 },
        },
      });

      if (error) throw error;

      const map = new Map<string, { email: string; full_name: string; phone_number: string }>();
      (data?.records || []).forEach((r: any) => {
        map.set(r.id, {
          email: r.email || "",
          full_name: r.full_name || "",
          phone_number: r.phone_number || "",
        });
      });

      setDecryptedData(map);
      setDecrypted(true);
      toast({ title: "🔓 Data Decrypted", description: "Sensitive member data is now visible. Be careful." });
    } catch (error: any) {
      console.error("Decryption failed:", error);
      toast({ title: "Decryption Failed", description: "Admin access required to decrypt data.", variant: "destructive" });
    } finally {
      setDecrypting(false);
    }
  };

  const getDisplayEmail = (m: MemberRow) => {
    if (decrypted && decryptedData.has(m.user_id)) {
      return decryptedData.get(m.user_id)!.email;
    }
    return maskEmail(m.email);
  };

  const getDisplayName = (m: MemberRow) => {
    if (decrypted && decryptedData.has(m.user_id)) {
      return decryptedData.get(m.user_id)!.full_name || "—";
    }
    return m.full_name ? maskSensitiveField(m.full_name) : "—";
  };

  const getDisplayPhone = (m: MemberRow) => {
    if (decrypted && decryptedData.has(m.user_id)) {
      return decryptedData.get(m.user_id)!.phone_number || "—";
    }
    return m.phone_number ? maskSensitiveField(m.phone_number) : "—";
  };

  const deleteUserAccount = async (userId: string, email: string | null) => {
    try {
      const response = await supabase.functions.invoke("delete-user-account", {
        body: { user_id: userId },
      });
      if (response.error) throw response.error;
      toast({ title: "Deleted", description: `User permanently deleted.` });
      fetchMembers();
    } catch (error) {
      console.error("Error deleting user:", error);
      toast({ title: "Error", description: "Failed to delete user account", variant: "destructive" });
    }
  };

  const sendPasswordReset = async (m: MemberRow) => {
    // Prefer decrypted email if available, otherwise the row's stored email
    const email = (decrypted && decryptedData.get(m.user_id)?.email) || m.email;
    if (!email) {
      toast({ title: "No email on file", description: "Cannot send reset — this member has no email address.", variant: "destructive" });
      return;
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth?mode=reset`,
      });
      if (error) throw error;
      toast({
        title: "Reset email sent",
        description: `A password reset link was emailed to ${decrypted ? email : maskEmail(email)}.`,
      });
    } catch (err: any) {
      console.error("Password reset error:", err);
      toast({ title: "Error", description: err.message || "Failed to send reset email.", variant: "destructive" });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-affirmative";
      case "pending": return "bg-yellow-500";
      case "cancelled": return "destructive";
      default: return "outline";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const totalMembers = members.length;
  const activeMembers = members.filter(m => m.status === "active").length;
  const inactiveMembers = members.filter(m => m.status !== "active").length;

  const displayTotal = countOverrides.total ?? totalMembers;
  const displayActive = countOverrides.active ?? activeMembers;
  const displayInactive = countOverrides.inactive ?? inactiveMembers;

  const renderStatCard = (
    label: string,
    actual: number,
    display: number,
    key: "total" | "active" | "inactive",
    icon: React.ReactNode,
    colorClass: string
  ) => (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">{label}</p>
            {editingCount === key ? (
              <div className="flex items-center gap-1.5 mt-1">
                <Input
                  type="number"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="h-8 w-24 text-lg font-bold"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveCountOverride(key, parseInt(editValue) || 0);
                    if (e.key === "Escape") setEditingCount(null);
                  }}
                />
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => saveCountOverride(key, parseInt(editValue) || 0)}>
                  <Check className="w-4 h-4 text-affirmative" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingCount(null)}>
                  <X className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className={`text-2xl font-bold ${colorClass}`}>{display.toLocaleString()}</p>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 opacity-50 hover:opacity-100"
                  onClick={() => { setEditingCount(key); setEditValue(String(display)); }}
                >
                  <Pencil className="w-3 h-3" />
                </Button>
              </div>
            )}
            {countOverrides[key] !== null && editingCount !== key && (
              <button
                onClick={() => resetCountOverride(key)}
                className="text-[10px] text-muted-foreground hover:text-foreground underline mt-0.5"
              >
                Reset to actual ({actual})
              </button>
            )}
          </div>
          {icon}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4 mt-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {renderStatCard("Total", totalMembers, displayTotal, "total", <Users className="w-8 h-8 text-primary opacity-50" />, "")}
        {renderStatCard("Active", activeMembers, displayActive, "active", <UserCheck className="w-8 h-8 text-affirmative opacity-50" />, "text-affirmative")}
        {renderStatCard("Inactive", inactiveMembers, displayInactive, "inactive", <UserX className="w-8 h-8 text-destructive opacity-50" />, "text-destructive")}
      </div>

      {/* Encryption Banner */}
      <Card className={`border ${decrypted ? "border-warning/50 bg-warning/5" : "border-affirmative/50 bg-affirmative/5"}`}>
        <CardContent className="py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {decrypted ? (
              <Unlock className="w-5 h-5 text-warning" />
            ) : (
              <Lock className="w-5 h-5 text-affirmative" />
            )}
            <div>
              <p className="text-sm font-medium">
                {decrypted ? "🔓 Data Decrypted — Sensitive info visible" : "🔒 Data Encrypted — Member PII is protected"}
              </p>
              <p className="text-xs text-muted-foreground">
                {decrypted
                  ? "Names, emails, and phone numbers are shown in plaintext. Click lock to re-encrypt."
                  : "Names, emails, and phone numbers are masked. Only admins with the encryption key can decrypt."}
              </p>
            </div>
          </div>
          <Button
            variant={decrypted ? "destructive" : "outline"}
            size="sm"
            onClick={handleDecryptToggle}
            disabled={decrypting}
            className="gap-2"
          >
            {decrypting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : decrypted ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
            {decrypting ? "Decrypting..." : decrypted ? "Re-Encrypt" : "Decrypt Data"}
          </Button>
        </CardContent>
      </Card>

      {/* Members Table */}
      <Card>
        <CardHeader className="pb-3 flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            Member Directory
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {decrypted ? "🔓 Decrypted" : "🔒 Encrypted"}
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table className="text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Payment Method</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Last Payment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => (
                  <TableRow key={m.user_id}>
                    <TableCell>
                      <p className={`font-medium truncate max-w-[160px] ${!decrypted ? "font-mono text-xs" : ""}`}>
                        {getDisplayName(m)}
                      </p>
                    </TableCell>
                    <TableCell>
                      <p className={`truncate max-w-[200px] ${!decrypted ? "font-mono text-xs text-muted-foreground" : "text-xs text-muted-foreground"}`}>
                        {getDisplayEmail(m)}
                      </p>
                    </TableCell>
                    <TableCell>
                      <p className={`text-xs ${!decrypted ? "font-mono text-muted-foreground" : "text-muted-foreground"}`}>
                        {getDisplayPhone(m)}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={m.plan_type === "free" ? "outline" : "secondary"} className="text-xs capitalize">
                        {m.plan_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs capitalize">{m.payment_method || "—"}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-medium">{m.amount ? `$${m.amount}` : "Free"}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {m.last_payment_date ? new Date(m.last_payment_date).toLocaleDateString() : "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-xs ${getStatusColor(m.status)}`}>
                        {m.status || "none"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {m.roles.length > 0 ? m.roles.map(r => (
                          <Badge key={r} variant="outline" className="text-xs capitalize">{r}</Badge>
                        )) : <span className="text-xs text-muted-foreground">member</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {m.joined_date ? new Date(m.joined_date).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-primary hover:text-primary"
                          title="Send password reset email"
                          onClick={() => sendPasswordReset(m)}
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        {m.user_id !== user?.id && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" title="Delete account">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Account</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Permanently delete this user? This cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteUserAccount(m.user_id, m.email)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
