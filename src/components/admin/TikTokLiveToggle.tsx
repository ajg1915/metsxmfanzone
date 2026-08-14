import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTikTokLive } from "@/hooks/useTikTokLive";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Radio, Bell } from "lucide-react";

export const TikTokLiveToggle = () => {
  const { status, loading } = useTikTokLive();
  const [username, setUsername] = useState("");
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (status) {
      setUsername(status.tiktok_username || "");
      setTitle(status.stream_title || "");
    }
  }, [status]);

  const updateStatus = async (isLive: boolean) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("tiktok_live_status")
        .update({
          is_live: isLive,
          tiktok_username: username.trim() || "metsxmfanzone",
          stream_title: title.trim() || null,
          went_live_at: isLive ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", 1);

      if (error) throw error;

      if (isLive) {
        // Fire push notification to all subscribers
        const handle = (username.trim() || "metsxmfanzone").replace(/^@/, "");
        const url = `https://www.tiktok.com/@${handle}/live`;
        try {
          await supabase.functions.invoke("send-push-notification", {
            body: {
              title: "🔴 LIVE NOW on TikTok",
              body: title.trim() || `@${handle} just went live — tap to watch!`,
              icon: "/logo-192.png",
              url,
              tag: "tiktok-live",
            },
          });
        } catch (pushErr) {
          console.error("Push notification failed:", pushErr);
        }
        toast.success("You're live! Banner shown + push sent.");
      } else {
        toast.success("Live status cleared.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to update live status");
    } finally {
      setSaving(false);
    }
  };

  const saveDetails = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("tiktok_live_status")
        .update({
          tiktok_username: username.trim() || "metsxmfanzone",
          stream_title: title.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", 1);
      if (error) throw error;
      toast.success("Details saved");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="min-w-0 max-w-full overflow-hidden border-red-500/30">
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="flex flex-wrap items-center gap-2">
          <Radio className="w-5 h-5 text-red-500" />
          TikTok Live
          {status?.is_live && (
            <span className="ml-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/15 text-red-500 text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              LIVE
            </span>
          )}
        </CardTitle>
        <CardDescription>
          Toggle on when you start streaming on TikTok. Shows a live banner on the Radio Network page and sends push notifications to all members.
        </CardDescription>
      </CardHeader>
      <CardContent className="min-w-0 space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
        <div className="space-y-2">
          <Label htmlFor="tt-username">TikTok Username</Label>
          <Input
            id="tt-username"
            placeholder="metsxmfanzone"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={saving || loading}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tt-title">Stream Title (optional)</Label>
          <Input
            id="tt-title"
            placeholder="Mets vs. Braves Live Reactions"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={saving || loading}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-3 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Switch
              checked={!!status?.is_live}
              onCheckedChange={updateStatus}
              disabled={saving || loading}
            />
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {status?.is_live ? "Currently Live" : "Not Live"}
              </p>
              <p className="flex min-w-0 items-start gap-1 text-xs leading-tight text-muted-foreground">
                <Bell className="mt-0.5 h-3 w-3 shrink-0" />
                Toggling on sends a push notification
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={saveDetails}
            disabled={saving || loading}
            className="w-full sm:w-auto"
          >
            Save Details
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
