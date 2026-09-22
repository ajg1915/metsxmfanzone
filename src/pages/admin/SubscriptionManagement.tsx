import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
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
  Calendar, 
  Mail, 
  DollarSign, 
  Clock, 
  ChevronRight, 
  X, 
  Check, 
  Ban, 
  RotateCcw, 
  CalendarPlus,
  CreditCard,
  History,
  Eye
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { AdminPage, AdminPageHeader, AdminStatGrid, AdminStat, AdminLoading, AdminSearch, AdminFilterChips, AdminList, AdminListCard, AdminRow } from "@/components/admin/AdminUI";

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

export default function SubscriptionManagement() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [subscriptions, setSubscriptions] = useState<UserSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubscription, setSelectedSubscription] = useState<UserSubscription | null>(null);
  const [showDetailSheet, setShowDetailSheet] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState<PaymentRecord[]>([]);
  const [activityHistory, setActivityHistory] = useState<ActivityRecord[]>([]);
  
  // Dialog states
  const [showMarkAsPaidDialog, setShowMarkAsPaidDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showExtendDialog, setShowExtendDialog] = useState(false);
  
  // Form states
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [extendDays, setExtendDays] = useState("30");
  const [cancelType, setCancelType] = useState<"immediate" | "pending">("pending");
  const [isProcessing, setIsProcessing] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    if (!authLoading && (!user || user.email !== "ajg1915@gmail.com")) {
      navigate("/");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user?.email === "ajg1915@gmail.com") {
      fetchSubscriptions();
    }
  }, [user]);

  const fetchSubscriptions = async () => {
    try {
      const { data: subs, error: subsError } = await supabase
        .from("subscriptions")
        .select("*")
        .order("created_at", { ascending: false });

      if (subsError) throw subsError;

      const userIds = [...new Set(subs?.map(s => s.user_id) || [])];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email")
        .in("id", userIds);

      const emailMap = new Map(profiles?.map(p => [p.id, p.email]) || []);

      const subsWithEmails = subs?.map(sub => ({
        ...sub,
        email: emailMap.get(sub.user_id) || "Unknown"
      })) || [];

      setSubscriptions(subsWithEmails);
    } catch (error) {
      console.error("Error fetching subscriptions:", error);
      toast({
        title: "Error",
        description: "Failed to load subscriptions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchSubscriptionDetails = async (subscription: UserSubscription) => {
    setSelectedSubscription(subscription);
    setShowDetailSheet(true);
    
    // Fetch payment history
    const { data: payments } = await supabase
      .from("subscription_payments")
      .select("*")
      .eq("subscription_id", subscription.id)
      .order("payment_date", { ascending: false });
    
    setPaymentHistory(payments || []);
    
    // Fetch activity history
    const { data: activity } = await supabase
      .from("subscription_activity")
      .select("*")
      .eq("subscription_id", subscription.id)
      .order("created_at", { ascending: false });
    
    setActivityHistory(activity || []);
  };

  const handleMarkAsPaid = async () => {
    if (!selectedSubscription || !paymentAmount) return;
    setIsProcessing(true);
    
    try {
      const amount = parseFloat(paymentAmount);
      
      // Create payment record
      const { error: paymentError } = await supabase
        .from("subscription_payments")
        .insert({
          subscription_id: selectedSubscription.id,
          user_id: selectedSubscription.user_id,
          amount,
          currency: selectedSubscription.currency || "USD",
          payment_method: paymentMethod,
          payment_date: new Date().toISOString(),
          status: "completed",
          notes: paymentNotes || null,
          recorded_by: user?.id,
        });

      if (paymentError) throw paymentError;

      // Update subscription
      const { error: subError } = await supabase
        .from("subscriptions")
        .update({
          last_payment_date: new Date().toISOString(),
          last_payment_amount: amount,
          payment_method: paymentMethod,
          total_payments_received: (selectedSubscription.total_payments_received || 0) + 1,
          status: "active",
        })
        .eq("id", selectedSubscription.id);

      if (subError) throw subError;

      // Log activity
      await supabase.from("subscription_activity").insert({
        subscription_id: selectedSubscription.id,
        user_id: selectedSubscription.user_id,
        action: "payment_recorded",
        details: { amount, method: paymentMethod, notes: paymentNotes },
        performed_by: user?.id,
      });

      toast({ title: "Success", description: `Payment of $${amount} recorded successfully` });
      setShowMarkAsPaidDialog(false);
      setPaymentAmount("");
      setPaymentNotes("");
      fetchSubscriptions();
      fetchSubscriptionDetails(selectedSubscription);
    } catch (error) {
      console.error("Error recording payment:", error);
      toast({ title: "Error", description: "Failed to record payment", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!selectedSubscription) return;
    setIsProcessing(true);
    
    try {
      if (cancelType === "immediate") {
        await supabase
          .from("subscriptions")
          .update({
            status: "cancelled",
            cancellation_status: null,
            end_date: new Date().toISOString(),
          })
          .eq("id", selectedSubscription.id);
      } else {
        await supabase
          .from("subscriptions")
          .update({
            cancellation_status: "pending",
            cancellation_requested_at: new Date().toISOString(),
          })
          .eq("id", selectedSubscription.id);
      }

      await supabase.from("subscription_activity").insert({
        subscription_id: selectedSubscription.id,
        user_id: selectedSubscription.user_id,
        action: cancelType === "immediate" ? "subscription_cancelled" : "cancellation_requested",
        details: { type: cancelType },
        performed_by: user?.id,
      });

      toast({ 
        title: "Success", 
        description: cancelType === "immediate" 
          ? "Subscription cancelled immediately" 
          : "Subscription set to pending cancellation" 
      });
      setShowCancelDialog(false);
      fetchSubscriptions();
      setShowDetailSheet(false);
    } catch (error) {
      console.error("Error cancelling subscription:", error);
      toast({ title: "Error", description: "Failed to cancel subscription", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUndoCancellation = async () => {
    if (!selectedSubscription) return;
    setIsProcessing(true);
    
    try {
      await supabase
        .from("subscriptions")
        .update({
          cancellation_status: null,
          cancellation_requested_at: null,
        })
        .eq("id", selectedSubscription.id);

      await supabase.from("subscription_activity").insert({
        subscription_id: selectedSubscription.id,
        user_id: selectedSubscription.user_id,
        action: "cancellation_undone",
        details: {},
        performed_by: user?.id,
      });

      toast({ title: "Success", description: "Cancellation request undone" });
      fetchSubscriptions();
      fetchSubscriptionDetails({ ...selectedSubscription, cancellation_status: null });
    } catch (error) {
      console.error("Error undoing cancellation:", error);
      toast({ title: "Error", description: "Failed to undo cancellation", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExtendSubscription = async () => {
    if (!selectedSubscription || !extendDays) return;
    setIsProcessing(true);
    
    try {
      const days = parseInt(extendDays);
      const currentEnd = selectedSubscription.end_date 
        ? new Date(selectedSubscription.end_date) 
        : new Date();
      const newEnd = new Date(currentEnd);
      newEnd.setDate(newEnd.getDate() + days);

      await supabase
        .from("subscriptions")
        .update({
          end_date: newEnd.toISOString(),
          status: "active",
        })
        .eq("id", selectedSubscription.id);

      await supabase.from("subscription_activity").insert({
        subscription_id: selectedSubscription.id,
        user_id: selectedSubscription.user_id,
        action: "subscription_extended",
        details: { days_added: days, new_end_date: newEnd.toISOString() },
        performed_by: user?.id,
      });

      toast({ title: "Success", description: `Subscription extended by ${days} days` });
      setShowExtendDialog(false);
      setExtendDays("30");
      fetchSubscriptions();
      setShowDetailSheet(false);
    } catch (error) {
      console.error("Error extending subscription:", error);
      toast({ title: "Error", description: "Failed to extend subscription", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleActivatePending = async (sub: UserSubscription) => {
    setIsProcessing(true);
    try {
      const endDate = new Date();
      if (sub.plan_type === "annual") {
        endDate.setFullYear(endDate.getFullYear() + 1);
      } else if (sub.plan_type === "premium") {
        endDate.setMonth(endDate.getMonth() + 1);
      } else {
        // Free plan - 30 days
        endDate.setDate(endDate.getDate() + 30);
      }

      const { error } = await supabase
        .from("subscriptions")
        .update({
          status: "active",
          start_date: new Date().toISOString(),
          end_date: endDate.toISOString(),
        })
        .eq("id", sub.id);

      if (error) throw error;

      // Log activity
      await supabase.from("subscription_activity").insert({
        subscription_id: sub.id,
        user_id: sub.user_id,
        action: "manually_activated",
        details: { plan_type: sub.plan_type, activated_by: "admin" },
        performed_by: user?.id,
      });

      toast({ title: "Activated!", description: `${sub.plan_type} subscription activated for ${sub.email}` });
      fetchSubscriptions();
    } catch (error) {
      console.error("Error activating subscription:", error);
      toast({ title: "Error", description: "Failed to activate subscription", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusBadge = (sub: UserSubscription) => {
    if (sub.cancellation_status === "pending") {
      return <Badge variant="outline" className="text-warning border-warning">Pending Cancellation</Badge>;
    }
    
    switch (sub.status) {
      case "active":
        return <Badge className="bg-affirmative">Active</Badge>;
      case "pending":
        return <Badge variant="outline" className="text-yellow-500 border-yellow-500">Pending Payment</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>;
      case "suspended":
        return <Badge variant="secondary">Suspended</Badge>;
      default:
        return <Badge variant="outline">{sub.status}</Badge>;
    }
  };

  const getPlanPrice = (planType: string) => {
    switch (planType) {
      case "weekly": return "$3.99 / week";
      case "premium": return "$9.99 / month";
      case "annual": return "$129.99 / year";
      default: return "Free";
    }
  };

  const filteredSubscriptions = subscriptions.filter((sub) => {
    const matchesQuery = !query.trim() || sub.email.toLowerCase().includes(query.trim().toLowerCase()) || sub.plan_type.toLowerCase().includes(query.trim().toLowerCase());
    const effectiveStatus = sub.cancellation_status === "pending" ? "cancelling" : sub.status;
    return matchesQuery && (statusFilter === "all" || effectiveStatus === statusFilter);
  });

  if (authLoading || loading) {
    return <AdminLoading label="Loading subscriptions…" />;
  }

  return (
    <AdminPage>
      <AdminPageHeader
        icon={CreditCard}
        title="Subscriptions"
        count={subscriptions.length}
        description="Manage plans, PayPal status, payments, extensions, and cancellations"
      />

      {/* Stats Cards */}
      <AdminStatGrid>
        <AdminStat
          icon={Check}
          label="Active"
          tone="success"
          value={subscriptions.filter(s => s.status === "active" && !s.cancellation_status).length}
        />
        <AdminStat
          icon={Clock}
          label="Pending Cancel"
          tone="warning"
          value={subscriptions.filter(s => s.cancellation_status === "pending").length}
        />
        <AdminStat
          icon={Ban}
          label="Cancelled"
          tone="danger"
          value={subscriptions.filter(s => s.status === "cancelled").length}
        />
        <AdminStat
          icon={Clock}
          label="Pending"
          tone="warning"
          value={subscriptions.filter(s => s.status === "pending").length}
        />
        <AdminStat
          icon={DollarSign}
          label="Paid"
          value={subscriptions.filter(s => s.plan_type !== "free" && s.status === "active").length}
        />
      </AdminStatGrid>

      <div className="flex flex-col gap-1.5 rounded-md border border-border/30 bg-card/80 p-2 sm:flex-row sm:items-center">
        <AdminSearch value={query} onChange={setQuery} placeholder="Search email or plan…" />
        <AdminFilterChips
          active={statusFilter}
          onChange={setStatusFilter}
          filters={[
            { key: "all", label: "All", count: subscriptions.length },
            { key: "active", label: "Active" },
            { key: "pending", label: "Pending" },
            { key: "cancelling", label: "Cancelling" },
            { key: "cancelled", label: "Cancelled" },
          ]}
        />
      </div>

      <Card className="hidden rounded-md border-border/30 lg:block">
        <CardHeader className="px-3 py-2"><CardTitle className="text-sm">Subscriptions <span className="font-sans text-[10px] font-medium text-muted-foreground">{filteredSubscriptions.length} shown</span></CardTitle></CardHeader>
        <CardContent className="px-0 pb-0">
          {filteredSubscriptions.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No subscriptions found</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Last Payment</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubscriptions.map((sub) => (
                    <TableRow 
                      key={sub.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => fetchSubscriptionDetails(sub)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">{sub.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium capitalize">{sub.plan_type}</p>
                          <p className="text-xs text-muted-foreground">{getPlanPrice(sub.plan_type)}</p>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(sub)}</TableCell>
                      <TableCell>
                        <span className="capitalize text-sm">{sub.payment_method || "—"}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-medium">{sub.amount ? `$${sub.amount}` : "Free"}</span>
                      </TableCell>
                      <TableCell>
                        {sub.last_payment_date ? (
                          <div className="text-sm">
                            <p>{new Date(sub.last_payment_date).toLocaleDateString()}</p>
                            <p className="text-muted-foreground">${sub.last_payment_amount}</p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {sub.end_date ? (
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="w-4 h-4 text-muted-foreground" />
                            {new Date(sub.end_date).toLocaleDateString()}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {sub.status === "pending" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-green-600 hover:text-green-700 hover:bg-green-500/10"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleActivatePending(sub);
                              }}
                            >
                              <Check className="w-3 h-3 mr-1" />
                              Activate
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
          )}
        </CardContent>
      </Card>

      <div className="lg:hidden">
        <AdminList>
          {filteredSubscriptions.map((sub) => (
            <AdminListCard key={sub.id} highlight={sub.cancellation_status === "pending"}>
              <AdminRow
                title={sub.email}
                meta={`${sub.plan_type} · ${getPlanPrice(sub.plan_type)}`}
                badges={getStatusBadge(sub)}
                actions={<Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => fetchSubscriptionDetails(sub)} aria-label={`Open ${sub.email}`}><ChevronRight className="h-4 w-4" /></Button>}
                body={<button type="button" onClick={() => fetchSubscriptionDetails(sub)} className="grid w-full grid-cols-3 gap-1 border-t border-border/30 pt-1.5 text-left text-[9px]">
                  <span><span className="block text-muted-foreground">PayPal</span><span className="capitalize">{sub.payment_method || "Not linked"}</span></span>
                  <span><span className="block text-muted-foreground">Amount</span>{sub.amount ? `$${sub.amount}` : "Free"}</span>
                  <span><span className="block text-muted-foreground">Renews / ends</span>{sub.end_date ? new Date(sub.end_date).toLocaleDateString() : "—"}</span>
                </button>}
              />
            </AdminListCard>
          ))}
          {filteredSubscriptions.length === 0 && <p className="py-8 text-center text-xs text-muted-foreground">No subscriptions match these filters.</p>}
        </AdminList>
      </div>

      {/* Subscription Detail Sheet */}
      <Sheet open={showDetailSheet} onOpenChange={setShowDetailSheet}>
        <SheetContent className="w-full overflow-y-auto p-4 sm:max-w-xl">
          <SheetHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SheetTitle>Subscription Overview</SheetTitle>
                {selectedSubscription && getStatusBadge(selectedSubscription)}
              </div>
            </div>
            <SheetDescription>{selectedSubscription?.email}</SheetDescription>
          </SheetHeader>

          {selectedSubscription && (
            <div className="mt-4 space-y-3">
              {/* Plan Info */}
              <Card className="rounded-md border-border/30">
                <CardContent className="p-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-lg capitalize">{selectedSubscription.plan_type} Membership</h3>
                      <p className="text-sm text-muted-foreground">Pricing Plan</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold">{getPlanPrice(selectedSubscription.plan_type)}</p>
                    </div>
                  </div>

                  <Separator className="my-4" />

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Start date</p>
                      <p className="font-medium">{new Date(selectedSubscription.start_date).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">End date</p>
                      <p className="font-medium">
                        {selectedSubscription.end_date 
                          ? new Date(selectedSubscription.end_date).toLocaleDateString() 
                          : "-"}
                      </p>
                      {selectedSubscription.cancellation_status === "pending" && (
                        <p className="text-xs text-warning">Pending cancellation</p>
                      )}
                    </div>
                    <div>
                      <p className="text-muted-foreground">Payments received</p>
                      <p className="font-medium">{selectedSubscription.total_payments_received || 0}</p>
                    </div>
                  </div>

                  <Separator className="my-4" />

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Last payment</p>
                      {selectedSubscription.last_payment_date ? (
                        <>
                          <p className="font-medium">{new Date(selectedSubscription.last_payment_date).toLocaleDateString()}</p>
                          <p className="text-muted-foreground">${selectedSubscription.last_payment_amount}</p>
                        </>
                      ) : (
                        <p className="font-medium">-</p>
                      )}
                    </div>
                    <div>
                      <p className="text-muted-foreground">Next payment</p>
                      {selectedSubscription.next_payment_date ? (
                        <>
                          <p className="font-medium">{new Date(selectedSubscription.next_payment_date).toLocaleDateString()}</p>
                          <p className="text-muted-foreground">${selectedSubscription.next_payment_amount}</p>
                        </>
                      ) : (
                        <p className="font-medium">-</p>
                      )}
                    </div>
                    <div>
                      <p className="text-muted-foreground">Payment method</p>
                      <p className="font-medium capitalize">{selectedSubscription.payment_method || "Online"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap">
                <Button size="sm" onClick={() => setShowMarkAsPaidDialog(true)} className="gap-1">
                  <DollarSign className="w-4 h-4" />
                  Mark as Paid
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowExtendDialog(true)} className="gap-1">
                  <CalendarPlus className="w-4 h-4" />
                  Extend
                </Button>
                {selectedSubscription.cancellation_status === "pending" ? (
                  <Button size="sm" variant="outline" onClick={handleUndoCancellation} disabled={isProcessing} className="gap-1">
                    <RotateCcw className="w-4 h-4" />
                    Undo Cancellation
                  </Button>
                ) : selectedSubscription.status === "active" && (
                  <Button size="sm" variant="destructive" onClick={() => setShowCancelDialog(true)} className="gap-1">
                    <Ban className="w-4 h-4" />
                    Cancel
                  </Button>
                )}
              </div>

              {/* Payment History */}
              <Card className="rounded-md border-border/30">
                <CardHeader className="p-3 pb-1">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <History className="w-4 h-4" />
                    Payment History
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-1">
                  {paymentHistory.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No payments recorded</p>
                  ) : (
                    <div className="space-y-3">
                      {paymentHistory.map((payment) => (
                        <div key={payment.id} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                          <div>
                            <p className="font-medium">${payment.amount} {payment.currency}</p>
                            <p className="text-xs text-muted-foreground capitalize">{payment.payment_method}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm">{new Date(payment.payment_date).toLocaleDateString()}</p>
                            <Badge variant={payment.status === "completed" ? "default" : "secondary"} className="text-xs">
                              {payment.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Activity History */}
              <Card className="rounded-md border-border/30">
                <CardHeader className="p-3 pb-1">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Clock className="w-4 h-4" />
                    Subscription History
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-1">
                  {activityHistory.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No activity recorded</p>
                  ) : (
                    <div className="space-y-2">
                      {activityHistory.map((activity) => (
                        <div key={activity.id} className="flex items-start gap-3 text-sm">
                          <div className="w-2 h-2 mt-2 bg-primary rounded-full" />
                          <div>
                            <p className="font-medium capitalize">{activity.action.replace(/_/g, " ")}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(activity.created_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Mark as Paid Dialog */}
      <Dialog open={showMarkAsPaidDialog} onOpenChange={setShowMarkAsPaidDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Record an offline payment for this subscription
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="amount">Amount ($)</Label>
              <Input
                id="amount"
                type="number"
                placeholder="0.00"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="method">Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="zelle">Zelle</SelectItem>
                  <SelectItem value="venmo">Venmo</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                placeholder="Add any notes about this payment..."
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMarkAsPaidDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleMarkAsPaid} disabled={!paymentAmount || isProcessing}>
              {isProcessing ? "Recording..." : "Record Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Subscription</DialogTitle>
            <DialogDescription>
              Choose how to cancel this subscription
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50">
                <input
                  type="radio"
                  name="cancelType"
                  value="pending"
                  checked={cancelType === "pending"}
                  onChange={() => setCancelType("pending")}
                />
                <div>
                  <p className="font-medium">Pending Cancellation</p>
                  <p className="text-sm text-muted-foreground">Ends at the end of the billing period</p>
                </div>
              </label>
              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50">
                <input
                  type="radio"
                  name="cancelType"
                  value="immediate"
                  checked={cancelType === "immediate"}
                  onChange={() => setCancelType("immediate")}
                />
                <div>
                  <p className="font-medium">Cancel Immediately</p>
                  <p className="text-sm text-muted-foreground">Access ends right now</p>
                </div>
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
              Back
            </Button>
            <Button variant="destructive" onClick={handleCancelSubscription} disabled={isProcessing}>
              {isProcessing ? "Cancelling..." : "Confirm Cancel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Extend Dialog */}
      <Dialog open={showExtendDialog} onOpenChange={setShowExtendDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Extend Subscription</DialogTitle>
            <DialogDescription>
              Add extra days to this subscription
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="days">Days to extend</Label>
              <Select value={extendDays} onValueChange={setExtendDays}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="14">14 days</SelectItem>
                  <SelectItem value="30">30 days (1 month)</SelectItem>
                  <SelectItem value="60">60 days (2 months)</SelectItem>
                  <SelectItem value="90">90 days (3 months)</SelectItem>
                  <SelectItem value="365">365 days (1 year)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {selectedSubscription?.end_date && (
              <p className="text-sm text-muted-foreground">
                New end date will be:{" "}
                <span className="font-medium">
                  {new Date(
                    new Date(selectedSubscription.end_date).getTime() + parseInt(extendDays) * 24 * 60 * 60 * 1000
                  ).toLocaleDateString()}
                </span>
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExtendDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleExtendSubscription} disabled={isProcessing}>
              {isProcessing ? "Extending..." : "Extend Subscription"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPage>
  );
}
