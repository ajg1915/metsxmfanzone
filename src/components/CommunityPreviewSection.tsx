import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, ArrowRight, Users, Flame, Sparkles, Pin } from "lucide-react";
import { motion } from "framer-motion";
import logo from "@/assets/metsxmfanzone-logo.png";

interface Post {
  id: string;
  user_id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  is_pinned: boolean | null;
  pinned_at: string | null;
  profiles: {
    full_name: string | null;
    email: string | null;
  } | null;
  isAdmin?: boolean;
}

const CommunityPreviewSection = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ postsCount: 0, membersCount: 0 });
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) {setIsAdmin(false);return;}
    supabase.
    from("user_roles").
    select("role").
    eq("user_id", user.id).
    then(({ data }) => {
      setIsAdmin(data?.some((r) => r.role === "admin") ?? false);
    });
  }, [user]);

  const handlePostClick = () => {
    navigate(isAdmin ? "/admin/stories" : "/community");
  };

  useEffect(() => {
    fetchCommunityData();
  }, []);

  const fetchCommunityData = async () => {
    try {
      const { data: adminRoles } = await supabase.
      from("user_roles").
      select("user_id").
      eq("role", "admin");

      const adminUserIds = new Set((adminRoles || []).map((r) => r.user_id));

      const { data: postsData } = await supabase.
      from("posts").
      select(`id, user_id, content, image_url, created_at, is_pinned, pinned_at, profiles (full_name, email)`).
      order("created_at", { ascending: false }).
      limit(10);

      const { count: postsCount } = await supabase.
      from("posts").
      select("*", { count: "exact", head: true });

      const { count: membersCount } = await supabase.
      from("profiles").
      select("*", { count: "exact", head: true });

      const postsNeedingUrls = (postsData || []).filter((p) => p.image_url);
      const signedUrlMap: Record<string, string> = {};

      if (postsNeedingUrls.length > 0) {
        const signPromises = postsNeedingUrls.map(async (post) => {
          const fileName = post.image_url!.split('/community_images/')[1] || post.image_url!;
          if (fileName) {
            const { data: signedUrlData } = await supabase.storage.
            from('community_images').
            createSignedUrl(fileName, 3600);
            if (signedUrlData?.signedUrl) {
              signedUrlMap[post.id] = signedUrlData.signedUrl;
            }
          }
        });
        await Promise.all(signPromises);
      }

      const postsWithSignedUrls = (postsData || []).map((post) => ({
        ...post,
        image_url: signedUrlMap[post.id] || post.image_url,
        isAdmin: adminUserIds.has(post.user_id),
        is_pinned: post.is_pinned ?? false,
        pinned_at: post.pinned_at ?? null,
      }));

      // Sort: pinned posts first, then by date
      postsWithSignedUrls.sort((a, b) => {
        const aPinned = a.is_pinned ? 1 : 0;
        const bPinned = b.is_pinned ? 1 : 0;
        if (aPinned !== bPinned) return bPinned - aPinned;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      // Take top 5
      setPosts(postsWithSignedUrls.slice(0, 5));
      setStats({
        postsCount: postsCount || 0,
        membersCount: membersCount || 0
      });
    } catch (error) {
      console.error("Error fetching community data:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatTimeAgo = (date: string) => {
    const now = new Date();
    const postDate = new Date(date);
    const diffMs = now.getTime() - postDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  if (loading) {
    return (
      <section className="py-12 sm:py-16 md:py-20 px-3 sm:px-6">
        <div className="container mx-auto max-w-7xl">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-64" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="h-48 bg-muted rounded-xl" />
              <div className="h-48 bg-muted rounded-xl" />
              <div className="h-48 bg-muted rounded-xl" />
            </div>
          </div>
        </div>
      </section>);

  }

  return (
    <section className="py-8 sm:py-16 md:py-20 px-3 sm:px-6 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-secondary/5 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto max-w-7xl relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-3 sm:gap-4 mb-6 sm:mb-10">

          <div>
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1 sm:mb-2">
              <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
              <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-primary">Fan Hub</span>
            </div>
            <h2 className="text-sm sm:text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2 sm:gap-3 leading-tight text-left">
              <img src={logo} alt="MetsXMFanZone" className="w-6 h-6 sm:w-10 sm:h-10 shrink-0" />
              <span className="break-words text-xl">MetsXMFanZone Community</span>
            </h2>
            <p className="text-[10px] sm:text-base text-muted-foreground mt-1 sm:mt-2 max-w-md">
              Join the conversation with 50k passionate Mets fans
            </p>
          </div>
          <Button
            onClick={() => navigate("/community")}
            size="sm"
            className="group text-xs sm:text-sm font-semibold rounded-full px-4 sm:px-6 shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all">

            Join Community
            <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 ml-1.5 sm:ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>
        </motion.div>

        {/* Stats Cards */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-8 sm:mb-10">

          <div className="bg-card/60 backdrop-blur-md border border-border/40 rounded-2xl p-4 sm:p-5 flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            </div>
            <div>
              <p className="text-lg sm:text-2xl font-bold text-foreground">{stats.postsCount.toLocaleString()}</p>
              <p className="text-[11px] sm:text-xs text-muted-foreground">Posts</p>
            </div>
          </div>
          <div className="bg-card/60 backdrop-blur-md border border-border/40 rounded-2xl p-4 sm:p-5 flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-secondary/10 flex items-center justify-center flex-shrink-0">
              <Users className="w-5 h-5 sm:w-6 sm:h-6 text-secondary" />
            </div>
            <div>
              <p className="text-lg sm:text-2xl font-bold text-foreground">50k</p>
              <p className="text-[11px] sm:text-xs text-muted-foreground">Members</p>
            </div>
          </div>
          <div className="hidden sm:flex bg-card/60 backdrop-blur-md border border-border/40 rounded-2xl p-4 sm:p-5 items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-destructive/10 flex items-center justify-center flex-shrink-0">
              <Flame className="w-5 h-5 sm:w-6 sm:h-6 text-destructive" />
            </div>
            <div>
              <p className="text-lg sm:text-2xl font-bold text-foreground">Live</p>
              <p className="text-[11px] sm:text-xs text-muted-foreground">Active Now</p>
            </div>
          </div>
        </motion.div>

        {/* Posts Feed */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base sm:text-lg font-semibold text-foreground flex items-center gap-2">
              <Flame className="w-4 h-4 sm:w-5 sm:h-5 text-destructive" />
              Trending Posts
            </h3>
          </div>

          {posts.length > 0 ?
          <>
              {/* Featured Post */}
              <motion.div
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
              onClick={handlePostClick}
              className="cursor-pointer group relative rounded-2xl overflow-hidden border border-border/30 bg-card/70 backdrop-blur-md hover:border-primary/40 transition-all duration-300 shadow-sm hover:shadow-xl hover:shadow-primary/5">

                <div className="flex flex-col sm:flex-row">
                  {/* Image */}
                  <div className="relative w-full sm:w-2/5 aspect-[16/10] sm:aspect-auto overflow-hidden">
                    {posts[0].image_url ?
                  <img
                    src={posts[0].image_url}
                    alt="Featured Post"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" /> :


                  <div className="w-full h-full min-h-[180px] bg-gradient-to-br from-primary/15 via-primary/5 to-secondary/15 flex items-center justify-center">
                        <Avatar className="w-20 h-20 ring-4 ring-primary/20">
                          <AvatarFallback className="bg-primary/20 text-primary text-2xl font-bold">
                            {posts[0].isAdmin ? "M" : posts[0].profiles?.full_name?.[0] || "M"}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                  }
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent sm:bg-gradient-to-r sm:from-transparent sm:to-card/20" />
                    <Badge className="absolute top-3 left-3 text-[10px] px-2.5 py-1 bg-primary text-primary-foreground border-0 shadow-lg font-semibold uppercase tracking-wider">
                      {posts[0].is_pinned ? (
                        <><Pin className="w-3 h-3 mr-1" /> Featured Post</>
                      ) : (
                        <><Flame className="w-3 h-3 mr-1" /> Trending</>
                      )}
                    </Badge>
                  </div>

                  {/* Content */}
                  <div className="flex-1 p-4 sm:p-6 flex flex-col justify-center">
                    <div className="flex items-center gap-2 mb-2">
                      <Avatar className="w-7 h-7">
                        <AvatarFallback className="bg-primary/15 text-primary text-xs font-semibold">
                          {posts[0].isAdmin ? "M" : posts[0].profiles?.full_name?.[0] || "M"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-semibold text-foreground">
                        {posts[0].isAdmin ? "MetsXMFanZone" : posts[0].profiles?.full_name || "MetsXMFanZone"}
                      </span>
                      <span className="text-[11px] text-muted-foreground">· {formatTimeAgo(posts[0].created_at)}</span>
                    </div>
                    {posts[0].content &&
                  <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                        {posts[0].content}
                      </p>
                  }
                    <div className="mt-3 flex items-center gap-1.5 text-xs text-primary font-medium group-hover:gap-2.5 transition-all">
                      Read more <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Post Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {posts.slice(1).map((post, index) =>
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.06 }}
                onClick={handlePostClick}
                className="cursor-pointer group rounded-xl overflow-hidden border border-border/30 bg-card/70 backdrop-blur-md hover:border-primary/40 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5">

                    {/* Thumbnail */}
                    <div className="relative aspect-[16/9] overflow-hidden">
                      {post.image_url ?
                  <img
                    src={post.image_url}
                    alt="Post"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" /> :


                  <div className="w-full h-full bg-gradient-to-br from-primary/10 via-card to-secondary/10 flex items-center justify-center">
                          <Avatar className="w-12 h-12">
                            <AvatarFallback className="bg-primary/15 text-primary font-semibold">
                              {post.isAdmin ? "M" : post.profiles?.full_name?.[0] || "M"}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                  }
                    </div>

                    {/* Content */}
                    <div className="p-3 sm:p-4">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="font-semibold text-foreground text-sm truncate">
                          {post.isAdmin ? "MetsXMFanZone" : post.profiles?.full_name?.split(" ")[0] || "MetsXMFanZone"}
                        </span>
                        <span className="text-[10px] text-muted-foreground flex-shrink-0">
                          {formatTimeAgo(post.created_at)}
                        </span>
                      </div>
                      {post.content &&
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                          {post.content}
                        </p>
                  }
                    </div>
                  </motion.div>
              )}
              </div>
            </> :

          <div className="bg-card/60 backdrop-blur-md border border-border/40 rounded-2xl p-8 text-center">
              <MessageSquare className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Be the first to post!</p>
            </div>
          }

          {/* CTA Banner */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative rounded-2xl overflow-hidden border border-primary/20 bg-gradient-to-r from-primary/10 via-card/80 to-secondary/10 backdrop-blur-md mt-4">

            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,hsl(var(--primary)/0.08),transparent_60%)]" />
            <div className="relative p-4 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-center sm:text-left">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center flex-shrink-0 bg-muted">
                  <img src={logo} alt="MetsXMFanZone" className="w-6 h-6 sm:w-7 sm:h-7" />
                </div>
                <div>
                  <h4 className="font-bold text-foreground text-sm sm:text-base">Ready to join the conversation?</h4>
                  <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
                    Share your takes, reactions & highlights with fellow Mets fans
                  </p>
                </div>
              </div>
              <Button
                onClick={() => navigate("/community")}
                className="rounded-full px-6 font-semibold shadow-md shadow-primary/15 hover:shadow-primary/30 transition-all">

                Get Started
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    </section>);

};

export default CommunityPreviewSection;