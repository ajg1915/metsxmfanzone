import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare, ArrowRight, Pin } from "lucide-react";
import { motion } from "framer-motion";
import logo from "@/assets/metsxmfanzone-logo.png";

// The home page "wall": the Feed at the top of the home page.
// Featured/pinned post big, a grid of the newest posts, and the latest blog article.

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
            .limit(10),
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

  if (loading) {
    return (
      <section className="px-3 sm:px-6 py-8 sm:py-12" aria-busy="true">
        <div className="container mx-auto max-w-7xl animate-pulse space-y-4">
          <div className="h-10 bg-muted rounded w-72" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="col-span-2 lg:row-span-2 h-56 lg:h-[516px] bg-muted rounded-2xl" />
            <div className="h-44 bg-muted rounded-2xl" />
            <div className="h-44 bg-muted rounded-2xl" />
          </div>
        </div>
      </section>
    );
  }

  const featured = posts[0];
  const articleIsNew =
    !!article && Date.now() - new Date(article.published_at || article.created_at).getTime() < NEW_FOR_MS;
  // Up to 4 small tiles: the next posts, with the latest article taking the last spot.
  const tilePosts = posts.slice(1, article ? 4 : 5);

  return (
    <section className="px-3 sm:px-6 py-8 sm:py-12 relative" aria-labelledby="home-wall-title">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="flex items-end justify-between gap-3 mb-4 sm:mb-6">
          <div className="min-w-0">
            <p className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.16em] text-primary">Fan Wall</p>
            <h2
              id="home-wall-title"
              className="font-display text-3xl sm:text-5xl leading-none tracking-wide text-foreground mt-0.5 flex items-center gap-2"
            >
              <img src={logo} alt="" className="w-7 h-7 sm:w-10 sm:h-10 shrink-0" />
              <span>
                MetsXMFanZone <span className="text-primary">Feed</span>
              </span>
            </h2>
            <p className="hidden sm:block text-sm sm:text-base text-muted-foreground mt-1">
              Fresh posts from Mets fans, featured and newest first.
            </p>
          </div>
          <button
            type="button"
            onClick={openWall}
            className="shrink-0 h-11 px-4 sm:px-7 rounded-full bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity inline-flex items-center gap-1.5"
          >
            Open the wall <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {posts.length === 0 && !article ? (
          <div className="bg-card/60 border border-border/40 rounded-2xl p-8 text-center">
            <MessageSquare className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Be the first to post on the wall!</p>
            <button
              type="button"
              onClick={openWall}
              className="mt-4 h-11 px-6 rounded-full bg-primary text-primary-foreground text-sm font-bold"
            >
              Start a post
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 lg:grid-rows-[250px_250px] gap-3 sm:gap-4">
            {/* Featured */}
            {featured && (
              <motion.button
                type="button"
                onClick={openWall}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4 }}
                className="group relative col-span-2 lg:row-span-2 h-[230px] sm:h-[300px] lg:h-auto rounded-2xl overflow-hidden border border-border/30 bg-gradient-to-br from-secondary via-muted to-background text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              >
                {featured.image_url && (
                  <img
                    src={featured.image_url}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/95" />
                <span className="absolute top-3 left-3 sm:top-4 sm:left-4 inline-flex items-center gap-1 rounded-full bg-[#c93b00] text-white text-[11px] sm:text-xs font-bold uppercase tracking-wider px-2.5 py-1">
                  {featured.is_pinned && <Pin className="w-3 h-3" />} Featured
                </span>
                <div className="absolute left-3.5 right-3.5 bottom-3.5 sm:left-5 sm:right-5 sm:bottom-5">
                  <div className="flex items-center gap-2">
                    <Avatar letter={authorInitial(featured)} size={30} admin={featured.isAdmin} />
                    <span className="text-sm font-bold text-foreground">{authorName(featured)}</span>
                    <span className="text-xs text-muted-foreground">{timeAgo(featured.created_at)} ago</span>
                  </div>
                  {featured.content && (
                    <p className="mt-2 text-base sm:text-xl lg:text-2xl font-bold leading-snug text-foreground line-clamp-3">
                      {featured.content}
                    </p>
                  )}
                </div>
              </motion.button>
            )}

            {/* Small tiles */}
            {tilePosts.map((post, i) => {
              const hasImage = !!post.image_url;
              return (
                <motion.button
                  type="button"
                  key={post.id}
                  onClick={openWall}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  className={`group text-left rounded-2xl overflow-hidden border border-border/30 bg-card/80 hover:border-primary/50 transition-colors flex flex-col focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
                    hasImage ? "" : "border-t-[3px] border-t-primary"
                  }`}
                >
                  {hasImage && (
                    <div className="h-[100px] lg:h-[125px] overflow-hidden bg-muted shrink-0">
                      <img
                        src={post.image_url!}
                        alt=""
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>
                  )}
                  <div className="p-2.5 sm:p-3">
                    <div className="flex items-center gap-1.5">
                      <Avatar letter={authorInitial(post)} size={22} admin={post.isAdmin} />
                      <span className="text-[13px] sm:text-sm font-bold text-foreground truncate">{authorName(post)}</span>
                      <span className="text-[11px] sm:text-xs text-muted-foreground shrink-0">{timeAgo(post.created_at)}</span>
                    </div>
                    {post.content && (
                      <p
                        className={`mt-1.5 leading-snug ${
                          hasImage
                            ? "text-[13px] sm:text-sm text-muted-foreground line-clamp-2"
                            : "text-[15px] sm:text-lg font-semibold text-foreground line-clamp-5"
                        }`}
                      >
                        {post.content}
                      </p>
                    )}
                  </div>
                </motion.button>
              );
            })}

            {/* Latest blog article */}
            {article && (
              <motion.a
                href={`/blog/${article.slug}`}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="group rounded-2xl overflow-hidden border border-border/30 bg-card/80 hover:border-primary/50 transition-colors flex flex-col focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              >
                <div className="relative h-[100px] lg:h-[125px] overflow-hidden bg-gradient-to-br from-muted to-secondary shrink-0">
                  {article.featured_image_url && (
                    <img
                      src={article.featured_image_url}
                      alt=""
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  )}
                  {articleIsNew && (
                    <span className="absolute top-2 left-2 rounded-full bg-[#c93b00] text-white text-[10px] sm:text-[11px] font-bold uppercase tracking-wider px-2 py-0.5">
                      New article
                    </span>
                  )}
                </div>
                <div className="p-2.5 sm:p-3">
                  <p className="text-[13px] sm:text-sm font-bold text-foreground leading-snug line-clamp-3">{article.title}</p>
                </div>
              </motion.a>
            )}
          </div>
        )}

        {/* Join strip */}
        <div className="mt-4 sm:mt-5 rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 via-card/80 to-secondary/30 px-4 py-3.5 sm:px-5 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="font-bold text-foreground text-[15px] sm:text-base">Ready to join the conversation?</p>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Share your takes, reactions and highlights with fellow Mets fans.
            </p>
          </div>
          <button
            type="button"
            onClick={openWall}
            className="h-11 px-7 rounded-full bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity shrink-0"
          >
            Get started
          </button>
        </div>
      </div>
    </section>
  );
};

export default CommunityPreviewSection;
