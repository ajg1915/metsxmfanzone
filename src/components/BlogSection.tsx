import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Clock, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import logo from "@/assets/metsxmfanzone-logo.png";
import NewBadge from "@/components/NewBadge";
import { isFresh } from "@/lib/newItem";

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
          .limit(7);

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
  const otherPosts = posts.slice(1, 7);

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

  const metaRow = (post: BlogPost) => (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Clock className="h-3 w-3 shrink-0" />
      <span className="truncate">{getTimeAgo(post.published_at || post.created_at)}</span>
    </div>
  );

  return (
    <section className="relative overflow-hidden py-6 sm:py-12 md:py-16">
      <div className="container relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header: title + View all on one row, What's New underneath on phones */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-4 sm:mb-6 md:mb-8"
        >
          <div className="flex min-w-0 items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
              <div className="glass-card shrink-0 rounded-xl p-1.5 sm:p-2">
                <img src={logo} alt="MetsXMFanZone" className="h-6 w-6 object-contain sm:h-8 sm:w-8" />
              </div>
              <h2 className="truncate font-bold uppercase leading-none tracking-wide text-foreground text-[26px] sm:text-2xl md:text-3xl">
                Our Desk
              </h2>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/whats-new")}
                className="glass-card hidden h-9 border-primary/50 bg-primary/10 px-3 text-sm hover:bg-primary/20 sm:inline-flex"
              >
                <img src={logo} alt="" className="mr-1.5 h-4 w-4 object-contain" />
                What's New
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/blog")}
                className="group glass-card h-10 border-border/30 px-3 text-sm hover:border-primary/50 sm:h-9"
              >
                View all
                <ArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate("/whats-new")}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2.5 text-sm font-medium text-foreground sm:hidden"
          >
            <img src={logo} alt="" className="h-4 w-4 object-contain" />
            What's New on MetsXMFanZone
          </button>
        </motion.div>

        {/* Featured post: big picture, title on top of it on phones */}
        {highlightPost && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            onClick={() => openPost(highlightPost.slug)}
            className="group glass-card hover-lift glow-blue mb-4 cursor-pointer overflow-hidden rounded-2xl"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && openPost(highlightPost.slug)}
          >
            <article className="flex min-w-0 flex-col md:flex-row">
              <div className="relative aspect-[16/10] w-full overflow-hidden bg-card md:aspect-auto md:min-h-[300px] md:w-1/2">
                {highlightPost.featured_image_url ? (
                  <img
                    src={highlightPost.featured_image_url}
                    alt={highlightPost.title}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    onError={(e) => { const t = e.currentTarget; if (!t.dataset.fbk) { t.dataset.fbk = "1"; t.src = "/placeholder.svg"; } }}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/20 to-secondary/20">
                    <img src={logo} alt="" className="h-16 w-16 opacity-30" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent md:bg-gradient-to-r md:from-transparent md:via-transparent md:to-card/40" />
                <div className="absolute left-3 top-3">
                  <Badge className="border-0 bg-primary px-2 py-0.5 text-xs text-primary-foreground shadow-lg">
                    <Sparkles className="mr-1 h-3 w-3" />
                    Featured
                  </Badge>
                </div>
                {isFresh(highlightPost.published_at || highlightPost.created_at) && (
                  <NewBadge kind="article" className="absolute right-3 top-3" />
                )}
                {/* phones: title sits on the picture */}
                <div className="absolute inset-x-0 bottom-0 min-w-0 p-3.5 md:hidden">
                  {highlightPost.category && (
                    <Badge className="mb-1.5 border-0 bg-white/20 px-2 py-0 text-[11px] text-white backdrop-blur-sm">
                      {highlightPost.category}
                    </Badge>
                  )}
                  <h3 className="line-clamp-3 break-words text-[22px] font-bold leading-[1.1] text-white drop-shadow-lg [overflow-wrap:anywhere]">
                    {highlightPost.title}
                  </h3>
                </div>
              </div>

              {/* tablets / desktop: text beside the picture */}
              <div className="hidden min-w-0 flex-1 flex-col justify-center p-6 md:flex">
                {highlightPost.category && (
                  <Badge className="mb-3 w-fit border-0 bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {highlightPost.category}
                  </Badge>
                )}
                <h3 className="mb-3 line-clamp-3 break-words text-2xl font-bold text-foreground transition-colors group-hover:text-primary [overflow-wrap:anywhere]">
                  {highlightPost.title}
                </h3>
                {highlightPost.excerpt && (
                  <p className="mb-4 line-clamp-3 break-words text-sm text-muted-foreground">{highlightPost.excerpt}</p>
                )}
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  {metaRow(highlightPost)}
                  <span className="flex items-center gap-1 font-medium text-primary">
                    Read article <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </div>

              {/* phones: footer strip */}
              <div className="flex items-center justify-between gap-3 border-t border-border/20 px-3.5 py-3 md:hidden">
                {metaRow(highlightPost)}
                <span className="flex shrink-0 items-center gap-1 text-sm font-medium text-primary">
                  Read <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </article>
          </motion.div>
        )}

        {/* More articles: compact rows on phones, picture cards from tablet up */}
        <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {otherPosts.map((post, index) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              onClick={() => openPost(post.slug)}
              className="group glass-card hover-lift glow-blue min-w-0 cursor-pointer overflow-hidden rounded-xl"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && openPost(post.slug)}
            >
              <article className="flex min-w-0 items-stretch gap-3 p-2.5 md:flex-col md:gap-0 md:p-0">
                <div className="relative h-[84px] w-[112px] shrink-0 overflow-hidden rounded-lg bg-card md:aspect-video md:h-auto md:w-full md:rounded-none">
                  {post.featured_image_url ? (
                    <img
                      src={post.featured_image_url}
                      alt={post.title}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      onError={(e) => { const t = e.currentTarget; if (!t.dataset.fbk) { t.dataset.fbk = "1"; t.src = "/placeholder.svg"; } }}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 to-secondary/20">
                      <img src={logo} alt="" className="h-8 w-8 opacity-30" />
                    </div>
                  )}
                  {isFresh(post.published_at || post.created_at) && (
                    <NewBadge kind="article" small className="absolute left-1 top-1" />
                  )}
                </div>

                <div className="flex min-w-0 flex-1 flex-col justify-between gap-1.5 py-0.5 md:p-3.5">
                  <div className="min-w-0">
                    {post.category && (
                      <Badge className="mb-1 max-w-full truncate border-0 bg-muted px-1.5 py-0 text-[11px] text-muted-foreground">
                        {post.category}
                      </Badge>
                    )}
                    <h3 className="line-clamp-3 break-words text-base font-semibold leading-snug text-foreground transition-colors group-hover:text-primary [overflow-wrap:anywhere]">
                      {post.title}
                    </h3>
                  </div>
                  {metaRow(post)}
                </div>
              </article>
            </motion.div>
          ))}
        </div>

        {/* Phones: one big, easy-to-tap button at the bottom */}
        <Button
          variant="outline"
          onClick={() => navigate("/blog")}
          className="glass-card mt-4 h-12 w-full border-primary/40 text-base font-medium sm:hidden"
        >
          Read all articles
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </section>
  );
};

export default BlogSection;
