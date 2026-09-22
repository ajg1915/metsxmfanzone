import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus, Radio } from "lucide-react";
import { AdminPage, AdminPageHeader, AdminList, AdminListCard, AdminRow, AdminIconButton, AdminEmpty, AdminLoading } from "@/components/admin/AdminUI";

interface Notification {
  id: string;
  message: string;
  link_url: string;
  is_active: boolean;
}

const LiveNotificationManagement = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [linkUrl, setLinkUrl] = useState("/mlb-network");
  const [isActive, setIsActive] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from("live_notifications")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!message.trim()) {
      toast({
        title: "Error",
        description: "Message is required",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("live_notifications")
        .insert({
          message,
          link_url: linkUrl,
          is_active: isActive,
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Notification created successfully",
      });

      setMessage("");
      setLinkUrl("/mlb-network");
      setIsActive(false);
      fetchNotifications();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const toggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("live_notifications")
        .update({ is_active: !currentStatus })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Notification status updated",
      });

      fetchNotifications();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const deleteNotification = async (id: string) => {
    if (!confirm("Are you sure you want to delete this notification?")) return;

    try {
      const { error } = await supabase
        .from("live_notifications")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Notification deleted successfully",
      });

      fetchNotifications();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <AdminLoading label="Loading notifications…" />;
  }

  return (
    <AdminPage>
      <AdminPageHeader
        icon={Radio}
        title="Live Notifications"
        count={notifications.length}
        description="Manage live notifications shown site-wide"
      />

      <Card className="border-border/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Create New Notification</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="message">Message</Label>
              <Input
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="🔴 LIVE NOW: Watch exclusive Mets coverage..."
                required
              />
            </div>

            <div>
              <Label htmlFor="link_url">Link URL</Label>
              <Input
                id="link_url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="/mlb-network"
                required
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
              <Label htmlFor="is_active">Active (show on site)</Label>
            </div>

            <Button type="submit">
              <Plus className="w-4 h-4 mr-2" />
              Create Notification
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-1.5">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Existing Notifications</h3>
        {notifications.length === 0 ? (
          <AdminEmpty message="No notifications yet. Create one above." />
        ) : (
          <AdminList>
            {notifications.map((notification) => (
              <AdminListCard key={notification.id} highlight={notification.is_active}>
                <AdminRow
                  title={notification.message}
                  meta={notification.link_url}
                  actions={
                    <>
                      <div className="flex items-center gap-1 mr-1">
                        <Switch
                          checked={notification.is_active}
                          onCheckedChange={() =>
                            toggleActive(notification.id, notification.is_active)
                          }
                        />
                        <span className="text-[10px] text-muted-foreground">
                          {notification.is_active ? "On" : "Off"}
                        </span>
                      </div>
                      <AdminIconButton
                        icon={Trash2}
                        title="Delete"
                        tone="danger"
                        onClick={() => deleteNotification(notification.id)}
                      />
                    </>
                  }
                />
              </AdminListCard>
            ))}
          </AdminList>
        )}
      </div>
    </AdminPage>
  );
};

export default LiveNotificationManagement;
