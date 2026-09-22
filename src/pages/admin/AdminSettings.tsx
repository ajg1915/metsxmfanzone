import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Settings, 
  Palette, 
  ToggleLeft, 
  AlertTriangle, 
  Save, 
  Loader2,
  Globe,
  Mail,
  Phone,
  Facebook,
  Twitter,
  Instagram,
  Youtube,
  Newspaper,
  Radio,
  Users,
  BookOpen,
  Film,
  ShoppingBag,
  Tv,
  Eye
} from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AdminPage, AdminPageHeader, AdminLoading } from "@/components/admin/AdminUI";

interface SiteBranding {
  site_name: string;
  tagline: string;
  contact_email: string;
  contact_phone: string;
  facebook_url: string;
  twitter_url: string;
  instagram_url: string;
  youtube_url: string;
}

interface FeatureToggles {
  newsletter_enabled: boolean;
  live_streams_enabled: boolean;
  community_enabled: boolean;
  podcast_enabled: boolean;
  blog_enabled: boolean;
  stories_enabled: boolean;
  merch_enabled: boolean;
}

interface MaintenanceMode {
  enabled: boolean;
  message: string;
}

export default function AdminSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [branding, setBranding] = useState<SiteBranding>({
    site_name: "MetsXM Fan Zone",
    tagline: "Your Ultimate Mets Fan Community",
    contact_email: "",
    contact_phone: "",
    facebook_url: "",
    twitter_url: "",
    instagram_url: "",
    youtube_url: ""
  });

  const [features, setFeatures] = useState<FeatureToggles>({
    newsletter_enabled: true,
    live_streams_enabled: true,
    community_enabled: true,
    podcast_enabled: true,
    blog_enabled: true,
    stories_enabled: true,
    merch_enabled: true
  });

  const [maintenance, setMaintenance] = useState<MaintenanceMode>({
    enabled: false,
    message: "We are currently performing scheduled maintenance. Please check back soon!"
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('site_settings')
        .select('*');

      if (error) throw error;

      data?.forEach((setting) => {
        const value = setting.setting_value as Record<string, unknown>;
        switch (setting.setting_key) {
          case 'site_branding':
            setBranding(value as unknown as SiteBranding);
            break;
          case 'feature_toggles':
            setFeatures(value as unknown as FeatureToggles);
            break;
          case 'maintenance_mode':
            setMaintenance(value as unknown as MaintenanceMode);
            break;
        }
      });
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const saveSetting = async (key: string, value: SiteBranding | FeatureToggles | MaintenanceMode) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('site_settings')
        .update({ setting_value: value as unknown as Record<string, never> })
        .eq('setting_key', key);

      if (error) throw error;
      toast.success('Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBranding = () => saveSetting('site_branding', branding);
  const handleSaveFeatures = () => saveSetting('feature_toggles', features);
  const [sendingEmails, setSendingEmails] = useState(false);

  const handleSaveMaintenance = async () => {
    await saveSetting('maintenance_mode', maintenance);
    
    // If maintenance is being enabled, send notification emails AND push notifications
    if (maintenance.enabled) {
      setSendingEmails(true);
      try {
        // Send email notifications and push notifications in parallel
        const [emailResult, pushResult] = await Promise.all([
          supabase.functions.invoke('send-maintenance-notification', {
            body: { message: maintenance.message },
          }),
          supabase.functions.invoke('send-push-notification', {
            body: {
              title: '🔧 MetsXMFanZone Under Maintenance',
              body: maintenance.message || "We're currently performing scheduled maintenance. We'll be back online Monday morning at 6am ET!",
              icon: '/logo-192.png',
              url: '/',
              tag: 'maintenance-alert',
            },
          }),
        ]);
        
        if (emailResult.error) throw emailResult.error;
        
        const emailsSent = emailResult.data?.sent || 0;
        const pushSent = pushResult.data?.successful || 0;
        toast.success(`Maintenance alerts sent: ${emailsSent} emails, ${pushSent} push notifications`);
      } catch (error: any) {
        console.error('Error sending maintenance notifications:', error);
        toast.error('Maintenance saved but failed to send some notifications');
      } finally {
        setSendingEmails(false);
      }
    }
  };

  if (loading) {
    return <AdminLoading label="Loading settings…" />;
  }

  return (
    <AdminPage>
      <AdminPageHeader
        icon={Settings}
        title="Site Settings"
        description="Configure your website settings"
      />

      <Tabs defaultValue="branding" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 h-auto p-1 bg-muted/50 backdrop-blur-sm rounded-lg">
          <TabsTrigger value="branding" className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm py-2">
            <Palette className="h-4 w-4" />
            <span className="hidden sm:inline">Branding</span>
          </TabsTrigger>
          <TabsTrigger value="features" className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm py-2">
            <ToggleLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Features</span>
          </TabsTrigger>
          <TabsTrigger value="maintenance" className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm py-2">
            <AlertTriangle className="h-4 w-4" />
            <span className="hidden sm:inline">Maintenance</span>
          </TabsTrigger>
        </TabsList>

        {/* Branding Tab */}
        <TabsContent value="branding" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Globe className="h-5 w-5 text-primary" />
                Site Information
              </CardTitle>
              <CardDescription>Basic information about your website</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="site_name">Site Name</Label>
                  <Input
                    id="site_name"
                    value={branding.site_name}
                    onChange={(e) => setBranding({ ...branding, site_name: e.target.value })}
                    placeholder="Your Site Name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tagline">Tagline</Label>
                  <Input
                    id="tagline"
                    value={branding.tagline}
                    onChange={(e) => setBranding({ ...branding, tagline: e.target.value })}
                    placeholder="Your site tagline"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Mail className="h-5 w-5 text-primary" />
                Contact Information
              </CardTitle>
              <CardDescription>How visitors can reach you</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="contact_email" className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    Email
                  </Label>
                  <Input
                    id="contact_email"
                    type="email"
                    value={branding.contact_email}
                    onChange={(e) => setBranding({ ...branding, contact_email: e.target.value })}
                    placeholder="contact@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact_phone" className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    Phone
                  </Label>
                  <Input
                    id="contact_phone"
                    value={branding.contact_phone}
                    onChange={(e) => setBranding({ ...branding, contact_phone: e.target.value })}
                    placeholder="+1 (555) 000-0000"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Globe className="h-5 w-5 text-primary" />
                Social Media Links
              </CardTitle>
              <CardDescription>Connect your social media profiles</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="facebook" className="flex items-center gap-2">
                    <Facebook className="h-4 w-4 text-blue-600" />
                    Facebook
                  </Label>
                  <Input
                    id="facebook"
                    value={branding.facebook_url}
                    onChange={(e) => setBranding({ ...branding, facebook_url: e.target.value })}
                    placeholder="https://facebook.com/yourpage"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="twitter" className="flex items-center gap-2">
                    <Twitter className="h-4 w-4 text-sky-500" />
                    Twitter/X
                  </Label>
                  <Input
                    id="twitter"
                    value={branding.twitter_url}
                    onChange={(e) => setBranding({ ...branding, twitter_url: e.target.value })}
                    placeholder="https://twitter.com/yourhandle"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="instagram" className="flex items-center gap-2">
                    <Instagram className="h-4 w-4 text-pink-500" />
                    Instagram
                  </Label>
                  <Input
                    id="instagram"
                    value={branding.instagram_url}
                    onChange={(e) => setBranding({ ...branding, instagram_url: e.target.value })}
                    placeholder="https://instagram.com/yourhandle"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="youtube" className="flex items-center gap-2">
                    <Youtube className="h-4 w-4 text-red-600" />
                    YouTube
                  </Label>
                  <Input
                    id="youtube"
                    value={branding.youtube_url}
                    onChange={(e) => setBranding({ ...branding, youtube_url: e.target.value })}
                    placeholder="https://youtube.com/yourchannel"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSaveBranding} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Branding
            </Button>
          </div>
        </TabsContent>

        {/* Features Tab */}
        <TabsContent value="features" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <ToggleLeft className="h-5 w-5 text-primary" />
                Feature Toggles
              </CardTitle>
              <CardDescription>Enable or disable website features</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              <FeatureToggleItem
                icon={<Newspaper className="h-4 w-4" />}
                label="Newsletter"
                description="Allow users to subscribe to newsletters"
                checked={features.newsletter_enabled}
                onCheckedChange={(checked) => setFeatures({ ...features, newsletter_enabled: checked })}
              />
              <Separator />
              <FeatureToggleItem
                icon={<Tv className="h-4 w-4" />}
                label="Live Streams"
                description="Enable live streaming functionality"
                checked={features.live_streams_enabled}
                onCheckedChange={(checked) => setFeatures({ ...features, live_streams_enabled: checked })}
              />
              <Separator />
              <FeatureToggleItem
                icon={<Users className="h-4 w-4" />}
                label="Community"
                description="Enable community features and discussions"
                checked={features.community_enabled}
                onCheckedChange={(checked) => setFeatures({ ...features, community_enabled: checked })}
              />
              <Separator />
              <FeatureToggleItem
                icon={<Radio className="h-4 w-4" />}
                label="Podcast"
                description="Show podcast section on the website"
                checked={features.podcast_enabled}
                onCheckedChange={(checked) => setFeatures({ ...features, podcast_enabled: checked })}
              />
              <Separator />
              <FeatureToggleItem
                icon={<BookOpen className="h-4 w-4" />}
                label="Blog"
                description="Enable blog posts and articles"
                checked={features.blog_enabled}
                onCheckedChange={(checked) => setFeatures({ ...features, blog_enabled: checked })}
              />
              <Separator />
              <FeatureToggleItem
                icon={<Film className="h-4 w-4" />}
                label="Stories"
                description="Enable story feature for quick updates"
                checked={features.stories_enabled}
                onCheckedChange={(checked) => setFeatures({ ...features, stories_enabled: checked })}
              />
              <Separator />
              <FeatureToggleItem
                icon={<ShoppingBag className="h-4 w-4" />}
                label="Merchandise"
                description="Enable merch store and shopping"
                checked={features.merch_enabled}
                onCheckedChange={(checked) => setFeatures({ ...features, merch_enabled: checked })}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSaveFeatures} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Features
            </Button>
          </div>
        </TabsContent>

        {/* Maintenance Tab */}
        <TabsContent value="maintenance" className="space-y-4">
          <Card className={maintenance.enabled ? "border-destructive/50 bg-destructive/5" : ""}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <AlertTriangle className={`h-5 w-5 ${maintenance.enabled ? "text-destructive" : "text-primary"}`} />
                    Maintenance Mode
                  </CardTitle>
                  <CardDescription>
                    When enabled, visitors will see a maintenance message instead of the website
                  </CardDescription>
                </div>
                <Badge variant={maintenance.enabled ? "destructive" : "secondary"}>
                  {maintenance.enabled ? "Active" : "Inactive"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div className="space-y-0.5">
                  <Label htmlFor="maintenance_toggle" className="font-medium">
                    Enable Maintenance Mode
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    This will immediately show a maintenance page to all visitors
                  </p>
                </div>
                <Switch
                  id="maintenance_toggle"
                  checked={maintenance.enabled}
                  onCheckedChange={(checked) => setMaintenance({ ...maintenance, enabled: checked })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="maintenance_message">Maintenance Message</Label>
                <Textarea
                  id="maintenance_message"
                  value={maintenance.message}
                  onChange={(e) => setMaintenance({ ...maintenance, message: e.target.value })}
                  placeholder="Enter the message visitors will see..."
                  rows={4}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  This message will be displayed to visitors when maintenance mode is active
                </p>
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div className="space-y-0.5">
                  <Label className="font-medium">Preview Maintenance Page</Label>
                  <p className="text-sm text-muted-foreground">
                    See how the maintenance page looks with your custom message
                  </p>
                </div>
                <Button asChild variant="outline" size="sm" className="gap-2">
                  <Link to="/maintenance-preview" target="_blank">
                    <Eye className="h-4 w-4" />
                    Preview
                  </Link>
                </Button>
              </div>

              {maintenance.enabled && (
                <div className="p-4 rounded-lg border border-destructive/50 bg-destructive/10">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-medium text-destructive">Warning: Site is in Maintenance Mode</p>
                      <p className="text-sm text-muted-foreground">
                        All visitors will see the maintenance page. Only logged-in admins can access the site normally.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSaveMaintenance} disabled={saving || sendingEmails} className="gap-2">
              {(saving || sendingEmails) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {sendingEmails ? "Sending Emails..." : "Save Maintenance Settings"}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </AdminPage>
  );
}

interface FeatureToggleItemProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

function FeatureToggleItem({ icon, label, description, checked, onCheckedChange }: FeatureToggleItemProps) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-muted">
          {icon}
        </div>
        <div className="space-y-0.5">
          <Label className="font-medium cursor-pointer">{label}</Label>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
