import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare, ChevronLeft, ChevronRight, Pin } from "lucide-react";
import { motion } from "framer-motion";
import NewBadge from "@/components/NewBadge";
import { isFresh } from "@/lib/newItem";

// The MetsXMFanZone Feed wall for signed-in members: cards scroll left to right,
// laid out like the video sections (Replay Games, Live Streams).

interface WallPost {
  id: string;
  user_id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  is_pinned: boolean | null;
  pinned_at: string | null;
  profiles: { full_name: string | null; email: string | null } | null;
  isAdmin?: boolean;
}

interface WallArticle {
  id: string;
  title: string;
  slug: string;
  featured_image_url: string | null;
  category: string | null;
  published_at: string | null;
  created_at: string;
}

const NEW_FOR_MS = 48 * 60 * 60 * 1000;

const timeAgo = (date: string) => {
  const diffMs = Date.now() - new Date(date).getTime();
  const mins = Math.max(0, Math.floor(diffMs / 60000));
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
};

const authorName = (p: WallPost) => (p.isAdmin ? "MetsXMFanZone" : p.profiles?.full_name?.split(" ")[0] || "Member");
const authorInitial = (p: WallPost) => (p.isAdmin ? "M" : p.profiles?.full_name?.[0]?.toUpperCase() || "M");

const Avatar = ({ letter, size = 24, admin = false }: { letter: string; size?: number; admin?: boolean }) => (
  <span
    className={`inline-flex items-center justify-center rounded-full font-bold shrink-0 ${
      admin ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
    }`}
    style={{ width: size, height: size, fontSize: Math.round(size * 0.46) }}
    aria-hidden="true"
  >
    {letter}
  </span>
);

