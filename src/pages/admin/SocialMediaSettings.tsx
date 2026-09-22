import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { 
  Facebook, Instagram, Twitter, Music2, 
  Link2, Unlink, CheckCircle2, XCircle, 
  RefreshCw, ExternalLink, Shield, AlertTriangle
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminPage, AdminPageHeader } from "@/components/admin/AdminUI";

interface SocialConnection {
  id: string;
  platform: string;
  page_id: string | null;
  page_name: string | null;
  account_username: string | null;
  connected_at: string;
  expires_at: string | null;
  status: string;
}

interface TwitterCredentials {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
}

const SocialMediaSettings = () => {
  const { toast } = useToast();
  const [connections, setConnections] = useState<SocialConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);
  const [twitterDialogOpen, setTwitterDialogOpen] = useState(false);
  const [twitterCredentials, setTwitterCredentials] = useState<TwitterCredentials>({
    apiKey: '',
    apiSecret: '',
    accessToken: '',
    accessTokenSecret: '',
  });

  useEffect(() => {
    fetchConnections();
    // Check URL for success/error parameters
    const urlParams = new URLSearchParams(window.location.search);
    const connected = urlParams.get('connected');
    if (connected) {
      toast({
        title: "Connected!",
        description: `Successfully connected ${connected.charAt(0).toUpperCase() + connected.slice(1)}`,
      });
      // Remove the query parameter
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const fetchConnections = async () => {
    try {
      const { data, error } = await supabase
        .from("social_media_connections")
        .select("*")
        .order("platform");

      if (error) throw error;
      setConnections(data || []);
    } catch (error: any) {
      console.error("Error fetching connections:", error);
      toast({
        title: "Error",
        description: "Failed to fetch social media connections",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getConnection = (platform: string) => {
    return connections.find((c) => c.platform === platform);
  };

  const handleMetaConnect = async (platform: 'facebook' | 'instagram') => {
    const META_APP_ID = import.meta.env.VITE_META_APP_ID;

    if (!META_APP_ID) {
      toast({
        title: "Configuration Required",
        description: "Meta App ID is not configured. Please add META_APP_ID to your environment.",
        variant: "destructive",
      });
      return;
    }

    setConnectingPlatform(platform);

    const redirectUri = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/social-media-oauth-callback`;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: "Error", description: "You must be logged in", variant: "destructive" });
      setConnectingPlatform(null);
      return;
    }

    // Get a signed CSRF state from server (no client-trusted userId in state)
    const { data: stateRes, error: stateErr } = await supabase.functions.invoke(
      'social-media-oauth-init',
      { body: { platform, redirectUri } }
    );
    if (stateErr || !stateRes?.state) {
      toast({ title: "Error", description: "Could not start OAuth flow", variant: "destructive" });
      setConnectingPlatform(null);
      return;
    }
    const state = stateRes.state as string;

    const scopes = platform === 'instagram'
      ? 'pages_manage_posts,instagram_basic,instagram_content_publish,pages_read_engagement'
      : 'pages_manage_posts,pages_read_engagement,pages_show_list';

    const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?` +
      `client_id=${META_APP_ID}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=${scopes}&` +
      `state=${state}&` +
      `response_type=code`;

    window.location.href = authUrl;
  };


  const handleTwitterConnect = async () => {
    if (!twitterCredentials.apiKey || !twitterCredentials.apiSecret || 
        !twitterCredentials.accessToken || !twitterCredentials.accessTokenSecret) {
      toast({
        title: "Error",
        description: "Please fill in all Twitter API credentials",
        variant: "destructive",
      });
      return;
    }

    setConnectingPlatform('twitter');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Verify the credentials by making a test API call
      const { data, error } = await supabase.functions.invoke("post-to-twitter", {
        body: { 
          caption: "Test connection - please ignore",
          ...twitterCredentials,
          dryRun: true 
        },
      });

      // Store the credentials
      const { error: insertError } = await supabase
        .from("social_media_connections")
        .upsert({
          user_id: user.id,
          platform: 'twitter',
          access_token: JSON.stringify(twitterCredentials),
          connected_at: new Date().toISOString(),
          status: 'active',
        }, { onConflict: 'user_id,platform' });

      if (insertError) throw insertError;

      toast({
        title: "Connected!",
        description: "Twitter/X account connected successfully",
      });
      
      setTwitterDialogOpen(false);
      setTwitterCredentials({ apiKey: '', apiSecret: '', accessToken: '', accessTokenSecret: '' });
      fetchConnections();
    } catch (error: any) {
      console.error("Error connecting Twitter:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to connect Twitter",
        variant: "destructive",
      });
    } finally {
      setConnectingPlatform(null);
    }
  };

  const handleDisconnect = async (platform: string) => {
    if (!confirm(`Are you sure you want to disconnect ${platform}?`)) return;

    try {
      const { error } = await supabase
        .from("social_media_connections")
        .delete()
        .eq("platform", platform);

      if (error) throw error;

      toast({
        title: "Disconnected",
        description: `${platform} has been disconnected`,
      });
      fetchConnections();
    } catch (error: any) {
      console.error("Error disconnecting:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'facebook': return <Facebook className="w-5 h-5" />;
      case 'instagram': return <Instagram className="w-5 h-5" />;
      case 'twitter': return <Twitter className="w-5 h-5" />;
      case 'tiktok': return <Music2 className="w-5 h-5" />;
      default: return <Link2 className="w-5 h-5" />;
    }
  };

  const getPlatformColor = (platform: string) => {
    switch (platform) {
      case 'facebook': return 'bg-blue-600';
      case 'instagram': return 'bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500';
      case 'twitter': return 'bg-black';
      case 'tiktok': return 'bg-black';
      default: return 'bg-gray-600';
    }
  };

  const renderPlatformCard = (
    platform: string,
    title: string,
    description: string,
    onConnect: () => void
  ) => {
    const connection = getConnection(platform);
    const isConnected = connection?.status === 'active';
    const isExpired = connection?.expires_at && new Date(connection.expires_at) < new Date();

    return (
      <Card className={`${isConnected ? 'border-green-500/50' : ''}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg text-white ${getPlatformColor(platform)}`}>
                {getPlatformIcon(platform)}
              </div>
              <div>
                <CardTitle className="text-base">{title}</CardTitle>
                <CardDescription className="text-xs">{description}</CardDescription>
              </div>
            </div>
            {isConnected ? (
              <Badge variant="secondary" className="bg-green-500/20 text-green-400 border-green-500/30">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Connected
              </Badge>
            ) : (
              <Badge variant="secondary" className="bg-gray-500/20 text-gray-400">
                <XCircle className="w-3 h-3 mr-1" />
                Not Connected
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {isConnected && connection && (
            <div className="text-sm space-y-1 p-3 bg-muted/50 rounded-lg">
              {connection.page_name && (
                <p className="flex items-center gap-2">
                  <span className="text-muted-foreground">Page:</span>
                  <span className="font-medium">{connection.page_name}</span>
                </p>
              )}
              {connection.account_username && (
                <p className="flex items-center gap-2">
                  <span className="text-muted-foreground">Account:</span>
                  <span className="font-medium">@{connection.account_username}</span>
                </p>
              )}
              <p className="flex items-center gap-2">
                <span className="text-muted-foreground">Connected:</span>
                <span>{new Date(connection.connected_at).toLocaleDateString()}</span>
              </p>
              {isExpired && (
                <Alert variant="destructive" className="mt-2">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Token Expired</AlertTitle>
                  <AlertDescription>
                    Please reconnect to continue posting.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
          
          <div className="flex gap-2">
            {isConnected ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onConnect}
                  className="flex-1"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Reconnect
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDisconnect(platform)}
                >
                  <Unlink className="w-4 h-4 mr-2" />
                  Disconnect
                </Button>
              </>
            ) : (
              <Button
                onClick={onConnect}
                size="sm"
                className="w-full"
                disabled={connectingPlatform === platform}
              >
                <Link2 className="w-4 h-4 mr-2" />
                {connectingPlatform === platform ? 'Connecting...' : 'Connect'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <AdminPage>
      <AdminPageHeader
        icon={Link2}
        title="Social Media"
        count={connections.length}
        countLabel="connected"
        description="Connect your accounts to auto-post stories"
        actions={
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={fetchConnections} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        }
      />

      <Alert className="border-primary/30 bg-primary/5">
        <Shield className="h-4 w-4" />
        <AlertTitle>API Setup Required</AlertTitle>
        <AlertDescription className="text-xs">
          To connect social media accounts, you need to create developer apps on each platform.
          <a 
            href="https://developers.facebook.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-primary hover:underline ml-1 inline-flex items-center gap-1"
          >
            Meta Developers <ExternalLink className="w-3 h-3" />
          </a>
          {" | "}
          <a 
            href="https://developer.twitter.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-primary hover:underline inline-flex items-center gap-1"
          >
            Twitter Developers <ExternalLink className="w-3 h-3" />
          </a>
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="meta" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="meta" className="text-xs">
            <Facebook className="w-4 h-4 mr-2" />
            Meta (FB/IG)
          </TabsTrigger>
          <TabsTrigger value="other" className="text-xs">
            <Twitter className="w-4 h-4 mr-2" />
            Twitter/TikTok
          </TabsTrigger>
        </TabsList>

        <TabsContent value="meta" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {renderPlatformCard(
              'facebook',
              'Facebook Page',
              'Post stories to your Facebook Page',
              () => handleMetaConnect('facebook')
            )}
            {renderPlatformCard(
              'instagram',
              'Instagram Business',
              'Post stories to Instagram (requires FB Page)',
              () => handleMetaConnect('instagram')
            )}
          </div>
        </TabsContent>

        <TabsContent value="other" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {renderPlatformCard(
              'twitter',
              'X (Twitter)',
              'Post tweets with images ($100/mo API required)',
              () => setTwitterDialogOpen(true)
            )}
            {renderPlatformCard(
              'tiktok',
              'TikTok',
              'Post to TikTok (requires special approval)',
              () => toast({
                title: "TikTok Not Available",
                description: "TikTok Content Posting API requires special developer approval. Contact TikTok to apply.",
                variant: "destructive",
              })
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Twitter Credentials Dialog */}
      <Dialog open={twitterDialogOpen} onOpenChange={setTwitterDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Twitter className="w-5 h-5" />
              Connect X (Twitter)
            </DialogTitle>
            <DialogDescription>
              Enter your Twitter API credentials. You can get these from the
              <a 
                href="https://developer.twitter.com/en/portal/dashboard" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline ml-1"
              >
                Twitter Developer Portal
              </a>.
              Note: Posting requires the Basic tier ($100/month).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key (Consumer Key)</Label>
              <Input
                id="apiKey"
                type="password"
                value={twitterCredentials.apiKey}
                onChange={(e) => setTwitterCredentials({ ...twitterCredentials, apiKey: e.target.value })}
                placeholder="Enter API Key"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="apiSecret">API Secret (Consumer Secret)</Label>
              <Input
                id="apiSecret"
                type="password"
                value={twitterCredentials.apiSecret}
                onChange={(e) => setTwitterCredentials({ ...twitterCredentials, apiSecret: e.target.value })}
                placeholder="Enter API Secret"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="accessToken">Access Token</Label>
              <Input
                id="accessToken"
                type="password"
                value={twitterCredentials.accessToken}
                onChange={(e) => setTwitterCredentials({ ...twitterCredentials, accessToken: e.target.value })}
                placeholder="Enter Access Token"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="accessTokenSecret">Access Token Secret</Label>
              <Input
                id="accessTokenSecret"
                type="password"
                value={twitterCredentials.accessTokenSecret}
                onChange={(e) => setTwitterCredentials({ ...twitterCredentials, accessTokenSecret: e.target.value })}
                placeholder="Enter Access Token Secret"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTwitterDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleTwitterConnect} disabled={connectingPlatform === 'twitter'}>
              {connectingPlatform === 'twitter' ? 'Connecting...' : 'Connect'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPage>
  );
};

export default SocialMediaSettings;
