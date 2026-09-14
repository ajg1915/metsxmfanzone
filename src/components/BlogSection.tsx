import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Clock, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import logo from "@/assets/metsxmfanzone-logo.png";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  featured_image_url: string | null;
  category: string | null;
  published_at: string | null;
  created_at: string;
}

const BlogSection = () => {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const { data, error } = await supabase
          .from("blog_posts")
          .select("id, title, slug, excerpt, featured_image_url, category, published_at, created_at")
          .eq("published", true)
          .order("published_at", { ascending: false })
          .limit(6);

        if (error) throw error;
        if (!cancelled) setPosts((data || []) as BlogPost[]);
      } catch (err) {
        console.error("Error fetching blog posts:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const highlightPost = posts[0];
  const otherPosts = posts.slice(1, 6);

  const getTimeAgo = (date: string | null) => {
    if (!date) return "";
    const now = new Date();
    const postDate = new Date(date);
    const diffInHours = Math.floor((now.getTime() - postDate.getTime()) / (1000 * 60 * 60));
    if (diffInHours < 1) return "Just now";
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) return "1 day ago";
    if (diffInDays < 7) return `${diffInDays} days ago`;
    return postDate.toLocaleDateString();
  };

  const openPost = (slug: string) => {
    if (!slug) return;
    navigate(`/blog/${slug}`);
  };

  if (loading) {
    return (
      <section className="py-10 sm:py-12 md:py-16 relative">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            Loading latest articles...
          </div>
        </div>
      </section>
    );
  }

  if (posts.length === 0) {
    return null;
  }

  return (
    <section className="py-6 sm:py-12 md:py-16 relative overflow-hidden">
      <div className="container mx-auto px-3 sm:px-6 lg:px-8 max-w-7xl relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="flex flex-row justify-between items-center gap-2 sm:gap-4 mb-4 sm:mb-6 md:mb-8"
        >
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1 sm:p-2 rounded-lg sm:rounded-xl glass-card shrink-0">
              <img src={logo} alt="MetsXMFanZone" className="w-5 h-5 sm:w-8 sm:h-8 object-contain" />
            </div>
            <div>
              <h2 className="text-sm sm:text-xl md:text-2xl font-bold text-foreground leading-tight">
                Latest Mets News
              </h2>
              <p className="text-[10px] sm:text-sm text-muted-foreground">From the MetsXMFanZone blog</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/whats-new")}
              className="group glass-card border-primary/50 bg-primary/10 hover:bg-primary/20 transition-all duration-300 text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3"
            >
              <img src={logo} alt="" className="w-3.5 h-3.5 sm:w-4 sm:h-4 object-contain" />
              <span className="hidden xs:inline ml-1">What's New</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/blog")}
              className="group glass-card border-border/30 hover:border-primary/50 transition-all duration-300 text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3"
            >
              View All
              <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 ml-1 sm:ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>
        </motion.div>

        {/* Featured Post */}
        {highlightPost && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            onClick={() => openPost(highlightPost.slug)}
            className="cursor-pointer group glass-card hover-lift glow-blue rounded-xl overflow-hidden mb-4"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && openPost(highlightPost.slug)}
          >
            <article className="flex flex-col sm:flex-row">
              <div className="relative w-full sm:w-2/5 overflow-hidden bg-black flex items-center justify-center">
                {highlightPost.featured_image_url ? (
                  <img
                    src={highlightPost.featured_image_url}
                    alt={highlightPost.title}
                    className="w-full h-auto max-h-[480px] object-contain group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => { const t = e.currentTarget; if (!t.dataset.fbk) { t.dataset.fbk = "1"; t.src = "/placeholder.svg"; } }}
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center min-h-[160px]">
                    <img src={logo} alt="" className="w-16 h-16 opacity-30" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent sm:bg-gradient-to-r sm:from-transparent sm:to-card/30" />
                <div className="absolute top-3 left-3">
                  <Badge className="text-xs px-2 py-0.5 bg-primary text-primary-foreground border-0 shadow-lg">
                    <Sparkles className="w-3 h-3 mr-1" />
                    Featured
                  </Badge>
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-3 sm:hidden">
                  {highlightPost.category && (
                    <Badge className="text-[10px] px-1.5 py-0 mb-1.5 bg-white/20 text-white border-0 backdrop-blur-sm">
                      {highlightPost.category}
                    </Badge>
                  )}
                  <h3 className="text-base font-bold text-white line-clamp-2 drop-shadow-lg">
                    {highlightPost.title}
                  </h3>
                </div>
              </div>

              <div className="hidden sm:flex flex-1 p-4 sm:p-5 flex-col justify-center">
                {highlightPost.category && (
                  <Badge className="w-fit text-xs px-2 py-0.5 mb-2 bg-muted text-muted-foreground border-0">
                    {highlightPost.category}
                  </Badge>
                )}
                <h3 className="text-lg sm:text-xl font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2 mb-2">
                  {highlightPost.title}
                </h3>
                {highlightPost.excerpt && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                    {highlightPost.excerpt}
                  </p>
                )}
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {getTimeAgo(highlightPost.published_at || highlightPost.created_at)}
                  </span>
                  <span className="flex items-center gap-1 text-primary">
                    Read article <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </div>

              <div className="flex sm:hidden items-center justify-between p-3 border-t border-border/20">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>{getTimeAgo(highlightPost.published_at || highlightPost.created_at)}</span>
                </div>
                <span className="text-xs text-primary font-medium flex items-center gap-1">
                  Read <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </article>
          </motion.div>
        )}

        {/* Remaining Posts */}
        <div className="space-y-2">
          {otherPosts.map((post, index) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              onClick={() => openPost(post.slug)}
              className="cursor-pointer group glass-card hover-lift glow-blue rounded-lg overflow-hidden"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && openPost(post.slug)}
            >
              <article className="flex gap-3 p-2.5">
                <div className="relative w-20 h-20 flex-shrink-0 rounded-md overflow-hidden bg-card">
                  {post.featured_image_url ? (
                    <img
                      src={post.featured_image_url}
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                      <img src={logo} alt="" className="w-8 h-8 opacity-30" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                  <div>
                    {post.category && (
                      <Badge className="text-[10px] px-1.5 py-0 mb-1 bg-muted text-muted-foreground border-0">
                        {post.category}
                      </Badge>
                    )}
                    <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-tight">
                      {post.title}
                    </h3>
                  </div>

                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-1">
                    <Clock className="w-3 h-3" />
                    <span>{getTimeAgo(post.published_at || post.created_at)}</span>
                  </div>
                </div>
              </article>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default BlogSection;
