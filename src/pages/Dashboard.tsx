import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  BookOpen, Calendar, CheckCircle2, ChevronRight, CircleDollarSign,
  Clock3, CreditCard, LifeBuoy, Loader2, LockKeyhole,
  MessageSquarePlus, Mic, Settings, ShieldAlert, Tv, Upload, User,
} from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import OnboardingWalkthrough from "@/components/OnboardingWalkthrough";
import NotificationPreferencesCard from "@/components/NotificationPreferencesCard";
import PasskeyManager from "@/components/PasskeyManager";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { uploadToR2 } from "@/lib/r2Upload";
import { CANCELLATION_RESULT_KEY } from "@/pages/CancellationStatus";

type MemberPlan = "free" | "trial" | "weekly" | "premium" | "annual";

const PLAN_LABELS: Record<MemberPlan, string> = {
  free: "No paid plan",
  trial: "Trial",
  weekly: "Weekly",
  premium: "Premium",
  annual: "Annual",
};

const PLAN_PRICES: Record<MemberPlan, string> = {
  free: "Not subscribed",
  trial: "Complimentary access",
  weekly: "$3.99 / week",
  premium: "$9.99 / month",
  annual: "$129.99 / year",
};

const Dashboard = () => {
  const { user, loading } = useAuth();
  const { limitedAccess } = useSubscription();
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [plan, setPlan] = useState<MemberPlan>("free");
  const [status, setStatus] = useState("none");
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [memberDays, setMemberDays] = useState(0);
  const [postCount, setPostCount] = useState(0);
  const [cancellationCount, setCancellationCount] = useState(0);
  const [profileOpen, setProfileOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate("/auth?mode=login", { replace: true });
  }, [loading, navigate, user]);

  useEffect(() => {
    if (!user) return;
    setMemberDays(Math.max(0, Math.floor((Date.now() - new Date(user.created_at).getTime()) / 86_400_000)));

    const loadMember = async () => {
      setSubscriptionLoading(true);
      const [subResult, profileResult, postsResult, activityResult] = await Promise.all([
        supabase.from("subscriptions")
          .select("plan_type, status, end_date, payment_method")
          .eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("profiles").select("full_name, avatar_url").eq("id", user.id).maybeSingle(),
        supabase.from("posts").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("subscription_activity").select("action, created_at").eq("user_id", user.id)
          .in("action", ["membership_cancelled", "account_cancelled_deleted", "access_restored"])
          .order("created_at", { ascending: false }),
      ]);

      if (subResult.error) {
        toast({ title: "Membership unavailable", description: "We could not load your membership. Please try again.", variant: "destructive" });
      } else if (subResult.data) {
        setPlan((subResult.data.plan_type || "free") as MemberPlan);
        setStatus(subResult.data.status || "none");
        setEndDate(subResult.data.end_date ? new Date(subResult.data.end_date) : null);
        setPaymentMethod(subResult.data.payment_method || null);
      }
      if (profileResult.data) {
        setFullName(profileResult.data.full_name || "");
        setAvatarUrl(profileResult.data.avatar_url || "");
      }
      setPostCount(postsResult.count || 0);
      const events = activityResult.data || [];
      const latestRestore = events.find((event) => event.action === "access_restored")?.created_at;
      setCancellationCount(events.filter((event) => event.action !== "access_restored" && (!latestRestore || event.created_at > latestRestore)).length);
      setSubscriptionLoading(false);
    };
    void loadMember();
  }, [toast, user]);

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type) || file.size > 2 * 1024 * 1024) {
      toast({ title: "Photo not accepted", description: "Use a JPG, PNG, WebP, or GIF under 2MB.", variant: "destructive" });
      return;
    }
    setUploadingAvatar(true);
    try {
      const { publicUrl } = await uploadToR2(file, `avatars/${user.id}`);
      const { error } = await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", user.id);
      if (error) throw error;
      setAvatarUrl(publicUrl);
      toast({ title: "Photo updated" });
    } catch {
      toast({ title: "Upload failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    const { error } = await supabase.from("profiles").update({ full_name: fullName.trim(), avatar_url: avatarUrl }).eq("id", user.id);
    setSavingProfile(false);
    if (error) {
      toast({ title: "Could not save profile", description: "Please try again.", variant: "destructive" });
      return;
    }
    setProfileOpen(false);
    toast({ title: "Profile updated" });
  };

  const handleCancel = async () => {
    setCancelling(true);
    try {
      const { data, error } = await supabase.functions.invoke("cancel-subscription", { body: {} });
      if (error || (data as { error?: string } | null)?.error) throw new Error("cancel_failed");
      const response = data as { cancellationCount?: number; limitedAccess?: boolean; message?: string } | null;
      const nextCount = Number(response?.cancellationCount || cancellationCount + 1);
      sessionStorage.setItem(CANCELLATION_RESULT_KEY, JSON.stringify({
        paypalConfirmed: true, accountRetained: true, cancellationCount: nextCount,
        limitedAccess: Boolean(response?.limitedAccess), message: response?.message, at: new Date().toISOString(),
      }));
      setCancellationCount(nextCount);
      setStatus("cancelled");
      setCancelOpen(false);
      navigate("/dashboard/cancellation-status");
    } catch {
      toast({ title: "Cancellation could not be completed", description: "Nothing was changed. Please try again or contact support.", variant: "destructive" });
    } finally {
      setCancelling(false);
    }
  };

  if (loading || !user) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;
  }

  const paidPlan = ["weekly", "premium", "annual"].includes(plan);
  const validUntil = endDate && endDate > new Date();
  const accessActive = !limitedAccess && (status === "active" || (status === "cancelled" && validUntil) || plan === "trial");
  const paypalLinked = paymentMethod === "paypal";
  const dateLabel = status === "cancelled" ? "Access through" : plan === "trial" ? "Trial ends" : "Next billing";
  const quickLinks = [
    { label: "Watch Live", description: "Live games and events", icon: Tv, href: "/metsxmfanzone", locked: !accessActive },
    { label: "Community", description: "Talk with Mets fans", icon: MessageSquarePlus, href: "/community", locked: !accessActive },
    { label: "Articles", description: "Latest stories", icon: BookOpen, href: "/blog", locked: false },
    { label: "Podcasts", description: "Listen to new shows", icon: Mic, href: "/podcast", locked: !accessActive },
  ];

  return (
    <div className="min-h-screen bg-background">
      <OnboardingWalkthrough onComplete={() => {}} />
      <Navigation />
      <main className="pt-14 pb-12">
        <div className="container max-w-6xl px-3 sm:px-6 space-y-5">
          <header className="flex items-center justify-between gap-3 py-3 border-b border-border/40">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase text-primary">Member Center</p>
              <h1 className="text-2xl sm:text-4xl text-foreground truncate">Welcome, {fullName || "Mets fan"}</h1>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">{user.email}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setProfileOpen(true)} className="shrink-0 gap-1.5">
              <Settings className="h-4 w-4" /> <span className="hidden sm:inline">Edit profile</span>
            </Button>
          </header>

          <section className="grid gap-4 lg:grid-cols-[1.6fr_1fr] p-0">
            <div className="rounded-lg border border-border/50 bg-card/90 p-4 sm:p-6">
              <div className="flex items-start gap-4">
                <Avatar className="h-14 w-14 sm:h-16 sm:w-16 border border-primary/40">
                  <AvatarImage src={avatarUrl} alt="Profile photo" />
                  <AvatarFallback className="bg-secondary text-secondary-foreground text-xl">{(fullName || user.email || "M").charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl sm:text-2xl text-foreground">{PLAN_LABELS[plan]}</h2>
                    <Badge variant={accessActive ? "default" : "secondary"}>{limitedAccess ? "Limited" : accessActive ? "Access active" : "Inactive"}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{PLAN_PRICES[plan]}</p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border/40 bg-border/40 sm:grid-cols-4">
                {[
                  { label: "Billing", value: paypalLinked ? "PayPal linked" : "Not linked", icon: CircleDollarSign },
                  { label: dateLabel, value: endDate ? endDate.toLocaleDateString() : "—", icon: Calendar },
                  { label: "Member since", value: new Date(user.created_at).toLocaleDateString(undefined, { month: "short", year: "numeric" }), icon: Clock3 },
                  { label: "Community posts", value: String(postCount), icon: MessageSquarePlus },
                ].map((item) => (
                  <div key={item.label} className="bg-card p-3 min-w-0">
                    <item.icon className="h-4 w-4 text-primary mb-2" />
                    <p className="text-[10px] uppercase text-muted-foreground">{item.label}</p>
                    <p className="text-xs sm:text-sm font-semibold text-foreground truncate">{item.value}</p>
                  </div>
                ))}
              </div>

              {limitedAccess && (
                <div className="mt-4 flex gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3">
                  <ShieldAlert className="h-5 w-5 shrink-0 text-destructive" />
                  <div><p className="text-sm font-semibold">Paid access is limited</p><p className="text-xs text-muted-foreground">Contact support to review your membership eligibility.</p></div>
                </div>
              )}

              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                <Button onClick={() => navigate("/pricing")}><CreditCard className="mr-2 h-4 w-4" />{paidPlan ? "Change plan" : "Choose a plan"}</Button>
                {paidPlan && status === "active" ? (
                  <Button variant="outline" onClick={() => setCancelOpen(true)}>Cancel membership</Button>
                ) : (
                  <Button variant="outline" asChild><Link to="/contact"><LifeBuoy className="mr-2 h-4 w-4" />Membership help</Link></Button>
                )}
              </div>
            </div>

            <aside className="rounded-lg border border-border/50 bg-card/70 p-4 sm:p-5">
              <h2 className="text-lg text-foreground">Account snapshot</h2>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between gap-3 border-b border-border/30 pb-3"><span className="text-muted-foreground">Status</span><span className="font-semibold capitalize">{status}</span></div>
                <div className="flex justify-between gap-3 border-b border-border/30 pb-3"><span className="text-muted-foreground">Cancellations</span><span className="font-semibold">{cancellationCount}</span></div>
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">Days as member</span><span className="font-semibold">{memberDays}</span></div>
              </div>
              {status === "cancelled" && validUntil && <p className="mt-4 rounded-md bg-muted p-3 text-xs text-muted-foreground">Your renewal is stopped. Paid access continues through {endDate?.toLocaleDateString()}.</p>}
            </aside>
          </section>

          <section className="p-0">
            <div className="mb-3 flex items-center justify-between"><h2 className="text-xl text-foreground">Your shortcuts</h2><span className="text-xs text-muted-foreground">Fast access</span></div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {quickLinks.map((item) => (
                <Link key={item.label} to={item.locked ? "/pricing?required=true" : item.href} className="flex min-h-20 items-center gap-3 rounded-lg border border-border/40 bg-card/70 p-3 transition-colors hover:border-primary/60 hover:bg-card">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-secondary/40"><item.icon className="h-5 w-5 text-foreground" /></div>
                  <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{item.label}</p><p className="text-xs text-muted-foreground">{item.locked ? "Membership required" : item.description}</p></div>
                  {item.locked ? <LockKeyhole className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </Link>
              ))}
            </div>
          </section>

          <section className="grid gap-4 p-0 lg:grid-cols-2">
            <div className="overflow-hidden rounded-lg border border-border/50 bg-card/70 [&>*]:border-0 [&>*]:bg-transparent"><NotificationPreferencesCard /></div>
            <div className="overflow-hidden rounded-lg border border-border/50 bg-card/70 [&>*]:border-0 [&>*]:bg-transparent"><PasskeyManager /></div>
          </section>

          <div className="flex flex-wrap gap-3 border-t border-border/40 pt-4 text-xs">
            <Link to="/help/return-policy" className="text-muted-foreground hover:text-primary">Return policy</Link>
            <Link to="/contact" className="text-muted-foreground hover:text-primary">Contact support</Link>
          </div>
        </div>
      </main>

      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-md overflow-y-auto">
          <DialogHeader><DialogTitle>Edit profile</DialogTitle><DialogDescription>Update how your profile appears.</DialogDescription></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3">
              <Avatar className="h-16 w-16"><AvatarImage src={avatarUrl} /><AvatarFallback><User /></AvatarFallback></Avatar>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleAvatarUpload} className="hidden" />
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploadingAvatar}>{uploadingAvatar ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}Change photo</Button>
            </div>
            <div className="space-y-2"><Label htmlFor="member-name">Full name</Label><Input id="member-name" value={fullName} onChange={(event) => setFullName(event.target.value)} /></div>
            <Button className="w-full" onClick={handleSaveProfile} disabled={savingProfile}>{savingProfile ? "Saving…" : "Save profile"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="grid max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-md grid-rows-[auto_1fr_auto] overflow-hidden p-0">
          <DialogHeader className="border-b border-border/50 p-5 text-left"><DialogTitle>Before you cancel</DialogTitle><DialogDescription>Your account will stay open after PayPal renewal stops.</DialogDescription></DialogHeader>
          <div className="space-y-3 overflow-y-auto p-5 text-sm text-muted-foreground">
            <div className="flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-primary" /><p>Paid access continues through the current billing period.</p></div>
            <div className="flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-primary" /><p>Your profile and membership history remain available.</p></div>
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-foreground">You have cancelled {cancellationCount} time{cancellationCount === 1 ? "" : "s"}. More than two cancellations limits paid access until an admin reviews it.</div>
          </div>
          <div className="grid gap-2 border-t border-border/50 p-4 sm:grid-cols-2"><Button variant="outline" onClick={() => setCancelOpen(false)}>Keep membership</Button><Button variant="destructive" onClick={handleCancel} disabled={cancelling}>{cancelling ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Cancelling…</> : "Confirm cancellation"}</Button></div>
        </DialogContent>
      </Dialog>
      <Footer />
    </div>
  );
};

export default Dashboard;