const CommunityPreviewSection = () => {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<WallPost[]>([]);
  const [article, setArticle] = useState<WallArticle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [{ data: adminRoles }, { data: postsData }, { data: articleData }] = await Promise.all([
          supabase.from("user_roles").select("user_id").eq("role", "admin"),
          supabase
            .from("posts")
            .select("id, user_id, content, image_url, created_at, is_pinned, pinned_at, profiles (full_name, email)")
            .order("created_at", { ascending: false })
            .limit(20),
          supabase
            .from("blog_posts")
            .select("id, title, slug, featured_image_url, category, published_at, created_at")
            .eq("published", true)
            .order("published_at", { ascending: false })
            .limit(1),
        ]);
        if (cancelled) return;

        const adminIds = new Set((adminRoles || []).map((r) => r.user_id));

        // Only old Supabase-storage images need signing; R2 and other links are used as they are.
        const needSigning = (postsData || []).filter(
          (p) => p.image_url && (!p.image_url.startsWith("http") || p.image_url.includes("/storage/v1/object/")),
        );
        const signed: Record<string, string> = {};
        await Promise.all(
          needSigning.map(async (p) => {
            const fileName = p.image_url!.split("/community_images/")[1] || p.image_url!;
            const { data } = await supabase.storage.from("community_images").createSignedUrl(fileName, 3600);
            if (data?.signedUrl) signed[p.id] = data.signedUrl;
          }),
        );

        const list: WallPost[] = (postsData || []).map((p) => ({
          ...(p as WallPost),
          image_url: signed[p.id] || p.image_url,
          isAdmin: adminIds.has(p.user_id),
          is_pinned: p.is_pinned ?? false,
          pinned_at: p.pinned_at ?? null,
        }));
        list.sort((a, b) => {
          const ap = a.is_pinned ? 1 : 0;
          const bp = b.is_pinned ? 1 : 0;
          if (ap !== bp) return bp - ap;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });

        setPosts(list);
        setArticle((articleData && articleData[0]) || null);
      } catch (error) {
        console.error("Error loading the wall:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const openWall = () => navigate("/community");
  const [scrollPosition, setScrollPosition] = useState(0);

  const scrollBy = (direction: "left" | "right") => {
    const container = document.getElementById("wall-scroll");
    if (!container) return;
    const amount = container.clientWidth * 0.8;
    const next = direction === "left" ? Math.max(0, scrollPosition - amount) : scrollPosition + amount;
    container.scrollTo({ left: next, behavior: "smooth" });
    setScrollPosition(next);
  };

  if (loading) {
    return (
      <section className="py-6 sm:py-8" aria-busy="true">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <div className="text-center text-muted-foreground">Loading the wall...</div>
        </div>
      </section>
    );
  }

  if (posts.length === 0 && !article) return null;

  const articleIsNew = !!article && isFresh(article.published_at || article.created_at);
  const cardClass =
    "flex-shrink-0 snap-start w-[calc(100vw-4.5rem)] max-w-[340px] md:w-[320px] md:max-w-none lg:w-[380px] cursor-pointer group text-left";
  const frameClass =
    "relative overflow-hidden rounded-xl border border-border/50 transition-all duration-300 md:group-hover:scale-105 group-hover:z-10 group-hover:shadow-2xl group-hover:shadow-primary/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary";

  return (
    <section className="py-6 sm:py-8 relative" aria-labelledby="home-wall-title">
      <div className="container mx-auto px-3 sm:px-6 lg:px-8 max-w-7xl">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="flex items-center justify-between mb-4"
        >
          <div className="flex items-center gap-1.5 sm:gap-2">
            <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            <h2
              id="home-wall-title"
              className="text-[21px] leading-none tracking-wide sm:text-2xl md:text-3xl font-bold uppercase text-foreground"
            >
              MetsXMFanZone Feed
            </h2>
          </div>
          <a
            href="/community"
            className="flex min-h-[44px] items-center gap-1 text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
          >
            Open Wall
            <ChevronRight className="w-4 h-4" />
          </a>
        </motion.div>
      </div>

      <div className="relative group/carousel">
        {scrollPosition > 0 && (
          <button
            type="button"
            aria-label="Scroll the wall left"
            onClick={() => scrollBy("left")}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 p-1 opacity-0 group-hover/carousel:opacity-100 transition-opacity duration-300"
          >
            <ChevronLeft className="w-8 h-8 text-foreground" />
          </button>
        )}

        <div
          id="wall-scroll"
          onScroll={(e) => setScrollPosition(e.currentTarget.scrollLeft)}
          className="flex gap-3 overflow-x-auto scrollbar-hide scroll-smooth max-md:snap-x max-md:snap-mandatory max-md:scroll-px-4 px-4 sm:px-6 lg:px-8"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          <div className="hidden flex-shrink-0 lg:block lg:w-[calc((100vw-1280px)/2)]" />

          {/* Latest blog article first */}
          {article && (
            <motion.a
              href={`/blog/${article.slug}`}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3 }}
              className={cardClass}
            >
              <div className={frameClass}>
                <div className="aspect-video relative bg-gradient-to-br from-muted to-secondary">
                  {article.featured_image_url && (
                    <img src={article.featured_image_url} alt="" loading="lazy" className="w-full h-full object-cover" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent opacity-70" />
                  {articleIsNew && <NewBadge kind="article" className="absolute top-2 left-2" />}
                  <span className="absolute top-2 right-2 rounded-full bg-muted/80 px-2 py-0.5 text-[10px] sm:text-xs font-semibold text-muted-foreground backdrop-blur-sm">
                    BLOG
                  </span>
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <p className="text-foreground text-[15px] sm:text-sm font-semibold line-clamp-2">{article.title}</p>
                  </div>
                </div>
              </div>
            </motion.a>
          )}

          {posts.map((post, index) => (
            <motion.button
              type="button"
              key={post.id}
              onClick={openWall}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: Math.min(index, 8) * 0.05 }}
              className={cardClass}
              aria-label={`Post by ${authorName(post)}`}
            >
              <div className={frameClass}>
                <div className="aspect-video relative bg-gradient-to-br from-secondary via-muted to-background">
                  {post.image_url ? (
                    <img src={post.image_url} alt="" loading="lazy" className="w-full h-full object-cover" />
                  ) : (
                    post.content && (
                      <p className="absolute inset-0 flex items-center px-4 pb-12 pt-9 text-lg sm:text-xl font-bold leading-snug text-foreground line-clamp-4">
                        {post.content}
                      </p>
                    )
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent opacity-60" />

                  {post.is_pinned ? (
                    <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-[#c93b00] px-2 py-0.5 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-white">
                      <Pin className="w-3 h-3" /> Featured
                    </span>
                  ) : (
                    isFresh(post.created_at) && (
                      <span className="absolute top-2 left-2 rounded-full bg-[#0b3e75] px-2 py-0.5 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-white ring-1 ring-white/30">
                        New post
                      </span>
                    )
                  )}

                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <div className="flex items-center gap-1.5">
                      <Avatar letter={authorInitial(post)} size={22} admin={post.isAdmin} />
                      <span className="text-[15px] sm:text-sm font-semibold text-foreground truncate">{authorName(post)}</span>
                      <span className="text-xs text-muted-foreground shrink-0">{timeAgo(post.created_at)}</span>
                    </div>
                    {post.image_url && post.content && (
                      <p className="mt-1 text-xs sm:text-[13px] text-foreground/80 line-clamp-1">{post.content}</p>
                    )}
                  </div>
                </div>
              </div>
            </motion.button>
          ))}

          <div className="hidden flex-shrink-0 lg:block lg:w-[calc((100vw-1280px)/2)]" />
        </div>

        <button
          type="button"
          aria-label="Scroll the wall right"
          onClick={() => scrollBy("right")}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-20 p-1 opacity-0 group-hover/carousel:opacity-100 transition-opacity duration-300"
        >
          <ChevronRight className="w-8 h-8 text-foreground" />
        </button>
      </div>
    </section>
  );
};

export default CommunityPreviewSection;
