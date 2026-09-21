import { useEffect, useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import OnboardingWalkthrough from "@/components/OnboardingWalkthrough";
import NotificationPreferencesCard from "@/components/NotificationPreferencesCard";
import PasskeyManager from "@/components/PasskeyManager";
import { Badge } from "@/components/ui/badge";
import {
  User, CreditCard, Calendar, ArrowUpCircle, Upload, Loader2,
  Shield, Bell, Star, Tv, BookOpen, Mic, MessageSquarePlus,
  Settings, ChevronRight, Sparkles, Clock
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { uploadToR2 } from "@/lib/r2Upload";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CANCELLATION_RESULT_KEY } from "@/pages/CancellationStatus";


const Dashboard = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [userPlan, setUserPlan] = useState<"free" | "premium" | "annual">("free");
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);
  const [subscriptionEndDate, setSubscriptionEndDate] = useState<Date | null>(null);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [subscriptionDialogOpen, setSubscriptionDialogOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>("active");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [postCount, setPostCount] = useState(0);
  const [memberDays, setMemberDays] = useState(0);
  const [cancelling, setCancelling] = useState(false);

  const handleCancelSubscription = async () => {
    const confirmed = window.confirm(
      "Cancel your membership? This stops all future PayPal charges immediately and permanently deletes your MetsXMFanZone account and data. This cannot be undone."
    );
    if (!confirmed) return;
    setCancelling(true);

    const recordResult = (result: Record<string, unknown>) => {
      try {
        sessionStorage.setItem(
          CANCELLATION_RESULT_KEY,
          JSON.stringify({ ...result, at: new Date().toISOString() })
        );
      } catch (_) { /* storage unavailable */ }
    };

    try {
      const { data, error } = await supabase.functions.invoke("cancel-subscription", { body: {} });
      if (error || (data as any)?.error) {
        throw new Error((data as any)?.error || error?.message || "Failed to cancel");
      }

      const accountDeleted = Boolean((data as any)?.accountDeleted);
      setSubscriptionStatus("cancelled");
      setSubscriptionDialogOpen(false);
      recordResult({
        paypalConfirmed: true,
        accountDeleted,
        message: (data as any)?.message,
      });

      if (accountDeleted) {
        await supabase.auth.signOut();
      }
      navigate("/dashboard/cancellation-status");
    } catch (e: any) {
      recordResult({
        paypalConfirmed: false,
        accountDeleted: false,
        error: e?.message || "Failed to cancel",
      });
      setSubscriptionDialogOpen(false);
      toast({
        title: "Cancellation failed",
        description: e?.message || "Please try again or contact support.",
        variant: "destructive",
      });
      navigate("/dashboard/cancellation-status");
    } finally {
      setCancelling(false);
    }
  };



  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth?mode=login");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;

      // Calculate member days
      const created = new Date(user.created_at);
      const now = new Date();
      setMemberDays(Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)));

      try {
        const [subResult, profileResult, postsResult] = await Promise.all([
          supabase
            .from('subscriptions')
            .select('id, plan_type, status, start_date, end_date, amount, currency')
            .eq('user_id', user.id)
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(1)
            .single(),
          supabase
            .from('profiles')
            .select('full_name, avatar_url')
            .eq('id', user.id)
            .single(),
          supabase
            .from('posts')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id),
        ]);

        if (!subResult.error && subResult.data) {
          setUserPlan(subResult.data.plan_type as "free" | "premium" | "annual");
          setSubscriptionStatus(subResult.data.status);
          if (subResult.data.end_date) {
            setSubscriptionEndDate(new Date(subResult.data.end_date));
          }
        }

        if (!profileResult.error && profileResult.data) {
          setFullName(profileResult.data.full_name || "");
          setAvatarUrl(profileResult.data.avatar_url || "");
        }

        setPostCount(postsResult.count || 0);
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setSubscriptionLoading(false);
      }
    };

    fetchUserData();
  }, [user]);

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      toast({ title: "Invalid File Type", description: "Please upload a JPG, PNG, WebP, or GIF image.", variant: "destructive" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File Too Large", description: "Please upload an image smaller than 2MB.", variant: "destructive" });
      return;
    }

    setUploadingAvatar(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/avatar.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
      const { error: updateError } = await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);
      if (updateError) throw updateError;
      setAvatarUrl(publicUrl);
      toast({ title: "Avatar Updated", description: "Your profile picture has been updated." });
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast({ title: "Upload Failed", description: "Failed to upload avatar. Please try again.", variant: "destructive" });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    try {
      const { error } = await supabase.from('profiles').update({ full_name: fullName, avatar_url: avatarUrl }).eq('id', user.id);
      if (error) throw error;
      toast({ title: "Profile Updated", description: "Your profile has been updated successfully." });
      setProfileDialogOpen(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({ title: "Error", description: "Failed to update profile. Please try again.", variant: "destructive" });
    } finally {
      setSavingProfile(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const planLabel = userPlan === "annual" ? "Annual" : userPlan === "premium" ? "Premium" : "Free";
  const planPrice = userPlan === "free" ? "$0" : userPlan === "premium" ? "$9.99/mo" : "$129.99/yr";

  const quickLinks = [
    { label: "Watch Live", icon: Tv, href: "/metsxmfanzone", premium: true },
    { label: "Community", icon: MessageSquarePlus, href: "/community", premium: true },
    { label: "Blog", icon: BookOpen, href: "/blog", premium: false },
    { label: "Podcast", icon: Mic, href: "/podcast", premium: true },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-background to-slate-950 relative">
      {/* Ambient background glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,hsl(var(--primary)/0.18),transparent_60%)] blur-3xl" />
        <div className="absolute top-1/3 -left-40 w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,hsl(var(--secondary)/0.12),transparent_60%)] blur-3xl" />
      </div>

      <OnboardingWalkthrough onComplete={() => {}} />
      <Navigation />
      <main className="pt-12 relative z-10">
        <div className="container mx-auto px-4 max-w-6xl py-8 space-y-6">

          {/* Hero Profile Section */}
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-2xl shadow-2xl shadow-primary/5 p-5 sm:p-8">
            <div className="absolute inset-0 bg-[linear-gradient(135deg,hsl(var(--primary)/0.12),transparent_40%,hsl(var(--secondary)/0.08))] pointer-events-none" />
            <div className="absolute top-0 right-0 w-72 h-72 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary)/0.25),transparent_70%)] pointer-events-none" />
            <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-[radial-gradient(circle,hsl(var(--secondary)/0.15),transparent_70%)] pointer-events-none" />

            <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-5">
              {/* Avatar */}
              <div className="relative group">
                <div className="absolute -inset-1.5 rounded-full bg-gradient-to-br from-primary via-primary/60 to-secondary opacity-80 blur-md group-hover:opacity-100 group-hover:blur-lg transition-all" />
                <Avatar className="relative h-20 w-20 sm:h-28 sm:w-28 ring-2 ring-white/20">
                  <AvatarImage src={avatarUrl} alt="Profile avatar" />
                  <AvatarFallback className="bg-gradient-to-br from-primary/30 to-secondary/30 text-primary text-3xl font-bold">
                    {fullName ? fullName.charAt(0).toUpperCase() : user.email?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </div>

              {/* User Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <h1 className="text-xl sm:text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent truncate">
                    {fullName || "MetsXMFanZone Member"}
                  </h1>
                  {userPlan !== "free" && (
                    <Badge className="bg-gradient-to-r from-primary to-primary/70 text-primary-foreground border-0 shadow-lg shadow-primary/30 shrink-0">
                      <Star className="w-3 h-3 mr-1 fill-current" />
                      {planLabel}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10">
                    <Calendar className="w-3.5 h-3.5 text-primary" />
                    Joined {new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </span>
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10">
                    <Clock className="w-3.5 h-3.5 text-primary" />
                    {memberDays} days active
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 shrink-0">
                <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1.5 bg-white/5 border-white/10 hover:bg-white/10 backdrop-blur-sm">
                      <Settings className="w-3.5 h-3.5" />
                      Edit Profile
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Edit Profile</DialogTitle>
                      <DialogDescription>Update your profile information below.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Profile Picture</Label>
                        <div className="flex items-center gap-4">
                          <Avatar className="h-20 w-20">
                            <AvatarImage src={avatarUrl} alt="Profile avatar" />
                            <AvatarFallback className="bg-primary/10 text-primary text-xl">
                              {fullName ? fullName.charAt(0).toUpperCase() : user.email?.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 space-y-2">
                            <input type="file" ref={fileInputRef} onChange={handleAvatarUpload} accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" />
                            <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploadingAvatar} className="w-full">
                              {uploadingAvatar ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Uploading...</>) : (<><Upload className="w-4 h-4 mr-2" />Upload Photo</>)}
                            </Button>
                            <p className="text-xs text-muted-foreground">JPG, PNG, WebP or GIF. Max 2MB.</p>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="fullName">Full Name</Label>
                        <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Enter your full name" />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setProfileDialogOpen(false)} disabled={savingProfile}>Cancel</Button>
                      <Button onClick={handleSaveProfile} disabled={savingProfile}>{savingProfile ? "Saving..." : "Save Changes"}</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Stats Row */}
            <div className="relative grid grid-cols-3 gap-3 mt-6 pt-6 border-t border-white/10">
              {[
                { value: postCount, label: "Posts" },
                { value: memberDays, label: "Days Active" },
                { value: planLabel, label: "Plan" },
              ].map((stat, i) => (
                <div key={i} className="text-center rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm py-3 px-2 hover:bg-white/10 transition-colors">
                  <p className="text-xl sm:text-3xl font-bold bg-gradient-to-br from-primary to-primary/60 bg-clip-text text-transparent">
                    {stat.value}
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 uppercase tracking-wider">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Subscription Card */}
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-2xl shadow-xl p-5 sm:p-6">
            <div className="absolute top-0 right-0 w-48 h-48 bg-[radial-gradient(circle,hsl(var(--primary)/0.12),transparent_70%)] pointer-events-none" />
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 flex items-center justify-center">
                    <CreditCard className="w-4.5 h-4.5 text-primary" />
                  </div>
                  <h2 className="text-lg font-semibold text-foreground">Subscription</h2>
                </div>
                <Badge variant={userPlan === "free" ? "secondary" : "default"} className={userPlan !== "free" ? "bg-gradient-to-r from-primary to-primary/70 border-0 shadow-lg shadow-primary/20" : ""}>
                  {planLabel}
                </Badge>
              </div>

              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-3xl sm:text-4xl font-bold bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-transparent">{planPrice}</p>
                  {subscriptionEndDate && userPlan !== "free" && (
                    <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Next billing: {subscriptionEndDate.toLocaleDateString()}
                    </p>
                  )}
                </div>

                {userPlan === "free" ? (
                  <Button onClick={() => navigate("/pricing")} className="gap-1.5 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg shadow-primary/30">
                    <ArrowUpCircle className="w-4 h-4" />
                    Upgrade
                  </Button>
                ) : (
                  <Dialog open={subscriptionDialogOpen} onOpenChange={setSubscriptionDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="bg-white/5 border-white/10 hover:bg-white/10">Manage</Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-slate-900/95 backdrop-blur-2xl border-white/10">
                      {/* Gradient header */}
                      <div className="relative overflow-hidden p-6 pb-5 bg-gradient-to-br from-primary/25 via-primary/10 to-transparent border-b border-white/10">
                        <div className="absolute -top-16 -right-16 w-48 h-48 bg-[radial-gradient(circle,hsl(var(--primary)/0.35),transparent_70%)] pointer-events-none" />
                        <div className="relative flex items-center gap-3">
                          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/30">
                            <CreditCard className="w-5 h-5 text-primary-foreground" />
                          </div>
                          <div>
                            <DialogTitle className="text-lg font-bold">Subscription Details</DialogTitle>
                            <DialogDescription className="text-xs">Manage your plan and billing</DialogDescription>
                          </div>
                        </div>
                      </div>

                      <div className="p-6 space-y-4">
                        {/* Plan summary card */}
                        <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 to-transparent p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Current Plan</p>
                              <p className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">{planLabel}</p>
                              <p className="text-sm text-primary font-semibold mt-0.5">{planPrice}</p>
                            </div>
                            <Badge className={`shrink-0 ${subscriptionStatus === "active" ? "bg-gradient-to-r from-emerald-500/20 to-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-amber-500/15 text-amber-400 border-amber-500/30"}`}>
                              <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${subscriptionStatus === "active" ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
                              {subscriptionStatus.toUpperCase()}
                            </Badge>
                          </div>
                        </div>

                        {/* Billing info */}
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
                            <Calendar className="w-4 h-4 text-primary" />
                          </div>
                          <div className="flex-1">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Next Billing Date</p>
                            <p className="text-sm font-semibold text-foreground">
                              {subscriptionEndDate ? subscriptionEndDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'N/A'}
                            </p>
                          </div>
                        </div>

                        {subscriptionStatus !== "active" && (
                          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3">
                            <p className="text-xs text-amber-200/90 text-center">
                              Your subscription is <strong>{subscriptionStatus}</strong>. Access remains until {subscriptionEndDate ? subscriptionEndDate.toLocaleDateString() : 'the end of your billing period'}.
                            </p>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="space-y-2 pt-2">
                          <Button
                            className="w-full gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg shadow-primary/30"
                            onClick={() => { setSubscriptionDialogOpen(false); navigate("/pricing"); }}
                          >
                            <ArrowUpCircle className="w-4 h-4" />
                            Change Plan
                          </Button>
                          <Button
                            variant="outline"
                            className="w-full border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive hover:border-destructive/60"
                            disabled={cancelling || subscriptionStatus !== "active"}
                            onClick={handleCancelSubscription}
                          >
                            {cancelling
                              ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Cancelling…</>)
                              : subscriptionStatus === "active"
                                ? "Cancel Subscription"
                                : "Subscription Already Cancelled"}
                          </Button>
                          <p className="text-[11px] text-muted-foreground text-center pt-1">
                            Cancelling stops all future PayPal charges immediately and permanently deletes your account.
                          </p>

                        </div>

                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>

              {userPlan === "free" && (
                <div className="mt-4 p-3.5 rounded-2xl bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 backdrop-blur-sm">
                  <p className="text-sm text-foreground">
                    <Sparkles className="w-4 h-4 inline mr-1 text-primary" />
                    <strong>Special Offer:</strong> Free Spring Training access on Signup!
                  </p>
                </div>
              )}

              <div className="mt-3 pt-3 border-t border-white/10">
                <Link to="/help/return-policy" className="text-xs text-muted-foreground hover:text-primary transition-colors">
                  View Return Policy
                </Link>
              </div>
            </div>
          </div>

          {/* Quick Links Grid */}
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-1 h-6 rounded-full bg-gradient-to-b from-primary to-primary/40" />
              <h2 className="text-lg font-semibold text-foreground">Quick Access</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {quickLinks.map((link) => {
                const Icon = link.icon;
                const locked = link.premium && userPlan === "free";
                return (
                  <Link
                    key={link.label}
                    to={locked ? "/pricing" : link.href}
                    className="group relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-xl p-5 hover:border-primary/50 hover:bg-slate-900/80 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/10 transition-all duration-300"
                  >
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.15),transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative flex flex-col items-center text-center gap-2.5">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center group-hover:scale-110 group-hover:from-primary/30 group-hover:to-primary/10 transition-all">
                        <Icon className="w-5 h-5 text-primary" />
                      </div>
                      <span className="text-xs font-semibold text-foreground">{link.label}</span>
                      {locked ? (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/30 text-primary">
                          <Shield className="w-2.5 h-2.5 mr-0.5" />
                          Premium
                        </Badge>
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Notifications & Security */}
          <div className="grid gap-6">
            <div className="rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-2xl shadow-xl overflow-hidden [&>*]:!border-0 [&>*]:!bg-transparent">
              <NotificationPreferencesCard />
            </div>
            <div className="rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-2xl shadow-xl overflow-hidden [&>*]:!border-0 [&>*]:!bg-transparent">
              <PasskeyManager />
            </div>
          </div>

        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Dashboard;
