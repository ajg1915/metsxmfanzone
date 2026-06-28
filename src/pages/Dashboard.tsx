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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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
      "Are you sure you want to cancel your subscription? You'll keep access until the end of your current billing period."
    );
    if (!confirmed) return;
    setCancelling(true);
    try {
      const { data, error } = await supabase.functions.invoke("cancel-subscription", { body: {} });
      if (error || (data as any)?.error) {
        throw new Error((data as any)?.error || error?.message || "Failed to cancel");
      }
      toast({
        title: "Subscription Cancelled",
        description: "You'll continue to have access until the end of your billing period.",
      });
      setSubscriptionStatus("cancelled");
      setSubscriptionDialogOpen(false);
    } catch (e: any) {
      toast({
        title: "Cancellation failed",
        description: e?.message || "Please try again or contact support.",
        variant: "destructive",
      });
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
    { label: "Blog", icon: BookOpen, href: "/blog", premium: true },
    { label: "Podcast", icon: Mic, href: "/podcast", premium: true },
  ];

  return (
    <div className="min-h-screen bg-background">
      <OnboardingWalkthrough onComplete={() => {}} />
      <Navigation />
      <main className="pt-12">
        <div className="container mx-auto px-4 max-w-5xl py-8 space-y-6">

          {/* Hero Profile Section */}
          <div className="relative overflow-hidden rounded-2xl border border-border/40 bg-gradient-to-br from-[hsl(var(--mets-blue-dark))] via-card to-card p-4 sm:p-8">
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary)/0.15),transparent_70%)] pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-[radial-gradient(ellipse_at_bottom_left,hsl(var(--secondary)/0.1),transparent_70%)] pointer-events-none" />

            <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-5">
              {/* Avatar */}
              <div className="relative group">
                <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-primary to-secondary opacity-70 blur-sm group-hover:opacity-100 transition-opacity" />
                <Avatar className="relative h-16 w-16 sm:h-24 sm:w-24 ring-2 ring-background">
                  <AvatarImage src={avatarUrl} alt="Profile avatar" />
                  <AvatarFallback className="bg-primary/20 text-primary text-2xl font-bold">
                    {fullName ? fullName.charAt(0).toUpperCase() : user.email?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </div>

              {/* User Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-lg sm:text-2xl font-bold text-foreground truncate">
                    {fullName || "MetsXMFanZone Member"}
                  </h1>
                  {userPlan !== "free" && (
                    <Badge className="bg-primary/20 text-primary border-primary/30 shrink-0">
                      <Star className="w-3 h-3 mr-1" />
                      {planLabel}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    Joined {new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {memberDays} days
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 shrink-0">
                <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1.5">
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
            <div className="relative grid grid-cols-3 gap-3 mt-6 pt-6 border-t border-border/30">
              <div className="text-center">
                <p className="text-2xl sm:text-3xl font-bold text-primary">{postCount}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">Posts</p>
              </div>
              <div className="text-center">
                <p className="text-2xl sm:text-3xl font-bold text-primary">{memberDays}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">Days Active</p>
              </div>
              <div className="text-center">
                <p className="text-xl sm:text-3xl font-bold text-primary">{planLabel}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">Plan</p>
              </div>
            </div>
          </div>

          {/* Subscription Card */}
          <div className="rounded-2xl border border-border/40 bg-card p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">Subscription</h2>
              </div>
              <Badge variant={userPlan === "free" ? "secondary" : "default"} className="text-xs">
                {planLabel}
              </Badge>
            </div>

            <div className="flex items-end justify-between">
              <div>
                <p className="text-3xl font-bold text-foreground">{planPrice}</p>
                {subscriptionEndDate && userPlan !== "free" && (
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Next billing: {subscriptionEndDate.toLocaleDateString()}
                  </p>
                )}
              </div>

              {userPlan === "free" ? (
                <Button onClick={() => navigate("/pricing")} className="gap-1.5">
                  <ArrowUpCircle className="w-4 h-4" />
                  Upgrade
                </Button>
              ) : (
                <Dialog open={subscriptionDialogOpen} onOpenChange={setSubscriptionDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">Manage</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Subscription Details</DialogTitle>
                      <DialogDescription>Manage your subscription and billing</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Current Plan</Label>
                        <div className="flex items-center gap-2">
                          <Badge variant="default">{planLabel.toUpperCase()}</Badge>
                          <span className="text-foreground font-semibold">{planPrice}</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Status</Label>
                        <Badge variant={subscriptionStatus === "active" ? "default" : "secondary"}>{subscriptionStatus.toUpperCase()}</Badge>
                      </div>
                      <div className="space-y-2">
                        <Label>Next Billing Date</Label>
                        <p className="text-foreground">{subscriptionEndDate ? subscriptionEndDate.toLocaleDateString() : 'N/A'}</p>
                      </div>
                      <div className="pt-4 space-y-2">
                        <Button className="w-full" onClick={() => { setSubscriptionDialogOpen(false); navigate("/pricing"); }}>Change Plan</Button>
                        {subscriptionStatus === "active" && (
                          <Button
                            variant="destructive"
                            className="w-full"
                            disabled={cancelling}
                            onClick={handleCancelSubscription}
                          >
                            {cancelling ? (<><Loader2 className="w-4 h-4 animate-spin" /> Cancelling…</>) : "Cancel Subscription"}
                          </Button>
                        )}
                        {subscriptionStatus !== "active" && (
                          <p className="text-xs text-muted-foreground text-center">
                            Your subscription is {subscriptionStatus}. Access remains until {subscriptionEndDate ? subscriptionEndDate.toLocaleDateString() : 'the end of your billing period'}.
                          </p>
                        )}
                        <Button variant="outline" className="w-full" onClick={() => setSubscriptionDialogOpen(false)}>Close</Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            {userPlan === "free" && (
              <div className="mt-4 p-3 rounded-xl bg-primary/5 border border-primary/20">
                <p className="text-sm text-foreground">
                  <Sparkles className="w-4 h-4 inline mr-1 text-primary" />
                  <strong>Special Offer:</strong> Free Spring Training access on Signup!
                </p>
              </div>
            )}

            <div className="mt-3 pt-3 border-t border-border/20">
              <Link to="/help/return-policy" className="text-xs text-muted-foreground hover:text-primary transition-colors">
                View Return Policy
              </Link>
            </div>
          </div>

          {/* Quick Links Grid */}
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-3">Quick Access</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {quickLinks.map((link) => {
                const Icon = link.icon;
                const locked = link.premium && userPlan === "free";
                return (
                  <Link
                    key={link.label}
                    to={locked ? "/pricing" : link.href}
                    className="group relative rounded-xl border border-border/40 bg-card p-4 hover:border-primary/50 hover:bg-card/80 transition-all"
                  >
                    <div className="flex flex-col items-center text-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                        <Icon className="w-5 h-5 text-primary" />
                      </div>
                      <span className="text-xs font-medium text-foreground">{link.label}</span>
                      {locked && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          <Shield className="w-2.5 h-2.5 mr-0.5" />
                          Premium
                        </Badge>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Notifications & Security */}
          <NotificationPreferencesCard />
          <PasskeyManager />

        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Dashboard;
