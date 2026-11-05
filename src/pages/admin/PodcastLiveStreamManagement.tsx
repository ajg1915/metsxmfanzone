import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Radio, Copy, ExternalLink, Video, Mic, RefreshCw } from "lucide-react";
import RadioBroadcaster from "@/components/admin/RadioBroadcaster";

interface PodcastLiveStream {
  id: string;
  title: string;
  description: string | null;
  vdo_ninja_url: string | null;
  is_live: boolean;
}

const PodcastLiveStreamManagement = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stream, setStream] = useState<PodcastLiveStream | null>(null);
  const [roomId, setRoomId] = useState("");

  useEffect(() => {
    fetchStream();
    // Generate a random room ID if none exists
    setRoomId(generateRoomId());
  }, []);

  const generateRoomId = () => {
    return `metsxm-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
  };

  const fetchStream = async () => {
    try {
      const { data, error } = await supabase
        .from("podcast_live_stream")
        .select("*")
        .single();

      if (error) throw error;
      setStream(data);
      
      // Extract room ID from existing URL if present
      if (data?.vdo_ninja_url) {
        const match = data.vdo_ninja_url.match(/view=([^&]+)/);
        if (match) {
          setRoomId(match[1]);
        }
      }
    } catch (error) {
      console.error("Error fetching stream:", error);
      toast({
        title: "Error",
        description: "Failed to load podcast stream settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!stream) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("podcast_live_stream")
        .update({
          title: stream.title,
          description: stream.description,
          vdo_ninja_url: stream.vdo_ninja_url,
          is_live: stream.is_live,
        })
        .eq("id", stream.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Podcast stream settings updated successfully",
      });
    } catch (error) {
      console.error("Error saving stream:", error);
      toast({
        title: "Error",
        description: "Failed to save podcast stream settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const generateBroadcastLink = () => {
    const newRoomId = generateRoomId();
    setRoomId(newRoomId);
    
    // VDO.Ninja push URL (for broadcasting from phone)
    const pushUrl = `https://vdo.ninja/?push=${newRoomId}&webcam&quality=2`;
    // VDO.Ninja view URL (for viewers) - with autostart and cleanoutput for embed
    const viewUrl = `https://vdo.ninja/?view=${newRoomId}&autostart&cleanoutput`;
    
    setStream(prev => prev ? { ...prev, vdo_ninja_url: viewUrl } : null);
    
    toast({
      title: "Broadcast Link Generated",
      description: "Open the broadcast link on your phone to start streaming",
    });
    
    return { pushUrl, viewUrl };
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard`,
    });
  };

  const openBroadcastLink = () => {
    const pushUrl = `https://vdo.ninja/?push=${roomId}&webcam&quality=2`;
    window.open(pushUrl, "_blank");
  };

  const goLive = async () => {
    if (!stream || !stream.vdo_ninja_url) return;
    
    setSaving(true);
    try {
      // Ensure the URL has autostart & cleanoutput for embedding
      let viewUrl = stream.vdo_ninja_url;
      if (!viewUrl.includes('autostart')) {
        viewUrl = viewUrl.includes('?') ? `${viewUrl}&autostart` : `${viewUrl}?autostart`;
      }
      if (!viewUrl.includes('cleanoutput')) {
        viewUrl = `${viewUrl}&cleanoutput`;
      }
      
      const { error } = await supabase
        .from("podcast_live_stream")
        .update({
          vdo_ninja_url: viewUrl,
          is_live: true,
        })
        .eq("id", stream.id);

      if (error) throw error;

      setStream(prev => prev ? { ...prev, vdo_ninja_url: viewUrl, is_live: true } : null);
      
      toast({
        title: "🔴 You're Live!",
        description: "Your podcast is now streaming!",
      });
    } catch (error) {
      console.error("Error going live:", error);
      toast({
        title: "Error",
        description: "Failed to go live",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const endStream = async () => {
    if (!stream) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from("podcast_live_stream")
        .update({
          is_live: false,
        })
        .eq("id", stream.id);

      if (error) throw error;

      setStream(prev => prev ? { ...prev, is_live: false } : null);
      
      toast({
        title: "Stream Ended",
        description: "Your podcast stream has been stopped",
      });
    } catch (error) {
      console.error("Error ending stream:", error);
      toast({
        title: "Error",
        description: "Failed to end stream",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!stream) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">No stream configuration found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const pushUrl = `https://vdo.ninja/?push=${roomId}&webcam&quality=2`;
  const viewUrl = `https://vdo.ninja/?view=${roomId}&autostart&cleanoutput`;

  return (
    <div className="max-w-full px-2 py-3 space-y-4 overflow-x-hidden">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg sm:text-xl font-bold">Podcast Live Stream</h1>
          <p className="text-xs text-muted-foreground">Go live from your phone</p>
        </div>
        {stream.is_live && (
          <Badge variant="destructive" className="animate-pulse">
            <Radio className="w-3 h-3 mr-1" />
            LIVE
          </Badge>
        )}
      </div>

      {/* Go live from this device (microphone, no VDO.Ninja) */}
      <RadioBroadcaster />

      {/* Quick Go Live Section (VDO.Ninja, kept as a fallback) */}
      <Card className="border-primary/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <Video className="w-4 h-4 text-primary" />
            Quick Start
          </CardTitle>
          <CardDescription className="text-xs">
            Paste your VDO.Ninja view link and go live
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-3">
          {/* Step 1: Paste VDO.Ninja URL */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">1</span>
              <Label className="text-xs font-medium">Paste Your VDO.Ninja View Link</Label>
            </div>
            <Input 
              value={stream.vdo_ninja_url || ""} 
              onChange={(e) => setStream({ ...stream, vdo_ninja_url: e.target.value })}
              placeholder="https://vdo.ninja/?view=YOUR_ROOM_ID"
              className="h-9 text-xs font-mono"
            />
            <p className="text-[10px] text-muted-foreground">
              💡 Get this from VDO.Ninja after you start broadcasting. It's the "view" link, not "push".
            </p>
          </div>

          {/* Step 2: Go Live */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">2</span>
              <Label className="text-xs font-medium">Go Live!</Label>
            </div>
            {stream.is_live ? (
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={endStream} 
                disabled={saving}
                className="w-full h-10"
              >
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Radio className="w-4 h-4 mr-2" />}
                End Stream
              </Button>
            ) : (
              <Button 
                size="sm" 
                onClick={goLive} 
                disabled={saving || !stream.vdo_ninja_url}
                className="w-full h-10 bg-red-600 hover:bg-red-700"
              >
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Radio className="w-4 h-4 mr-2" />}
                Go Live
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stream Settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <Mic className="w-3.5 h-3.5" />
            Stream Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 px-3">
          <div className="space-y-1">
            <Label className="text-xs">Stream Title</Label>
            <Input
              value={stream.title}
              onChange={(e) => setStream({ ...stream, title: e.target.value })}
              className="h-8 text-xs"
              placeholder="MetsXMFanZone Live Podcast"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Description</Label>
            <Textarea
              value={stream.description || ""}
              onChange={(e) => setStream({ ...stream, description: e.target.value })}
              className="text-xs min-h-[60px]"
              placeholder="What's today's show about?"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">VDO.Ninja Viewer URL</Label>
            <Input
              value={stream.vdo_ninja_url || ""}
              onChange={(e) => setStream({ ...stream, vdo_ninja_url: e.target.value })}
              className="h-8 text-xs font-mono"
              placeholder="https://vdo.ninja/?view=your-room-id"
            />
          </div>

          <div className="flex items-center justify-between p-2 border rounded-lg">
            <div>
              <Label className="text-xs">Live Status</Label>
              <p className="text-[10px] text-muted-foreground">Show on Podcast page</p>
            </div>
            <Switch
              checked={stream.is_live}
              onCheckedChange={(checked) => setStream({ ...stream, is_live: checked })}
            />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchStream} disabled={saving} className="h-8 text-xs">
              Reset
            </Button>
            <Button onClick={handleSave} disabled={saving} size="sm" className="h-8 text-xs">
              {saving && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}
              Save Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      {stream.is_live && stream.vdo_ninja_url && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Live Preview</CardTitle>
          </CardHeader>
          <CardContent className="px-3">
            <div className="aspect-video bg-black rounded-lg overflow-hidden">
              <iframe
                src={stream.vdo_ninja_url}
                className="w-full h-full"
                allow="camera; microphone; autoplay; fullscreen"
                allowFullScreen
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PodcastLiveStreamManagement;
