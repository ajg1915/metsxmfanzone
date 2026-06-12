import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Package, Mail } from "lucide-react";

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

  const filtered = rewards.filter((r) => filter === "all" || r.status === filter);

  const triggerCheck = async () => {
    toast({ title: "Running eligibility check..." });
    const { error } = await supabase.functions.invoke("check-loyalty-rewards");
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Done", description: "Eligibility check complete." }); load(); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Loyalty Rewards</h1>
          <p className="text-sm text-muted-foreground">Free t-shirt program — members active 60+ consecutive days.</p>
        </div>
        <div className="flex gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="claimed">Claimed (to ship)</SelectItem>
              <SelectItem value="shipped">Shipped</SelectItem>
              <SelectItem value="pending">Pending claim</SelectItem>
              <SelectItem value="opted_out">Opted out</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={triggerCheck} variant="outline">Run eligibility check</Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">No rewards yet.</Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <RewardRow key={r.id} reward={r} onUpdate={load} />
          ))}
        </div>
      )}
    </div>
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
    <Card className="p-4 bg-card/90 backdrop-blur border-border/40">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-semibold">{reward.profiles?.full_name || "Member"}</span>
            <span className="text-xs text-muted-foreground">{reward.profiles?.email}</span>
            <Badge className={statusColors[reward.status] || ""}>{reward.status}</Badge>
          </div>
          {reward.shipping_name ? (
            <div className="text-xs text-muted-foreground mt-1">
              Ship to: {reward.shipping_name}, {reward.shipping_address1}
              {reward.shipping_address2 ? `, ${reward.shipping_address2}` : ""},{" "}
              {reward.shipping_city}, {reward.shipping_state} {reward.shipping_zip} — Size <strong>{reward.shirt_size}</strong>
              {reward.phone ? ` — ${reward.phone}` : ""}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground mt-1">
              {reward.status === "pending" ? "Awaiting member response" : "No shipping info"}
            </div>
          )}
          {reward.tracking_number && (
            <div className="text-xs mt-1">📦 {reward.carrier}: {reward.tracking_number}</div>
          )}
        </div>
        <div className="flex gap-2">
          {reward.status === "claimed" && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Package className="h-4 w-4 mr-1" /> Mark shipped</Button>
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
                <Button size="sm" variant="outline">Notes</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Admin notes</DialogTitle></DialogHeader>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={5} />
                <Button onClick={saveNotes}>Save</Button>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>
    </Card>
  );
}
