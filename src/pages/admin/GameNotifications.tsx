import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, Send, Radio, Users, Clock, AlertCircle, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

interface NotificationLog {
  id: string;
  title: string;
  body: string;
  sent_at: string;
  successful: number;
  failed: number;
  total: number;
}

interface LiveStream {
  id: string;
  title: string;
  status: string;
  scheduled_start: string | null;
}

const GameNotifications = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [subscriberCount, setSubscriberCount] = useState(0);
  const [liveStreams, setLiveStreams] = useState<LiveStream[]>([]);
  const [notificationLogs, setNotificationLogs] = useState<NotificationLog[]>([]);
  
  const [title, setTitle] = useState("🔴 Mets Game Going Live!");
  const [body, setBody] = useState("The Mets game is about to start! Tune in now to watch live.");
  const [selectedStream, setSelectedStream] = useState<string>("");
  const [customUrl, setCustomUrl] = useState("/metsxmfanzone");

  useEffect(() => {
    fetchSubscriberCount();
    fetchLiveStreams();
    fetchNotificationLogs();
  }, []);

  const fetchSubscriberCount = async () => {
    try {
      const { count, error } = await supabase
        .from("notification_subscriptions")
        .select("*", { count: "exact", head: true });
      
      if (error) throw error;
      setSubscriberCount(count || 0);
    } catch (error) {
      console.error("Error fetching subscriber count:", error);
    }
  };

  const fetchLiveStreams = async () => {
    try {
      const { data, error } = await supabase
        .from("live_streams")
        .select("id, title, status, scheduled_start")
        .eq("published", true)
        .order("scheduled_start", { ascending: true })
        .limit(10);
      
      if (error) throw error;
      setLiveStreams(data || []);
    } catch (error) {
      console.error("Error fetching live streams:", error);
    }
  };

  const fetchNotificationLogs = async () => {
    const logs = localStorage.getItem("game_notification_logs");
    if (logs) {
      setNotificationLogs(JSON.parse(logs));
    }
  };

  const handleStreamSelect = (streamId: string) => {
    setSelectedStream(streamId);
    const stream = liveStreams.find(s => s.id === streamId);
    if (stream) {
      setTitle(`🔴 ${stream.title} - Going Live!`);
      setBody(`${stream.title} is about to start! Tune in now to watch live on MetsXMFanZone.`);
    }
  };

  const sendNotification = async () => {
    if (!title || !body) {
      toast({
        title: "Missing Fields",
        description: "Please enter a title and message.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        toast({
          title: "Auth Required",
          description: "Please log in as admin.",
          variant: "destructive",
        });
        return;
      }

      const response = await supabase.functions.invoke("send-push-notification", {
        body: { title, body, url: customUrl, icon: "/logo-192.png", tag: "game-live-notification" },
      });

      if (response.error) throw new Error(response.error.message);

      // Also send email notifications alongside push
      try {
        await supabase.functions.invoke("send-game-notification-email", {
          body: { title, message: body, notificationType: "game_alert", url: customUrl },
        });
      } catch (emailErr) {
        console.error("Email send failed (push still sent):", emailErr);
      }

      const result = response.data;
      const newLog: NotificationLog = {
        id: crypto.randomUUID(),
        title,
        body,
        sent_at: new Date().toISOString(),
        successful: result.successful || 0,
        failed: result.failed || 0,
        total: result.total || 0,
      };

      const updatedLogs = [newLog, ...notificationLogs].slice(0, 20);
      setNotificationLogs(updatedLogs);
      localStorage.setItem("game_notification_logs", JSON.stringify(updatedLogs));

      toast({
        title: "Sent!",
        description: `Sent to ${result.successful || 0}/${result.total || 0} subscribers.`,
      });

      setTitle("🔴 Mets Game Going Live!");
      setBody("The Mets game is about to start! Tune in now to watch live.");
      setSelectedStream("");
    } catch (error) {
      console.error("Error sending notification:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const quickTemplates = [
    { title: "🔴 Mets Game Starting!", body: "The Mets are taking the field!", url: "/metsxmfanzone" },
    { title: "⚾ Spring Training Live", body: "Spring Training is about to begin!", url: "/spring-training-live" },
    { title: "🎙️ Podcast Going Live", body: "Join us for a live discussion!", url: "/community-podcast" },
    { title: "📺 MLB Network", body: "Tune in for MLB Network coverage!", url: "/mlb-network" },
  ];

  return (
    <div className="space-y-3 max-w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-1.5 truncate">
            <Bell className="w-4 h-4 sm:w-5 sm:h-5 text-primary flex-shrink-0" />
            Game Notifications
          </h1>
          <p className="text-muted-foreground text-xs mt-0.5 truncate">
            Send push notifications when games go live
          </p>
        </div>
        <Badge variant="secondary" className="flex items-center gap-1 px-2 py-1 text-xs w-fit flex-shrink-0">
          <Users className="w-3 h-3" />
          {subscriberCount} subs
        </Badge>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {/* Composer */}
        <Card className="border-border/30">
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Send className="w-4 h-4" />
              Compose
            </CardTitle>
            <CardDescription className="text-xs">
              Create and send push notifications
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 pt-0 space-y-3">
            {/* Quick Templates */}
            <div className="space-y-1.5">
              <Label className="text-xs">Quick Templates</Label>
              <div className="grid grid-cols-2 gap-1.5">
                {quickTemplates.map((t, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    size="sm"
                    className="text-[10px] sm:text-xs h-7 px-2 justify-start truncate"
                    onClick={() => { setTitle(t.title); setBody(t.body); setCustomUrl(t.url); }}
                  >
                    {t.title.slice(0, 20)}...
                  </Button>
                ))}
              </div>
            </div>

            {/* Stream Select */}
            <div className="space-y-1">
              <Label className="text-xs">Link to Stream</Label>
              <Select value={selectedStream} onValueChange={handleStreamSelect}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select stream..." />
                </SelectTrigger>
                <SelectContent>
                  {liveStreams.map((s) => (
                    <SelectItem key={s.id} value={s.id} className="text-xs">
                      <div className="flex items-center gap-1.5">
                        {s.status === "live" && <Radio className="w-2.5 h-2.5 text-red-500 animate-pulse" />}
                        <span className="truncate">{s.title}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Title */}
            <div className="space-y-1">
              <Label className="text-xs">Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Notification title..."
                maxLength={60}
                className="h-8 text-xs"
              />
              <p className="text-[10px] text-muted-foreground">{title.length}/60</p>
            </div>

            {/* Body */}
            <div className="space-y-1">
              <Label className="text-xs">Message</Label>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Message..."
                rows={2}
                maxLength={200}
                className="text-xs min-h-[60px] resize-none"
              />
              <p className="text-[10px] text-muted-foreground">{body.length}/200</p>
            </div>

            {/* URL */}
            <div className="space-y-1">
              <Label className="text-xs">Click URL</Label>
              <Input
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder="/metsxmfanzone"
                className="h-8 text-xs"
              />
            </div>

            {/* Preview */}
            <div className="rounded-md bg-muted/50 p-2 space-y-1">
              <p className="text-[10px] font-medium text-muted-foreground">Preview</p>
              <div className="flex gap-2 items-start">
                <img src="/logo-192.png" alt="Icon" className="w-8 h-8 rounded-md flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-xs truncate">{title || "Title"}</p>
                  <p className="text-[10px] text-muted-foreground line-clamp-2">{body || "Message..."}</p>
                </div>
              </div>
            </div>

            {/* Send */}
            <Button onClick={sendNotification} disabled={loading || subscriberCount === 0} className="w-full h-8 text-xs">
              {loading ? (
                <><Radio className="w-3 h-3 mr-1.5 animate-pulse" />Sending...</>
              ) : (
                <><Send className="w-3 h-3 mr-1.5" />Send to {subscriberCount}</>
              )}
            </Button>

            {subscriberCount === 0 && (
              <p className="flex items-center gap-1 text-[10px] text-amber-500">
                <AlertCircle className="w-3 h-3" />No subscribers yet
              </p>
            )}
          </CardContent>
        </Card>

        {/* Recent */}
        <Card className="border-border/30">
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              Recent
            </CardTitle>
            <CardDescription className="text-xs">Sent notifications</CardDescription>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            {notificationLogs.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-xs">No notifications sent</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] sm:max-h-[400px] overflow-y-auto">
                {notificationLogs.map((log) => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-md border border-border/50 p-2 space-y-1"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-xs truncate">{log.title}</p>
                        <p className="text-[10px] text-muted-foreground line-clamp-1">{log.body}</p>
                      </div>
                      <Badge variant={log.successful > 0 ? "default" : "destructive"} className="text-[10px] px-1.5 py-0.5 flex-shrink-0">
                        {log.successful > 0 ? <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" /> : <AlertCircle className="w-2.5 h-2.5 mr-0.5" />}
                        {log.successful}/{log.total}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{new Date(log.sent_at).toLocaleString()}</p>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tips */}
      <Card className="border-border/30">
        <CardHeader className="p-3 pb-2">
          <CardTitle className="text-sm">📋 Tips</CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <ul className="grid gap-1 text-[10px] sm:text-xs text-muted-foreground sm:grid-cols-2">
            <li className="flex items-start gap-1"><span className="text-primary">•</span>Use emojis to grab attention</li>
            <li className="flex items-start gap-1"><span className="text-primary">•</span>Keep titles under 50 chars</li>
            <li className="flex items-start gap-1"><span className="text-primary">•</span>Send 5-10 min before games</li>
            <li className="flex items-start gap-1"><span className="text-primary">•</span>Don't overuse notifications</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default GameNotifications;
