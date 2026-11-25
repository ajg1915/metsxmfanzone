import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

import { listPublishedArticles } from "@/lib/articlesApi";
interface RelatedPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  featured_image_url: string | null;
  category: string;
  published_at: string | null;
}

interface RelatedPostsProps {
  currentPostId: string;
  category: string;
  tags: string[];
}

export default function RelatedPosts({ currentPostId, category, tags }: RelatedPostsProps) {
  const [posts, setPosts] = useState<RelatedPost[]>([]);

  useEffect(() => {
    const fetchRelated = async () => {
      // Fetch posts from same category, excluding current
      const data = await listPublishedArticles({ category, exclude: currentPostId, limit: 6 }).catch(() => []);

      if (data && data.length > 0) {
        setPosts(data as unknown as RelatedPost[]);
      } else {
        // Fallback: fetch latest posts
        const latest = await listPublishedArticles({ exclude: currentPostId, limit: 4 }).catch(() => []);
        setPosts(latest as unknown as RelatedPost[]);
      }
    };
    fetchRelated();
  }, [currentPostId, category]);

  if (posts.length === 0) return null;

  return (
    <section className="mt-12" aria-label="Related articles">
      <h2 className="text-2xl font-bold text-foreground mb-6">Related Articles</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {posts.slice(0, 3).map((post) => (
          <Link key={post.id} to={`/blog/${post.slug}`} className="group">
            <Card className="h-full hover:border-primary/30 transition-all overflow-hidden">
              {post.featured_image_url && (
                <div className="aspect-video overflow-hidden">
                  <img
                    src={post.featured_image_url}
                    alt={post.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                </div>
              )}
              <CardContent className="p-4">
                <span className="text-xs font-medium text-primary uppercase tracking-wider">
                  {post.category}
                </span>
                <h3 className="font-semibold text-foreground mt-1 line-clamp-2 group-hover:text-primary transition-colors">
                  {post.title}
                </h3>
                {post.excerpt && (
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{post.excerpt}</p>
                )}
                {post.published_at && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-3">
                    <Calendar className="w-3 h-3" />
                    {new Date(post.published_at).toLocaleDateString()}
                  </div>
                )}
                <span className="inline-flex items-center gap-1 text-xs text-primary mt-2 font-medium group-hover:underline">
                  Read more <ArrowRight className="w-3 h-3" />
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
