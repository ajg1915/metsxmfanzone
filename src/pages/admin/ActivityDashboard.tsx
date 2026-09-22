import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Activity, 
  Shield, 
  Database, 
  Lock, 
  Eye, 
  Download, 
  RefreshCw, 
  Search,
  AlertCircle,
  CheckCircle,
  Clock,
  User,
  Filter
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { fetchDecryptedActivityLogs } from "@/utils/secureDataVault";
import { useToast } from "@/hooks/use-toast";
import { AdminPage, AdminPageHeader, AdminSearch, AdminLoading, AdminStatGrid, AdminStat } from "@/components/admin/AdminUI";

interface ActivityLog {
  id: string;
  user_id: string | null;
  action: string;
  log_type: string;
  resource_type: string | null;
  resource_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  details: Record<string, any> | null;
  created_at: string;
}

const LOG_TYPE_COLORS: Record<string, string> = {
  admin_data_access: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  security: "bg-red-500/20 text-red-400 border-red-500/30",
  auth: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  user_action: "bg-green-500/20 text-green-400 border-green-500/30",
  system: "bg-purple-500/20 text-purple-400 border-purple-500/30",
};

const ACTION_ICONS: Record<string, typeof Activity> = {
  encrypt: Lock,
  decrypt: Eye,
  "fetch-decrypted": Database,
  login: User,
  logout: User,
};

export default function ActivityDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [logTypeFilter, setLogTypeFilter] = useState<string>("all");
  const [stats, setStats] = useState({
    totalLogs: 0,
    adminAccesses: 0,
    securityEvents: 0,
    recentActivity: 0,
  });

  const fetchLogs = async (showToast = false) => {
    try {
      setRefreshing(true);
      
      // Fetch decrypted logs using secure vault
      const decryptedLogs = await fetchDecryptedActivityLogs(200, 0);
      setLogs(decryptedLogs);
      
      // Calculate stats
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      
      setStats({
        totalLogs: decryptedLogs.length,
        adminAccesses: decryptedLogs.filter((l: ActivityLog) => l.log_type === "admin_data_access").length,
        securityEvents: decryptedLogs.filter((l: ActivityLog) => l.log_type === "security").length,
        recentActivity: decryptedLogs.filter((l: ActivityLog) => new Date(l.created_at) > oneHourAgo).length,
      });
      
      if (showToast) {
        toast({
          title: "Logs refreshed",
          description: `Loaded ${decryptedLogs.length} activity logs`,
        });
      }
    } catch (error) {
      console.error("Error fetching logs:", error);
      toast({
        title: "Error",
        description: "Failed to fetch activity logs",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchLogs();
  }, []);

  // Real-time subscription for new logs
  useEffect(() => {
    const channel = supabase
      .channel("activity-logs-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "activity_logs",
        },
        async () => {
          // Refresh logs when new entry is added
          await fetchLogs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      searchQuery === "" ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.log_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.resource_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.ip_address?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = logTypeFilter === "all" || log.log_type === logTypeFilter;

    return matchesSearch && matchesType;
  });

  const uniqueLogTypes = [...new Set(logs.map((l) => l.log_type))];

  const exportLogs = () => {
    const csvContent = [
      ["ID", "Timestamp", "Type", "Action", "Resource", "IP Address", "User Agent", "Details"].join(","),
      ...filteredLogs.map((log) =>
        [
          log.id,
          log.created_at,
          log.log_type,
          log.action,
          log.resource_type || "",
          log.ip_address || "",
          `"${(log.user_agent || "").replace(/"/g, '""')}"`,
          `"${JSON.stringify(log.details || {}).replace(/"/g, '""')}"`,
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `activity-logs-${format(new Date(), "yyyy-MM-dd-HHmmss")}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Export complete",
      description: `Exported ${filteredLogs.length} logs to CSV`,
    });
  };

  if (loading) {
    return <AdminLoading label="Loading activity logs…" />;
  }

  return (
    <AdminPage>
      <AdminPageHeader
        icon={Activity}
        title="Activity Dashboard"
        description="Real-time admin activity monitoring"
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchLogs(true)}
              disabled={refreshing}
              className="h-8 text-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={exportLogs} className="h-8 text-xs">
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Export
            </Button>
          </>
        }
      />

      {/* Stats Cards */}
      <AdminStatGrid>
        <AdminStat icon={Database} label="Total Logs" value={stats.totalLogs} />
        <AdminStat icon={Shield} label="Admin Access" value={stats.adminAccesses} tone="warning" />
        <AdminStat icon={AlertCircle} label="Security Events" value={stats.securityEvents} tone="danger" />
        <AdminStat icon={Clock} label="Last Hour" value={stats.recentActivity} tone="success" />
      </AdminStatGrid>

      {/* Filters */}
      <Card className="border-border/30">
        <CardContent className="p-2.5">
          <div className="flex flex-col sm:flex-row gap-2">
            <AdminSearch value={searchQuery} onChange={setSearchQuery} placeholder="Search logs..." />
            <Select value={logTypeFilter} onValueChange={setLogTypeFilter}>
              <SelectTrigger className="w-full sm:w-[180px] h-9">
                <Filter className="h-3.5 w-3.5 mr-2" />
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {uniqueLogTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Activity Logs ({filteredLogs.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader>
                <TableRow className="text-xs">
                  <TableHead className="w-[140px]">Time</TableHead>
                  <TableHead className="w-[120px]">Type</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead className="hidden md:table-cell">Resource</TableHead>
                  <TableHead className="hidden lg:table-cell">IP Address</TableHead>
                  <TableHead className="hidden xl:table-cell">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No activity logs found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map((log) => {
                    const ActionIcon = ACTION_ICONS[log.action] || Activity;
                    return (
                      <TableRow key={log.id} className="text-xs">
                        <TableCell className="font-mono">
                          <div className="flex flex-col">
                            <span>{format(new Date(log.created_at), "MMM d, HH:mm:ss")}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${LOG_TYPE_COLORS[log.log_type] || "bg-gray-500/20 text-gray-400"}`}
                          >
                            {log.log_type.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <ActionIcon className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="font-medium">{log.action}</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {log.resource_type ? (
                            <Badge variant="secondary" className="text-[10px]">
                              {log.resource_type}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell font-mono text-muted-foreground">
                          {log.ip_address || "-"}
                        </TableCell>
                        <TableCell className="hidden xl:table-cell max-w-[200px] truncate">
                          {log.details ? (
                            <span className="text-muted-foreground" title={JSON.stringify(log.details)}>
                              {log.details.record_count
                                ? `${log.details.record_count} records`
                                : JSON.stringify(log.details).slice(0, 50)}
                            </span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Real-time indicator */}
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
        <span>Real-time monitoring active</span>
      </div>
    </AdminPage>
  );
}
