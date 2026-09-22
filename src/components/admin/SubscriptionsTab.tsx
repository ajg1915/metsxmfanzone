import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Calendar, Mail, DollarSign, Clock, ChevronRight, Check, Ban, RotateCcw, CalendarPlus,
  History,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { maskEmail } from "@/utils/secureDataVault";

interface UserSubscription {
  id: string;
  user_id: string;
  plan_type: string;
  status: string;
  amount: number | null;
  currency: string;
  start_date: string;
  end_date: string | null;
  cancellation_status: string | null;
  cancellation_requested_at: string | null;
  next_payment_date: string | null;
  next_payment_amount: number | null;
  payment_method: string;
  total_payments_received: number;
  last_payment_date: string | null;
  last_payment_amount: number | null;
  notes: string | null;
  email: string;
  created_at: string;
}

interface PaymentRecord {
  id: string;
  subscription_id: string;
  user_id: string;
  amount: number;
  currency: string;
  payment_method: string;
  payment_date: string;
  status: string;
  notes: string | null;
  created_at: string;
}

interface ActivityRecord {
  id: string;
  action: string;
  details: unknown;
  created_at: string;
}

export default function SubscriptionsTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [subscriptions, setSubscriptions] = useState<UserSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubscription, setSelectedSubscription] = useState<UserSubscription | null>(null);
  const [showDetailSheet, setShowDetailSheet] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState<PaymentRecord[]>([]);
  const [activityHistory, setActivityHistory] = useState<ActivityRecord[]>([]);
  const [showMarkAsPaidDialog, setShowMarkAsPaidDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showExtendDialog, setShowExtendDialog] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [extendDays, setExtendDays] = useState("30");
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const fetchSubscriptions = async () => {
    try {
      const { data: subs, error } = await supabase
        .from("subscriptions").select("*").order("created_at", { ascending: false });
      if (error) throw error;

      const userIds = [...new Set(subs?.map(s => s.user_id) || [])];
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles").select("id, email").in("id", userIds);
      if (profilesError) throw profilesError;

      const emailMap = new Map(profiles?.map(p => [p.id, p.email]) || []);
      setSubscriptions(subs?.map(sub => ({ ...sub, email: emailMap.get(sub.user_id) || "Unknown" })) || []);
    } catch (error) {
      console.error("Error:", error);
      toast({ title: "Error", description: "Failed to load subscriptions", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchSubscriptionDetails = async (sub: UserSubscription) => {
    setSelectedSubscription(sub);
    setShowDetailSheet(true);
    const { data: payments, error: paymentsError } = await supabase
      .from("subscription_payments").select("*").eq("subscription_id", sub.id).order("payment_date", { ascending: false });
    if (paymentsError) {
      toast({ title: "Error", description: "Payment history could not be loaded", variant: "destructive" });
      return;
    }
    setPaymentHistory(payments || []);
    const { data: activity, error: activityError } = await supabase
      .from("subscription_activity").select("*").eq("subscription_id", sub.id).order("created_at", { ascending: false });
    if (activityError) {
      toast({ title: "Error", description: "Membership activity could not be loaded", variant: "destructive" });
      return;
    }
    setActivityHistory(activity || []);
  };

  const handleMarkAsPaid = async () => {
    if (!selectedSubscription || !paymentAmount) return;
    setIsProcessing(true);
    try {
      const amount = parseFloat(paymentAmount);
      const paymentResult = await supabase.from("subscription_payments").insert({
        subscription_id: selectedSubscription.id, user_id: selectedSubscription.user_id,
        amount, currency: selectedSubscription.currency || "USD", payment_method: paymentMethod,
        payment_date: new Date().toISOString(), status: "completed", notes: paymentNotes || null, recorded_by: user?.id,
      });
      if (paymentResult.error) throw paymentResult.error;
      const subscriptionResult = await supabase.from("subscriptions").update({
        last_payment_date: new Date().toISOString(), last_payment_amount: amount,
        payment_method: paymentMethod, total_payments_received: (selectedSubscription.total_payments_received || 0) + 1, status: "active",
      }).eq("id", selectedSubscription.id);
      if (subscriptionResult.error) throw subscriptionResult.error;
      const activityResult = await supabase.from("subscription_activity").insert({
        subscription_id: selectedSubscription.id, user_id: selectedSubscription.user_id,
        action: "payment_recorded", details: { amount, method: paymentMethod, notes: paymentNotes }, performed_by: user?.id,
      });
      if (activityResult.error) throw activityResult.error;
      toast({ title: "Success", description: `Payment of $${amount} recorded` });
      setShowMarkAsPaidDialog(false);
      setPaymentAmount("");
      setPaymentNotes("");
      fetchSubscriptions();
      fetchSubscriptionDetails(selectedSubscription);
    } catch (error) {
      toast({ title: "Error", description: "Failed to record payment", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!selectedSubscription) return;
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("cancel-subscription", {
        body: { userId: selectedSubscription.user_id },
      });
      if (error || (data as any)?.error) {
        throw new Error("cancel_failed");
      }
      toast({
        title: "Membership cancelled",
        description: "PayPal renewal stopped and the member account was retained.",
      });
      setShowCancelDialog(false);
      fetchSubscriptions();
      setShowDetailSheet(false);
    } catch (error) {
      toast({ title: "Error", description: "Failed to cancel", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUndoCancellation = async () => {
    if (!selectedSubscription) return;
    setIsProcessing(true);
    try {
      const { error } = await supabase.from("subscriptions").update({ cancellation_status: null, cancellation_requested_at: null }).eq("id", selectedSubscription.id);
      if (error) throw error;
      toast({ title: "Success", description: "Cancellation undone" });
      fetchSubscriptions();
      fetchSubscriptionDetails({ ...selectedSubscription, cancellation_status: null });
    } catch (error) {
      toast({ title: "Error", description: "Failed", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExtendSubscription = async () => {
    if (!selectedSubscription || !extendDays) return;
    setIsProcessing(true);
    try {
      const days = parseInt(extendDays);
      const currentEnd = selectedSubscription.end_date ? new Date(selectedSubscription.end_date) : null;
      const newEnd = currentEnd && currentEnd > new Date() ? new Date(currentEnd) : new Date();
      newEnd.setDate(newEnd.getDate() + days);
      const { error } = await supabase.from("subscriptions").update({ end_date: newEnd.toISOString(), status: "active" }).eq("id", selectedSubscription.id);
      if (error) throw error;
      const activityResult = await supabase.from("subscription_activity").insert({
        subscription_id: selectedSubscription.id, user_id: selectedSubscription.user_id,
        action: "subscription_extended", details: { days_added: days, new_end_date: newEnd.toISOString() }, performed_by: user?.id,
      });
      if (activityResult.error) throw activityResult.error;
      toast({ title: "Success", description: `Extended by ${days} days` });
      setShowExtendDialog(false);
      setExtendDays("30");
      fetchSubscriptions();
      setShowDetailSheet(false);
    } catch (error) {
      toast({ title: "Error", description: "Failed to extend", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleActivatePending = async (sub: UserSubscription) => {
    setIsProcessing(true);
    try {
      const endDate = new Date();
      if (sub.plan_type === "annual") endDate.setFullYear(endDate.getFullYear() + 1);
      else if (sub.plan_type === "premium") endDate.setMonth(endDate.getMonth() + 1);
      else endDate.setDate(endDate.getDate() + 30);

      const { error } = await supabase.from("subscriptions").update({
        status: "active", start_date: new Date().toISOString(), end_date: endDate.toISOString(),
      }).eq("id", sub.id);
      if (error) throw error;
      const activityResult = await supabase.from("subscription_activity").insert({
        subscription_id: sub.id, user_id: sub.user_id,
        action: "manually_activated", details: { plan_type: sub.plan_type }, performed_by: user?.id,
      });
      if (activityResult.error) throw activityResult.error;
      toast({ title: "Activated!", description: `${sub.plan_type} activated for ${sub.email}` });
      fetchSubscriptions();
    } catch (error) {
      toast({ title: "Error", description: "Failed to activate", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusBadge = (sub: UserSubscription) => {
    if (sub.cancellation_status === "pending") return <Badge variant="outline" className="text-warning border-warning">Pending Cancel</Badge>;
    switch (sub.status) {
      case "active": return <Badge className="bg-affirmative">Active</Badge>;
      case "pending": return <Badge variant="outline" className="text-yellow-500 border-yellow-500">Pending</Badge>;
      case "cancelled": return <Badge variant="destructive">Cancelled</Badge>;
      case "suspended": return <Badge variant="secondary">Suspended</Badge>;
      default: return <Badge variant="outline">{sub.status}</Badge>;
    }
  };

  const getPlanPrice = (planType: string) => {
    switch (planType) { case "weekly": return "$3.99/wk"; case "premium": return "$9.99/mo"; case "annual": return "$129.99/yr"; default: return "Free"; }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Loading...</p></div>;

  return (
    <div className="space-y-6 mt-4">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Active</p><p className="text-2xl font-bold text-affirmative">{subscriptions.filter(s => s.status === "active" && !s.cancellation_status).length}</p></div><Check className="w-8 h-8 text-affirmative opacity-50" /></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Pending Cancel</p><p className="text-2xl font-bold text-warning">{subscriptions.filter(s => s.cancellation_status === "pending").length}</p></div><Clock className="w-8 h-8 text-warning opacity-50" /></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Cancelled</p><p className="text-2xl font-bold text-destructive">{subscriptions.filter(s => s.status === "cancelled").length}</p></div><Ban className="w-8 h-8 text-destructive opacity-50" /></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Premium/Annual</p><p className="text-2xl font-bold text-primary">{subscriptions.filter(s => s.plan_type !== "free" && s.status === "active").length}</p></div><DollarSign className="w-8 h-8 text-primary opacity-50" /></div></CardContent></Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader><CardTitle>All Subscriptions</CardTitle></CardHeader>
        <CardContent>
          {subscriptions.length === 0 ? <p className="text-center py-8 text-muted-foreground">No subscriptions found</p> : (<div>
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead><TableHead>Plan</TableHead><TableHead>Status</TableHead>
                    <TableHead>Method</TableHead><TableHead>Amount</TableHead><TableHead>End Date</TableHead><TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subscriptions.map(sub => (
                    <TableRow key={sub.id} className="cursor-pointer hover:bg-muted/50" onClick={() => fetchSubscriptionDetails(sub)}>
                       <TableCell><div className="flex items-center gap-2"><Mail className="w-4 h-4 text-muted-foreground" /><span className="font-mono text-xs font-medium">{maskEmail(sub.email)}</span></div></TableCell>
                      <TableCell><p className="font-medium capitalize">{sub.plan_type}</p><p className="text-xs text-muted-foreground">{getPlanPrice(sub.plan_type)}</p></TableCell>
                      <TableCell>{getStatusBadge(sub)}</TableCell>
                      <TableCell><span className="capitalize text-sm">{sub.payment_method || "—"}</span></TableCell>
                      <TableCell><span className="text-sm font-medium">{sub.amount ? `$${sub.amount}` : "Free"}</span></TableCell>
                      <TableCell>{sub.end_date ? <div className="flex items-center gap-2 text-sm"><Calendar className="w-4 h-4 text-muted-foreground" />{new Date(sub.end_date).toLocaleDateString()}</div> : <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {sub.status === "pending" && (
                            <Button variant="ghost" size="sm" className="h-7 text-xs text-green-600 hover:text-green-700 hover:bg-green-500/10" onClick={(e) => { e.stopPropagation(); handleActivatePending(sub); }}>
                              <Check className="w-3 h-3 mr-1" />Activate
                            </Button>
                          )}
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="space-y-2 md:hidden">
              {subscriptions.map(sub => (
                <button key={sub.id} type="button" onClick={() => fetchSubscriptionDetails(sub)} className="w-full rounded-lg border border-border/40 bg-card p-3 text-left">
                  <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate font-mono text-xs font-semibold">{maskEmail(sub.email)}</p><p className="text-xs capitalize text-muted-foreground">{sub.plan_type} · {getPlanPrice(sub.plan_type)}</p></div>{getStatusBadge(sub)}</div>
                  <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border/30 pt-2 text-[10px]"><div><p className="text-muted-foreground">Payment</p><p className="capitalize">{sub.payment_method || "Not linked"}</p></div><div><p className="text-muted-foreground">Renews / ends</p><p>{sub.end_date ? new Date(sub.end_date).toLocaleDateString() : "—"}</p></div></div>
                </button>
              ))}
            </div>
          </div>)}
        </CardContent>
      </Card>

      {/* Detail Sheet */}
      <Sheet open={showDetailSheet} onOpenChange={setShowDetailSheet}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <div className="flex items-center gap-2">
              <SheetTitle>Subscription Overview</SheetTitle>
              {selectedSubscription && getStatusBadge(selectedSubscription)}
            </div>
            <SheetDescription className="font-mono">{selectedSubscription ? maskEmail(selectedSubscription.email) : ""}</SheetDescription>
          </SheetHeader>
          {selectedSubscription && (
            <div className="mt-6 space-y-6">
              <Card><CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div><h3 className="font-semibold text-lg capitalize">{selectedSubscription.plan_type} Membership</h3><p className="text-sm text-muted-foreground">Pricing Plan</p></div>
                  <p className="text-xl font-bold">{getPlanPrice(selectedSubscription.plan_type)}</p>
                </div>
                <Separator className="my-4" />
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div><p className="text-muted-foreground">Start</p><p className="font-medium">{new Date(selectedSubscription.start_date).toLocaleDateString()}</p></div>
                  <div><p className="text-muted-foreground">End</p><p className="font-medium">{selectedSubscription.end_date ? new Date(selectedSubscription.end_date).toLocaleDateString() : "-"}</p></div>
                  <div><p className="text-muted-foreground">Method</p><p className="font-medium capitalize">{selectedSubscription.payment_method || "Online"}</p></div>
                </div>
              </CardContent></Card>

              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setShowMarkAsPaidDialog(true)} className="gap-2"><DollarSign className="w-4 h-4" />Mark as Paid</Button>
                <Button variant="outline" onClick={() => setShowExtendDialog(true)} className="gap-2"><CalendarPlus className="w-4 h-4" />Extend</Button>
                {selectedSubscription.cancellation_status === "pending" ? (
                  <Button variant="outline" onClick={handleUndoCancellation} disabled={isProcessing} className="gap-2"><RotateCcw className="w-4 h-4" />Undo Cancel</Button>
                ) : selectedSubscription.status === "active" && (
                  <Button variant="destructive" onClick={() => setShowCancelDialog(true)} className="gap-2"><Ban className="w-4 h-4" />Cancel</Button>
                )}
              </div>

              <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><History className="w-4 h-4" />Payment History</CardTitle></CardHeader>
                <CardContent>{paymentHistory.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">No payments</p> : (
                  <div className="space-y-3">{paymentHistory.map(p => (
                    <div key={p.id} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                      <div><p className="font-medium">${p.amount} {p.currency}</p><p className="text-xs text-muted-foreground capitalize">{p.payment_method}</p></div>
                      <div className="text-right"><p className="text-sm">{new Date(p.payment_date).toLocaleDateString()}</p><Badge variant={p.status === "completed" ? "default" : "secondary"} className="text-xs">{p.status}</Badge></div>
                    </div>
                  ))}</div>
                )}</CardContent>
              </Card>

              <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Clock className="w-4 h-4" />Activity</CardTitle></CardHeader>
                <CardContent>{activityHistory.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">No activity</p> : (
                  <div className="space-y-2">{activityHistory.map(a => (
                    <div key={a.id} className="flex items-start gap-3 text-sm"><div className="w-2 h-2 mt-2 bg-primary rounded-full" /><div><p className="font-medium capitalize">{a.action.replace(/_/g, " ")}</p><p className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</p></div></div>
                  ))}</div>
                )}</CardContent>
              </Card>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Mark as Paid Dialog */}
      <Dialog open={showMarkAsPaidDialog} onOpenChange={setShowMarkAsPaidDialog}>
        <DialogContent><DialogHeader><DialogTitle>Record Payment</DialogTitle><DialogDescription>Record an offline payment</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div><Label>Amount ($)</Label><Input type="number" placeholder="0.00" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} /></div>
            <div><Label>Method</Label><Select value={paymentMethod} onValueChange={setPaymentMethod}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="check">Check</SelectItem><SelectItem value="zelle">Zelle</SelectItem><SelectItem value="venmo">Venmo</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></div>
            <div><Label>Notes</Label><Textarea placeholder="Optional notes..." value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowMarkAsPaidDialog(false)}>Cancel</Button><Button onClick={handleMarkAsPaid} disabled={!paymentAmount || isProcessing}>{isProcessing ? "Recording..." : "Record Payment"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent><DialogHeader><DialogTitle>Cancel Subscription</DialogTitle></DialogHeader>
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm"><p className="font-semibold">Stop PayPal renewal?</p><p className="mt-1 text-muted-foreground">The member account and history will remain. Paid access continues through the current billing period.</p></div>
          <DialogFooter><Button variant="outline" onClick={() => setShowCancelDialog(false)}>Back</Button><Button variant="destructive" onClick={handleCancelSubscription} disabled={isProcessing}>{isProcessing ? "Cancelling..." : "Confirm Cancel"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Extend Dialog */}
      <Dialog open={showExtendDialog} onOpenChange={setShowExtendDialog}>
        <DialogContent><DialogHeader><DialogTitle>Extend Subscription</DialogTitle></DialogHeader>
          <div><Label>Days to Add</Label><Input type="number" value={extendDays} onChange={(e) => setExtendDays(e.target.value)} /></div>
          <DialogFooter><Button variant="outline" onClick={() => setShowExtendDialog(false)}>Cancel</Button><Button onClick={handleExtendSubscription} disabled={!extendDays || isProcessing}>{isProcessing ? "Extending..." : "Extend"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
