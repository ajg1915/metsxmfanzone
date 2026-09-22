import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, CheckCircle, Radio, RefreshCw, Bell, BellOff, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import StreamSourceStatusPanel from "@/components/admin/StreamSourceStatusPanel";
import { AdminPage, AdminPageHeader, AdminStatGrid, AdminStat } from "@/components/admin/AdminUI";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface HealthReport {
  id: string;
  stream_id: string;
  issue_type: string;
  severity: string;
  description: string;
  user_agent: string;
  session_id: string;
  resolved: boolean;
  resolved_at: string | null;
  created_at: string;
  live_streams?: { title: string };
}

interface StreamAlert {
  id: string;
  stream_id: string;
  message: string;
  is_active: boolean;
  created_at: string;
  live_streams?: { title: string };
}

export default function StreamHealthDashboard() {
  const { toast } = useToast();
  const [reports, setReports] = useState<HealthReport[]>([]);
  const [alerts, setAlerts] = useState<StreamAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAlertDialog, setShowAlertDialog] = useState(false);
  const [selectedStreamId, setSelectedStreamId] = useState<string | null>(null);
  const [customAlertMessage, setCustomAlertMessage] = useState("");
  const [streams, setStreams] = useState<{ id: string; title: string }[]>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch recent health reports
      const { data: reportsData, error: reportsError } = await supabase
        .from('stream_health_reports')
        .select('*, live_streams(title)')
        .order('created_at', { ascending: false })
        .limit(50);

      if (reportsError) throw reportsError;
      setReports(reportsData || []);

      // Fetch active alerts
      const { data: alertsData, error: alertsError } = await supabase
        .from('stream_alerts')
        .select('*, live_streams(title)')
        .order('created_at', { ascending: false })
        .limit(20);

      if (alertsError) throw alertsError;
      setAlerts(alertsData || []);

      // Fetch active streams for alert creation
      const { data: streamsData } = await supabase
        .from('live_streams')
        .select('id, title')
        .eq('status', 'live')
        .eq('published', true);

      setStreams(streamsData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to load stream health data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Subscribe to realtime updates
    const reportsChannel = supabase
      .channel('stream-health-admin')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'stream_health_reports' },
        () => fetchData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'stream_alerts' },
        () => fetchData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(reportsChannel);
    };
  }, []);

  const resolveReport = async (reportId: string) => {
    try {
      const { error } = await supabase
        .from('stream_health_reports')
        .update({ resolved: true, resolved_at: new Date().toISOString() })
        .eq('id', reportId);

      if (error) throw error;
      
      toast({ title: "Report marked as resolved" });
      fetchData();
    } catch (error) {
      console.error('Error resolving report:', error);
      toast({ title: "Error", description: "Failed to resolve report", variant: "destructive" });
    }
  };

  const toggleAlert = async (alertId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('stream_alerts')
        .update({ is_active: !currentStatus, updated_at: new Date().toISOString() })
        .eq('id', alertId);

      if (error) throw error;
      
      toast({ title: currentStatus ? "Alert deactivated" : "Alert activated" });
      fetchData();
    } catch (error) {
      console.error('Error toggling alert:', error);
      toast({ title: "Error", description: "Failed to update alert", variant: "destructive" });
    }
  };

  const createAlert = async () => {
    if (!selectedStreamId || !customAlertMessage.trim()) return;

    try {
      const { error } = await supabase
        .from('stream_alerts')
        .insert({
          stream_id: selectedStreamId,
          message: customAlertMessage.trim(),
          is_active: true
        });

      if (error) throw error;
      
      toast({ title: "Alert sent to viewers" });
      setShowAlertDialog(false);
      setCustomAlertMessage("");
      setSelectedStreamId(null);
      fetchData();
    } catch (error) {
      console.error('Error creating alert:', error);
      toast({ title: "Error", description: "Failed to create alert", variant: "destructive" });
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'secondary';
    }
  };

  const getIssueIcon = (issueType: string) => {
    switch (issueType) {
      case 'buffering':
      case 'lag':
        return '⏳';
      case 'audio':
        return '🔇';
      case 'video':
        return '📺';
      case 'connection':
        return '🔌';
      default:
        return '⚠️';
    }
  };

  // Calculate summary stats
  const activeAlertsCount = alerts.filter(a => a.is_active).length;
  const totalIssuesDetected = reports.length;
  const issuesByType = reports.reduce((acc, r) => {
    acc[r.issue_type] = (acc[r.issue_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <AdminPage>
      <AdminPageHeader
        icon={Radio}
        title="Stream Health Monitor"
        description="Automatic stream issue detection & viewer alerts"
        actions={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" className="h-8 text-xs" onClick={() => setShowAlertDialog(true)}>
            <Bell className="h-3.5 w-3.5 mr-1" />
            Send Alert
          </Button>
        </div>
        }
      />

      {/* Live feed (primary/backup) health */}
      <div className="mb-4">
        <StreamSourceStatusPanel />
      </div>

      {/* Summary Cards */}

      <AdminStatGrid>
        <AdminStat icon={Bell} label="Active Alerts" value={activeAlertsCount} tone="default" />
        <AdminStat icon={AlertTriangle} label="Issues Detected" value={totalIssuesDetected} tone="warning" />
        <AdminStat label="Buffering/Lag" value={(issuesByType['buffering'] || 0) + (issuesByType['lag'] || 0)} />
        <AdminStat label="Audio/Video" value={(issuesByType['audio'] || 0) + (issuesByType['video'] || 0)} />
      </AdminStatGrid>

      {/* Detection Status Card */}
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            Automatic Detection & Alerts Active
          </CardTitle>
          <CardDescription className="text-xs">
            The system automatically detects stream issues, selects the affected stream, generates an appropriate alert message, and sends it to viewers instantly.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-muted-foreground">Monitoring all active streams</span>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>• High severity issues trigger immediate alerts</p>
              <p>• Multiple reports of the same issue auto-send alerts</p>
              <p>• Alerts auto-deactivate when stream stabilizes</p>
            </div>
          </div>
        </CardContent>
      </Card>

        {/* Active Alerts */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Viewer Alerts
            </CardTitle>
            <CardDescription className="text-xs">
              Messages shown to stream viewers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              {alerts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No alerts
                </p>
              ) : (
                <div className="space-y-2">
                  {alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={`p-3 rounded-lg border ${alert.is_active ? 'bg-destructive/10 border-destructive/30' : 'bg-muted/30 opacity-60'}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant={alert.is_active ? "destructive" : "secondary"} className="text-[10px]">
                              {alert.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                          <p className="text-xs font-medium truncate">
                            {alert.live_streams?.title || 'Unknown Stream'}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {alert.message}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {new Date(alert.created_at).toLocaleString()}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => toggleAlert(alert.id, alert.is_active)}
                        >
                          {alert.is_active ? (
                            <BellOff className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Bell className="h-4 w-4 text-green-500" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

      {/* Send Alert Dialog */}
      <Dialog open={showAlertDialog} onOpenChange={setShowAlertDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Alert to Viewers</DialogTitle>
            <DialogDescription>
              Send a notification to all viewers watching the selected stream.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Select Stream</label>
              <select
                className="w-full mt-1 p-2 border rounded-md bg-background"
                value={selectedStreamId || ''}
                onChange={(e) => setSelectedStreamId(e.target.value)}
              >
                <option value="">Choose a stream...</option>
                {streams.map((stream) => (
                  <option key={stream.id} value={stream.id}>
                    {stream.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Alert Message</label>
              <Textarea
                className="mt-1"
                placeholder="We're experiencing technical difficulties..."
                value={customAlertMessage}
                onChange={(e) => setCustomAlertMessage(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAlertDialog(false)}>
              Cancel
            </Button>
            <Button onClick={createAlert} disabled={!selectedStreamId || !customAlertMessage.trim()}>
              <Send className="h-4 w-4 mr-2" />
              Send Alert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPage>
  );
}