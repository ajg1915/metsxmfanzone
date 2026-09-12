import { useEffect, useState } from "react";
import { ArrowLeft, Sparkles, Wrench, Bug, Rocket, Calendar, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";

interface UpdateItem {
  id: string;
  type: "feature" | "improvement" | "fix" | "coming-soon";
  title: string;
  description: string;
  date: string;
}

const staticUpdates: UpdateItem[] = [
  {
    id: "1",
    type: "feature",
    title: "Welcome Back Toast",
    description: "Returning users now see a personalized welcome message highlighting new content since their last visit.",
    date: "2026-01-08"
  },
  {
    id: "2",
    type: "feature",
    title: "Daily Admin Reports",
    description: "Admins can now view daily reports with user activity and content statistics.",
    date: "2026-01-08"
  },
  {
    id: "3",
    type: "improvement",
    title: "Enhanced Podcast Section",
    description: "Streamlined podcast section with improved layout and removed redundant team join button.",
    date: "2026-01-07"
  },
  {
    id: "4",
    type: "coming-soon",
    title: "Push Notification Improvements",
    description: "Working on enhanced push notifications for game alerts and live stream reminders.",
    date: "2026-01-08"
  },
  {
    id: "5",
    type: "coming-soon",
    title: "Community Polls",
    description: "Interactive polls for community engagement and fan opinions on games and players.",
    date: "2026-01-08"
  }
];

const typeConfig = {
  feature: {
    icon: Sparkles,
    label: "New Feature",
    color: "bg-green-500/20 text-green-400 border-green-500/30"
  },
  improvement: {
    icon: Rocket,
    label: "Improvement",
    color: "bg-blue-500/20 text-blue-400 border-blue-500/30"
  },
  fix: {
    icon: Bug,
    label: "Bug Fix",
    color: "bg-orange-500/20 text-orange-400 border-orange-500/30"
  },
  "coming-soon": {
    icon: Wrench,
    label: "In Progress",
    color: "bg-[#ff4500]/20 text-[#ff4500] border-[#ff4500]/30"
  }
};

const WhatsNew = () => {
  const navigate = useNavigate();
  const [recentContent, setRecentContent] = useState<UpdateItem[]>([]);

  useEffect(() => {
    const fetchRecentContent = async () => {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const [blogRes, podcastRes, streamRes] = await Promise.all([
        supabase
          .from("blog_posts")
          .select("id, title, created_at")
          .eq("published", true)
          .gte("created_at", oneWeekAgo.toISOString())
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("podcasts")
          .select("id, title, created_at")
          .eq("published", true)
          .gte("created_at", oneWeekAgo.toISOString())
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("live_streams")
          .select("id, title, created_at")
          .eq("published", true)
          .gte("created_at", oneWeekAgo.toISOString())
          .order("created_at", { ascending: false })
          .limit(5)
      ]);

      const contentUpdates: UpdateItem[] = [];

      blogRes.data?.forEach((post) => {
        contentUpdates.push({
          id: `blog-${post.id}`,
          type: "feature",
          title: `New Blog: ${post.title}`,
          description: "A new blog post has been published for the community.",
          date: post.created_at.split("T")[0]
        });
      });

      podcastRes.data?.forEach((podcast) => {
        contentUpdates.push({
          id: `podcast-${podcast.id}`,
          type: "feature",
          title: `New Episode: ${podcast.title}`,
          description: "A new podcast episode is now available to listen.",
          date: podcast.created_at.split("T")[0]
        });
      });

      streamRes.data?.forEach((stream) => {
        contentUpdates.push({
          id: `stream-${stream.id}`,
          type: "feature",
          title: `New Stream: ${stream.title}`,
          description: "A new live stream has been added to the schedule.",
          date: stream.created_at.split("T")[0]
        });
      });

      setRecentContent(contentUpdates);
    };

    fetchRecentContent();
  }, []);

  const allUpdates = [...recentContent, ...staticUpdates].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const groupedUpdates = allUpdates.reduce((acc, update) => {
    if (!acc[update.date]) {
      acc[update.date] = [];
    }
    acc[update.date].push(update);
    return acc;
  }, {} as Record<string, UpdateItem[]>);

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="What's New - Latest Updates & Features"
        description="Stay up to date with the latest MetsXMFanZone features, improvements, and content updates. See what's new on the platform."
        keywords="MetsXMFanZone updates, new features, changelog, platform updates"
        canonical="https://www.metsxmfanzone.com/whats-new"
      />
      <Navigation />
      
      <main className="container mx-auto px-4 py-8 pt-24">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-6 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-4">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">Changelog</span>
            </div>
            <h1 className="text-4xl font-bold mb-4">What's New</h1>
            <p className="text-muted-foreground text-lg">
              Stay up to date with the latest features, improvements, and content updates.
            </p>
          </div>

          {/* In Progress Section */}
          <div className="mb-12">
            <div className="flex items-center gap-2 mb-6">
              <Wrench className="h-5 w-5 text-[#ff4500]" />
              <h2 className="text-xl font-semibold">Currently Working On</h2>
            </div>
            <div className="space-y-4">
              {staticUpdates
                .filter((u) => u.type === "coming-soon")
                .map((update) => {
                  const config = typeConfig[update.type];
                  const Icon = config.icon;
                  return (
                    <div
                      key={update.id}
                      className="p-4 rounded-lg bg-card/50 border border-border/50 backdrop-blur-sm"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-[#ff4500]/10">
                          <Icon className="h-4 w-4 text-[#ff4500]" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium">{update.title}</h3>
                            <Badge variant="outline" className={config.color}>
                              {config.label}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {update.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Timeline */}
          <div className="relative">
            <div className="absolute left-[19px] top-0 bottom-0 w-px bg-border" />

            {Object.entries(groupedUpdates)
              .filter(([_, updates]) => updates.some((u) => u.type !== "coming-soon"))
              .map(([date, updates]) => (
                <div key={date} className="relative mb-8">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center z-10">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">
                        {format(new Date(date), "MMMM d, yyyy")}
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {updates.filter((u) => u.type !== "coming-soon").length} updates
                      </span>
                    </div>
                  </div>

                  <div className="ml-[52px] space-y-3">
                    {updates
                      .filter((u) => u.type !== "coming-soon")
                      .map((update) => {
                        const config = typeConfig[update.type];
                        const Icon = config.icon;
                        return (
                          <div
                            key={update.id}
                            className="p-4 rounded-lg bg-card/50 border border-border/50 backdrop-blur-sm hover:bg-card/80 transition-colors"
                          >
                            <div className="flex items-start gap-3">
                              <div className="p-2 rounded-lg bg-primary/10">
                                <Icon className="h-4 w-4 text-primary" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <h3 className="font-medium">{update.title}</h3>
                                  <Badge variant="outline" className={config.color}>
                                    {config.label}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {update.description}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default WhatsNew;
