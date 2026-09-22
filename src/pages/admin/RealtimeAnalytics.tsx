import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, Eye, Radio, MessageSquare, FileText, Globe, Monitor, Smartphone, RefreshCw, TrendingUp, Search, Share2, Link2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import LiveVisitorsMonitor from "@/components/admin/LiveVisitorsMonitor";
import { AdminPage, AdminPageHeader, AdminStatGrid, AdminStat } from "@/components/admin/AdminUI";

interface PresenceData {
  id: string;
  session_id: string;
  current_page: string;
  page_type: string;
  is_authenticated: boolean;
  user_agent: string | null;
  last_seen_at: string;
  referrer_source: string;
}

interface BlogViewStats {
  blog_post_id: string;
  title: string;
  view_count: number;
}

interface TrafficSource {
  source: string;
  count: number;
  label: string;
}

export default function RealtimeAnalytics() {
  const [presenceData, setPresenceData] = useState<PresenceData[]>([]);
  const [blogStats, setBlogStats] = useState<BlogViewStats[]>([]);
  const [trafficSources, setTrafficSources] = useState<TrafficSource[]>([]);
  const [monthlyViewers, setMonthlyViewers] = useState<number>(0);
  const [totalViewers, setTotalViewers] = useState<number>(0);
  const [blogComments, setBlogComments] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchData = async () => {
    setLoading(true);
    try {
      // Clean up stale presence records first
      await supabase.rpc('cleanup_stale_presence');

      // Fetch current presence
      const { data: presence } = await supabase
        .from('realtime_presence')
        .select('*')
        .gte('last_seen_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
        .order('last_seen_at', { ascending: false });

      setPresenceData(presence || []);

      // Fetch blog view stats (last 24 hours)
      const { data: blogViews } = await supabase
        .from('blog_views')
        .select('blog_post_id, blog_posts(title)')
        .gte('viewed_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if (blogViews) {
        const statsMap = new Map<string, { title: string; count: number }>();
        blogViews.forEach((view: any) => {
          const id = view.blog_post_id;
          const title = view.blog_posts?.title || 'Unknown';
          if (statsMap.has(id)) {
            statsMap.get(id)!.count++;
          } else {
            statsMap.set(id, { title, count: 1 });
          }
        });
        setBlogStats(
          Array.from(statsMap.entries())
            .map(([id, data]) => ({ blog_post_id: id, title: data.title, view_count: data.count }))
            .sort((a, b) => b.view_count - a.view_count)
            .slice(0, 10)
        );
      }

      // Calculate traffic sources from presence data
      if (presence) {
        const sourceMap = new Map<string, number>();
        presence.forEach((p: any) => {
          const source = p.referrer_source || 'direct';
          sourceMap.set(source, (sourceMap.get(source) || 0) + 1);
        });
        
        const sourceLabels: Record<string, string> = {
          'direct': 'Direct Traffic',
          'search': 'Search Engines',
          'social': 'Social Media',
          'referral': 'External Links'
        };
        
        setTrafficSources(
          Array.from(sourceMap.entries())
            .map(([source, count]) => ({
              source,
              count,
              label: sourceLabels[source] || source
            }))
            .sort((a, b) => b.count - a.count)
        );
      }

      // Fetch monthly viewers (unique sessions this month)
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      
      const { count: monthlyCount } = await supabase
        .from('realtime_presence')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startOfMonth.toISOString());
      
      setMonthlyViewers(monthlyCount || 0);

      // Fetch total viewers (all time unique sessions)
      const { count: totalCount } = await supabase
        .from('realtime_presence')
        .select('*', { count: 'exact', head: true });
      
      setTotalViewers(totalCount || 0);

      // Fetch blog comments count (last 24 hours)
      const { count: commentsCount } = await supabase
        .from('blog_comments')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      setBlogComments(commentsCount || 0);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Set up real-time subscription for presence updates
    const channel = supabase
      .channel('realtime-presence')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'realtime_presence' },
        () => {
          fetchData();
        }
      )
      .subscribe();

    // Refresh data every 30 seconds
    const interval = setInterval(fetchData, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  const getDeviceIcon = (userAgent: string | null) => {
    if (!userAgent) return <Globe className="h-4 w-4" />;
    if (/Mobile|Android|iPhone|iPad/.test(userAgent)) {
      return <Smartphone className="h-4 w-4" />;
    }
    return <Monitor className="h-4 w-4" />;
  };

  const getPageLabel = (page: string) => {
    if (page === '/') return 'Home';
    if (page.startsWith('/blog/')) return page.replace('/blog/', 'Blog: ');
    if (page.startsWith('/admin')) return 'Admin Panel';
    return page.replace('/', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // Calculate stats by page type
  const onlineUsers = presenceData.length;
  const streamViewers = presenceData.filter(p => p.page_type === 'stream').length;
  const blogViewers = presenceData.filter(p => p.page_type === 'blog').length;
  const authenticatedUsers = presenceData.filter(p => p.is_authenticated).length;

  return (
    <AdminPage>
      <AdminPageHeader
        title="Real-Time Analytics"
        description={`Last updated: ${lastRefresh.toLocaleTimeString()}`}
        actions={
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        }
      />

      <LiveVisitorsMonitor />

      {/* Summary Cards */}
      <AdminStatGrid>
        <AdminStat icon={Users} label="Online Now" value={onlineUsers} tone="success" />
        <AdminStat icon={Radio} label="Watching Streams" value={streamViewers} tone="danger" />
        <AdminStat icon={FileText} label="Reading Blogs" value={blogViewers} tone="default" />
        <AdminStat icon={MessageSquare} label="Comments (24h)" value={blogComments} tone="default" />
      </AdminStatGrid>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Active Users List */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Active Visitors
            </CardTitle>
            <CardDescription className="text-xs">
              Users currently on the site
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              {presenceData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No active visitors
                </p>
              ) : (
                <div className="space-y-2">
                  {presenceData.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                    >
                      <div className="flex items-center gap-2">
                        {getDeviceIcon(user.user_agent)}
                        <div>
                          <p className="text-xs font-medium truncate max-w-[150px]">
                            {getPageLabel(user.current_page)}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(user.last_seen_at).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge variant={user.is_authenticated ? "default" : "secondary"} className="text-[10px]">
                          {user.is_authenticated ? "User" : "Guest"}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          {user.page_type}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Top Content */}
        <div className="space-y-4">
          {/* Top Blog Posts */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Top Blog Posts (24h)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[120px]">
                {blogStats.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    No blog views yet
                  </p>
                ) : (
                  <div className="space-y-2">
                    {blogStats.map((stat, index) => (
                      <div
                        key={stat.blog_post_id}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-muted-foreground">
                            #{index + 1}
                          </span>
                          <span className="text-xs truncate max-w-[200px]">
                            {stat.title}
                          </span>
                        </div>
                        <Badge variant="secondary" className="text-[10px]">
                          {stat.view_count} views
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Traffic Sources */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Share2 className="h-4 w-4" />
                Traffic Sources
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[120px]">
                {trafficSources.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    No traffic data yet
                  </p>
                ) : (
                  <div className="space-y-2">
                    {trafficSources.map((source) => {
                      const getSourceIcon = () => {
                        switch(source.source) {
                          case 'search': return <Search className="h-3 w-3 text-green-500" />;
                          case 'social': return <Share2 className="h-3 w-3 text-blue-500" />;
                          case 'referral': return <Link2 className="h-3 w-3 text-purple-500" />;
                          default: return <Globe className="h-3 w-3 text-gray-500" />;
                        }
                      };
                      return (
                        <div
                          key={source.source}
                          className="flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            {getSourceIcon()}
                            <span className="text-xs">
                              {source.label}
                            </span>
                          </div>
                          <Badge variant="secondary" className="text-[10px]">
                            {source.count} visitors
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Monthly & Total Stats */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Viewer Statistics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-orange-500" />
                    <span className="text-xs font-medium">Monthly Viewers</span>
                  </div>
                  <span className="text-lg font-bold text-orange-500">{monthlyViewers.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-cyan-500" />
                    <span className="text-xs font-medium">Total Viewers (All Time)</span>
                  </div>
                  <span className="text-lg font-bold text-cyan-500">{totalViewers.toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminPage>
  );
}
