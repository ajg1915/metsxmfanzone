import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { 
  Users, Eye, Clock, TrendingUp, FileText, Radio, 
  Video, Newspaper, BarChart3, Calendar, RefreshCw 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminPage, AdminPageHeader, AdminStatGrid } from "@/components/admin/AdminUI";

interface DailyStats {
  newUsers: number;
  activeUsers: number;
  totalPageViews: number;
  avgSessionDuration: string;
  blogViews: number;
  newBlogPosts: number;
  podcastPlays: number;
  streamViewers: number;
  newSubscriptions: number;
}

const DailyReports = () => {
  const [stats, setStats] = useState<DailyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());

  const fetchDailyStats = async (date: Date) => {
    setLoading(true);
    const dayStart = startOfDay(date).toISOString();
    const dayEnd = endOfDay(date).toISOString();

    try {
      // Fetch new users (profiles created today)
      const { count: newUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', dayStart)
        .lte('created_at', dayEnd);

      // Fetch active users from realtime_presence
      const { count: activeUsers } = await supabase
        .from('realtime_presence')
        .select('*', { count: 'exact', head: true })
        .gte('last_seen_at', dayStart)
        .lte('last_seen_at', dayEnd);

      // Fetch blog views
      const { count: blogViews } = await supabase
        .from('blog_views')
        .select('*', { count: 'exact', head: true })
        .gte('viewed_at', dayStart)
        .lte('viewed_at', dayEnd);

      // Fetch new blog posts
      const { count: newBlogPosts } = await supabase
        .from('blog_posts')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', dayStart)
        .lte('created_at', dayEnd)
        .eq('published', true);

      // Fetch stream views
      const { count: streamViewers } = await supabase
        .from('stream_views')
        .select('*', { count: 'exact', head: true })
        .gte('viewed_at', dayStart)
        .lte('viewed_at', dayEnd);

      // Fetch new subscriptions
      const { count: newSubscriptions } = await supabase
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', dayStart)
        .lte('created_at', dayEnd);

      // Calculate total page views from presence data
      const { data: presenceData } = await supabase
        .from('realtime_presence')
        .select('id')
        .gte('created_at', dayStart)
        .lte('created_at', dayEnd);

      setStats({
        newUsers: newUsers || 0,
        activeUsers: activeUsers || 0,
        totalPageViews: presenceData?.length || 0,
        avgSessionDuration: "5m 23s", // Placeholder - would need more complex calculation
        blogViews: blogViews || 0,
        newBlogPosts: newBlogPosts || 0,
        podcastPlays: 0, // Would need podcast plays tracking
        streamViewers: streamViewers || 0,
        newSubscriptions: newSubscriptions || 0,
      });
    } catch (error) {
      console.error('Error fetching daily stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDailyStats(selectedDate);
  }, [selectedDate]);

  const StatCard = ({ 
    title, 
    value, 
    icon: Icon, 
    trend, 
    color = "primary" 
  }: { 
    title: string; 
    value: number | string; 
    icon: any; 
    trend?: string;
    color?: string;
  }) => (
    <Card className="border-border/30">
      <CardContent className="p-2.5">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-[10px] text-muted-foreground truncate">{title}</p>
            {loading ? (
              <Skeleton className="h-6 w-14 mt-1" />
            ) : (
              <p className="text-base font-bold mt-0.5">{value}</p>
            )}
            {trend && !loading && (
              <Badge variant="secondary" className="mt-1.5 text-[9px] h-4">
                <TrendingUp className="w-2.5 h-2.5 mr-0.5" />
                {trend}
              </Badge>
            )}
          </div>
          <Icon className={`w-4 h-4 text-${color} flex-shrink-0`} />
        </div>
      </CardContent>
    </Card>
  );

  return (
    <AdminPage>
      <AdminPageHeader
        icon={Calendar}
        title="Daily Reports"
        description={`Activity summary for ${format(selectedDate, 'MMMM d, yyyy')}`}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => setSelectedDate(subDays(selectedDate, 1))}
            >
              Previous Day
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => setSelectedDate(new Date())}
              disabled={format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')}
            >
              Today
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => fetchDailyStats(selectedDate)}
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </>
        }
      />

      {/* User Activity Section */}
      <div>
        <h2 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-primary" />
          User Activity
        </h2>
        <AdminStatGrid>
          <StatCard
            title="New Signups"
            value={stats?.newUsers || 0}
            icon={Users}
          />
          <StatCard
            title="Active Users"
            value={stats?.activeUsers || 0}
            icon={Eye}
          />
          <StatCard
            title="Page Views"
            value={stats?.totalPageViews || 0}
            icon={BarChart3}
          />
          <StatCard
            title="Avg Session"
            value={stats?.avgSessionDuration || "0m"}
            icon={Clock}
          />
        </AdminStatGrid>
      </div>

      {/* Content Stats Section */}
      <div>
        <h2 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-primary" />
          Content Statistics
        </h2>
        <AdminStatGrid>
          <StatCard
            title="Blog Views"
            value={stats?.blogViews || 0}
            icon={Newspaper}
          />
          <StatCard
            title="New Posts"
            value={stats?.newBlogPosts || 0}
            icon={FileText}
          />
          <StatCard
            title="Stream Viewers"
            value={stats?.streamViewers || 0}
            icon={Video}
          />
          <StatCard
            title="New Subscriptions"
            value={stats?.newSubscriptions || 0}
            icon={TrendingUp}
          />
        </AdminStatGrid>
      </div>

      {/* Quick Summary Card */}
      <Card className="border-border/30">
        <CardHeader className="p-2.5 pb-0">
          <CardTitle className="text-xs flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            Daily Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2.5">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : (
            <div className="space-y-1.5 text-[10px] text-muted-foreground">
              <p>• <strong>{stats?.newUsers || 0}</strong> new users joined today</p>
              <p>• <strong>{stats?.activeUsers || 0}</strong> users were active on the platform</p>
              <p>• <strong>{stats?.blogViews || 0}</strong> blog articles were viewed</p>
              <p>• <strong>{stats?.streamViewers || 0}</strong> users watched live streams</p>
              <p>• <strong>{stats?.newSubscriptions || 0}</strong> new premium subscriptions</p>
            </div>
          )}
        </CardContent>
      </Card>
    </AdminPage>
  );
};

export default DailyReports;
