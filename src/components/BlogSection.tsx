import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Clock, ArrowRight, Sparkles, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import logo from "@/assets/metsxmfanzone-logo.png";

interface NewsItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  creator?: string;
  image?: string;
}

const CACHE_KEY = "sny_mets_news_v1";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

const BlogSection = () => {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      // Try local cache (daily fetch)
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const { ts, items } = JSON.parse(cached);
          if (Date.now() - ts < CACHE_TTL_MS && Array.isArray(items) && items.length) {
            setPosts(items);
            setLoading(false);
            return;
          }
        }
      } catch {}

      try {
        const { data, error } = await supabase.functions.invoke("fetch-sny-news");
        if (error) throw error;
        const items: NewsItem[] = data?.items ?? [];
        if (!cancelled) {
          setPosts(items);
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), items }));
          } catch {}
        }
      } catch (err) {
        console.error("Error fetching SNY news:", err);
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

  const getTimeAgo = (date: string) => {
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

  const openExternal = (url: string) => {
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  if (loading) {
    return (
      <section className="py-10 sm:py-12 md:py-16 relative">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            Loading latest Mets news...
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
              <p className="text-[10px] sm:text-sm text-muted-foreground">Powered by SNY</p>
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
              onClick={() => openExternal("https://sny.tv/teams/mets")}
              className="group glass-card border-border/30 hover:border-primary/50 transition-all duration-300 text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3"
            >
              View All
              <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 ml-1 sm:ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>
        </motion.div>

        {/* Featured Highlight Post */}
        {highlightPost && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            onClick={() => openExternal(highlightPost.link)}
            className="cursor-pointer group glass-card hover-lift glow-blue rounded-xl overflow-hidden mb-4"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && openExternal(highlightPost.link)}
          >
            <article className="flex flex-col sm:flex-row">
              <div className="relative w-full sm:w-2/5 overflow-hidden bg-black flex items-center justify-center">
                {highlightPost.image ? (
                  <img
                    src={highlightPost.image}
                    alt={highlightPost.title}
                    className="w-full h-auto max-h-[480px] object-contain group-hover:scale-105 transition-transform duration-500"
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
                  <Badge className="text-[10px] px-1.5 py-0 mb-1.5 bg-white/20 text-white border-0 backdrop-blur-sm">
                    SNY
                  </Badge>
                  <h3 className="text-base font-bold text-white line-clamp-2 drop-shadow-lg">
                    {highlightPost.title}
                  </h3>
                </div>
              </div>

              <div className="hidden sm:flex flex-1 p-4 sm:p-5 flex-col justify-center">
                <Badge className="w-fit text-xs px-2 py-0.5 mb-2 bg-muted text-muted-foreground border-0">
                  SNY {highlightPost.creator ? `• ${highlightPost.creator}` : ""}
                </Badge>
                <h3 className="text-lg sm:text-xl font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2 mb-2">
                  {highlightPost.title}
                </h3>
                {highlightPost.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                    {highlightPost.description}
                  </p>
                )}
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {getTimeAgo(highlightPost.pubDate)}
                  </span>
                  <span className="flex items-center gap-1 text-primary">
                    Read on SNY <ExternalLink className="w-3 h-3" />
                  </span>
                </div>
              </div>

              <div className="flex sm:hidden items-center justify-between p-3 border-t border-border/20">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>{getTimeAgo(highlightPost.pubDate)}</span>
                </div>
                <span className="text-xs text-primary font-medium flex items-center gap-1">
                  SNY <ExternalLink className="w-3 h-3" />
                </span>
              </div>
            </article>
          </motion.div>
        )}

        {/* Remaining Posts */}
        <div className="space-y-2">
          {otherPosts.map((post, index) => (
            <motion.div
              key={post.link || index}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              onClick={() => openExternal(post.link)}
              className="cursor-pointer group glass-card hover-lift glow-blue rounded-lg overflow-hidden"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && openExternal(post.link)}
            >
              <article className="flex gap-3 p-2.5">
                <div className="relative w-20 h-20 flex-shrink-0 rounded-md overflow-hidden bg-card">
                  {post.image ? (
                    <img
                      src={post.image}
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
                    <Badge className="text-[10px] px-1.5 py-0 mb-1 bg-muted text-muted-foreground border-0">
                      SNY{post.creator ? ` • ${post.creator}` : ""}
                    </Badge>
                    <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-tight">
                      {post.title}
                    </h3>
                  </div>

                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-1">
                    <Clock className="w-3 h-3" />
                    <span>{getTimeAgo(post.pubDate)}</span>
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
