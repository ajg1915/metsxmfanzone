import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Package, Mail, Gift, RefreshCw } from "lucide-react";
import {
  AdminPage, AdminPageHeader, AdminSearch, AdminFilterChips, AdminList, AdminListCard,
  AdminRow, AdminEmpty, AdminLoading,
} from "@/components/admin/AdminUI";

interface Reward {
  id: string;
  user_id: string;
  status: string;
  shipping_name: string | null;
  shipping_address1: string | null;
  shipping_address2: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  shipping_zip: string | null;
  shipping_country: string | null;
  shirt_size: string | null;
  phone: string | null;
  tracking_number: string | null;
  carrier: string | null;
  admin_notes: string | null;
  claimed_at: string | null;
  shipped_at: string | null;
  opted_out_at: string | null;
  created_at: string;
  profiles?: { email: string | null; full_name: string | null } | null;
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  claimed: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  opted_out: "bg-muted text-muted-foreground",
  shipped: "bg-green-500/20 text-green-300 border-green-500/30",
  cancelled: "bg-red-500/20 text-red-300 border-red-500/30",
};

export default function LoyaltyRewardsManagement() {
  const { toast } = useToast();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("loyalty_rewards")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    const ids = Array.from(new Set((data || []).map((r: any) => r.user_id)));
    let profileMap: Record<string, { email: string | null; full_name: string | null }> = {};
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .in("id", ids);
      (profs || []).forEach((p: any) => { profileMap[p.id] = { email: p.email, full_name: p.full_name }; });
    }
    setRewards((data || []).map((r: any) => ({ ...r, profiles: profileMap[r.user_id] || null })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const counts = useMemo(() => ({
    all: rewards.length,
    claimed: rewards.filter(r => r.status === "claimed").length,
    shipped: rewards.filter(r => r.status === "shipped").length,
    pending: rewards.filter(r => r.status === "pending").length,
    opted_out: rewards.filter(r => r.status === "opted_out").length,
  }), [rewards]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rewards.filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (q && !(`${r.profiles?.full_name || ""} ${r.profiles?.email || ""}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [rewards, search, filter]);

  const triggerCheck = async () => {
    toast({ title: "Running eligibility check..." });
    const { error } = await supabase.functions.invoke("check-loyalty-rewards");
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Done", description: "Eligibility check complete." }); load(); }
  };

  return (
    <AdminPage>
      <AdminPageHeader
        icon={Gift}
        title="Loyalty Rewards"
        count={counts.all}
        description="Free t-shirt program — members active 60+ consecutive days."
        actions={
          <Button onClick={triggerCheck} variant="outline" size="sm" className="h-8 text-xs">
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> Run eligibility check
          </Button>
        }
      />

      <div className="flex items-center gap-2 flex-wrap">
        <AdminSearch value={search} onChange={setSearch} placeholder="Search member name or email…" />
        <AdminFilterChips
          filters={[
            { key: "all", label: "All", count: counts.all },
            { key: "claimed", label: "Claimed", count: counts.claimed },
            { key: "shipped", label: "Shipped", count: counts.shipped },
            { key: "pending", label: "Pending", count: counts.pending },
            { key: "opted_out", label: "Opted out", count: counts.opted_out },
          ]}
          active={filter}
          onChange={setFilter}
        />
      </div>

      {loading ? (
        <AdminLoading label="Loading rewards…" />
      ) : filtered.length === 0 ? (
        <AdminEmpty message="No rewards yet." />
      ) : (
        <AdminList>
          {filtered.map((r) => (
            <RewardRow key={r.id} reward={r} onUpdate={load} />
          ))}
        </AdminList>
      )}
    </AdminPage>
  );
}

function RewardRow({ reward, onUpdate }: { reward: Reward; onUpdate: () => void }) {
  const { toast } = useToast();
  const [tracking, setTracking] = useState(reward.tracking_number || "");
  const [carrier, setCarrier] = useState(reward.carrier || "USPS");
  const [notes, setNotes] = useState(reward.admin_notes || "");
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  const markShipped = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("loyalty_rewards")
      .update({
        status: "shipped",
        shipped_at: new Date().toISOString(),
        tracking_number: tracking || null,
        carrier: carrier || null,
        admin_notes: notes || null,
      })
      .eq("id", reward.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setSaving(false);
      return;
    }
    // Send shipped email
    if (reward.profiles?.email) {
      await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "loyalty-reward-shipped",
          recipientEmail: reward.profiles.email,
          idempotencyKey: `loyalty-shipped-${reward.id}`,
          templateData: {
            name: reward.profiles.full_name || "",
            trackingNumber: tracking,
            carrier,
          },
        },
      });
    }
    toast({ title: "Marked shipped", description: "Tracking email sent." });
    setSaving(false);
    setOpen(false);
    onUpdate();
  };

  const saveNotes = async () => {
    await supabase.from("loyalty_rewards").update({ admin_notes: notes }).eq("id", reward.id);
    toast({ title: "Saved" });
    onUpdate();
  };

  return (
    <AdminListCard>
      <AdminRow
        title={reward.profiles?.full_name || "Member"}
        badges={<Badge className={`h-4 text-[9px] ${statusColors[reward.status] || ""}`}>{reward.status}</Badge>}
        meta={reward.profiles?.email}
        actions={
          <>
            {reward.status === "claimed" && (
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="h-7 text-[10px] px-2"><Package className="h-3 w-3 mr-1" /> Mark shipped</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Mark as shipped</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div>
                      <Label>Carrier</Label>
                      <Select value={carrier} onValueChange={setCarrier}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["USPS", "UPS", "FedEx", "DHL", "Other"].map((c) => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Tracking number</Label>
                      <Input value={tracking} onChange={(e) => setTracking(e.target.value)} />
                    </div>
                    <div>
                      <Label>Notes (optional)</Label>
                      <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
                    </div>
                    <Button onClick={markShipped} disabled={saving} className="w-full">
                      {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
                      Ship & email member
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
            {reward.status !== "claimed" && (
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="h-7 text-[10px] px-2">Notes</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Admin notes</DialogTitle></DialogHeader>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={5} />
                  <Button onClick={saveNotes}>Save</Button>
                </DialogContent>
              </Dialog>
            )}
          </>
        }
        body={
          <>
            {reward.shipping_name ? (
              <div className="text-[10px] text-muted-foreground">
                Ship to: {reward.shipping_name}, {reward.shipping_address1}
                {reward.shipping_address2 ? `, ${reward.shipping_address2}` : ""},{" "}
                {reward.shipping_city}, {reward.shipping_state} {reward.shipping_zip} — Size <strong>{reward.shirt_size}</strong>
                {reward.phone ? ` — ${reward.phone}` : ""}
              </div>
            ) : (
              <div className="text-[10px] text-muted-foreground">
                {reward.status === "pending" ? "Awaiting member response" : "No shipping info"}
              </div>
            )}
            {reward.tracking_number && (
              <div className="text-[10px] mt-1">📦 {reward.carrier}: {reward.tracking_number}</div>
            )}
          </>
        }
      />
    </AdminListCard>
  );
}
