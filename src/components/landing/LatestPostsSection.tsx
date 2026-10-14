import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sectionStyle, type SectionStyle } from "@/lib/frontPageSections";

// "Latest from the FanZone": the 4 newest published blog posts, on the signed-out front page.

type Post = {
  id: string;
  title: string;
  slug: string;
  featured_image_url: string | null;
  published_at: string | null;
  created_at: string;
};

const fmtDate = (p: Post) => {
  const d = new Date(p.published_at || p.created_at);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

export default function LatestPostsSection({ bg }: { bg?: SectionStyle }) {
  const { data: posts = [] } = useQuery({
    queryKey: ["landing-latest-posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("id, title, slug, featured_image_url, published_at, created_at")
        .eq("published", true)
        .order("published_at", { ascending: false })
        .limit(4);
      if (error) throw error;
      return (data || []) as Post[];
    },
    staleTime: 10 * 60_000,
  });

  if (posts.length === 0) return null;

  return (
    <section id="latest" className="relative overflow-hidden px-4 py-14 sm:px-6" style={sectionStyle(bg, { backgroundColor: "#07101f" })}>
      <div className="mx-auto max-w-[1240px]">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-[#ff7a3d]">The blog</p>
            <h2 className="mt-1.5 font-display text-[clamp(32px,4vw,48px)] uppercase leading-none text-white">Latest from the FanZone</h2>
          </div>
          <Link to="/blog" className="inline-flex min-h-[44px] items-center font-bold text-[#ff7a3d] hover:underline">
            All articles
          </Link>
        </div>
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
          {posts.map((p) => (
            <Link key={p.id} to={`/blog/${p.slug}`} className="group flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0d1a2e] hover:border-[#ff5910]/60">
              <div className="aspect-video bg-gradient-to-br from-[#1b3d6b] to-[#13233d]">
                {p.featured_image_url && <img src={p.featured_image_url} alt="" loading="lazy" className="h-full w-full object-cover" />}
              </div>
              <div className="flex flex-1 flex-col gap-2 p-4">
                <h3 className="line-clamp-3 text-[17px] font-bold leading-snug text-white">{p.title}</h3>
                <p className="mt-auto text-sm text-[#a9b7cb]">{fmtDate(p)}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
