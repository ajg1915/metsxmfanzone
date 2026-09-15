import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar, Trophy } from "lucide-react";
import { format } from "date-fns";

type Recap = {
  id: string;
  title: string;
  slug: string;
  opponent: string | null;
  game_date: string | null;
  home_away: string | null;
  mets_score: number | null;
  opponent_score: number | null;
  result: string | null;
  summary: string | null;
  body: string | null;
  hero_image_url: string | null;
  published_at: string | null;
};

export default function MetsGameRecaps() {
  const { slug } = useParams();

  const list = useQuery({
    queryKey: ["public-game-recaps"],
    enabled: !slug,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("game_recaps" as any)
        .select("*")
        .eq("status", "published")
        .order("game_date", { ascending: false, nullsFirst: false })
        .order("published_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return (data || []) as unknown as Recap[];
    },
  });

  const single = useQuery({
    queryKey: ["public-game-recap", slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("game_recaps" as any)
        .select("*")
        .eq("slug", slug!)
        .eq("status", "published")
        .maybeSingle();
      if (error) throw error;
      return data as unknown as Recap | null;
    },
  });

  if (slug) {
    const r = single.data;
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <SEOHead
          title={r ? `${r.title} | Mets Game Recap` : "Mets Game Recap"}
          description={r?.summary || "Mets game recap"}
          canonical={`https://metsxmfanzone.com/mets-game-recaps/${encodeURIComponent(slug)}`}
          ogType="article"
          ogImage={r?.hero_image_url || "/share/mets-game-recaps.jpg"}
          ogImageAlt={r?.title || "Mets game recap"}
          publishedTime={r?.published_at || undefined}
        />
        <Navigation />
        <main className="flex-1 container mx-auto px-4 pt-20 pb-6 max-w-3xl">
          <Link
            to="/mets-game-recaps"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to all recaps
          </Link>
          {single.isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : !r ? (
            <p className="text-muted-foreground">Recap not found.</p>
          ) : (
            <article className="space-y-8">
              {r.hero_image_url && (
                <img src={r.hero_image_url} alt={r.title} className="w-full rounded-lg aspect-video object-cover" />
              )}
              <div className="flex flex-wrap gap-2">
                {r.result && (
                  <Badge variant={r.result === "W" ? "default" : "secondary"}>
                    {r.result === "W" ? "Win" : r.result === "L" ? "Loss" : "Tie"} · {r.mets_score}-{r.opponent_score}
                  </Badge>
                )}
                {r.opponent && (
                  <Badge variant="outline">
                    {r.home_away === "away" ? "@" : "vs"} {r.opponent}
                  </Badge>
                )}
                {r.game_date && (
                  <Badge variant="outline" className="gap-1">
                    <Calendar className="w-3 h-3" />
                    {format(new Date(r.game_date), "MMM d, yyyy")}
                  </Badge>
                )}
              </div>
              <h1 className="text-3xl font-bold">{r.title}</h1>
              {r.summary && <p className="text-lg text-muted-foreground">{r.summary}</p>}
              {r.body && <div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: r.body }} />}
            </article>
          )}
        </main>
        <Footer />
      </div>
    );
  }

  const recaps = list.data || [];
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEOHead
        title="Mets Game Recaps | MetsXMFanZone"
        description="Read the latest New York Mets game recaps with scores, highlights, and analysis."
        canonical="https://metsxmfanzone.com/mets-game-recaps"
        ogImage="/share/mets-game-recaps.jpg"
        ogImageAlt="Mets game recaps from MetsXMFanZone"
      />
      <Navigation />
      <main className="flex-1 container mx-auto px-4 pt-20 pb-6">
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <div className="flex items-center gap-3">
            <img src="/logo-192.png" alt="MetsXMFanZone" className="w-12 h-12 object-contain rounded-md" />
            <div>
              <h1 className="text-3xl font-bold">Mets Game Recaps</h1>
              <p className="text-sm text-muted-foreground">The latest recaps, scores, and analysis after every game.</p>
            </div>
          </div>
        </div>

        {list.isLoading ? (
          <p className="text-muted-foreground">Loading recaps...</p>
        ) : recaps.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              No recaps published yet. Check back after the next game!
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {recaps.map((r) => (
              <Link key={r.id} to={`/mets-game-recaps/${r.slug}`} className="group">
                <Card className="overflow-hidden bg-card/90 backdrop-blur hover:shadow-[0_0_24px_-6px_hsl(var(--primary)/0.5)] transition-all h-full">
                  {r.hero_image_url ? (
                    <img
                      src={r.hero_image_url}
                      alt={r.title}
                      className="w-full aspect-video object-cover group-hover:scale-[1.02] transition-transform"
                    />
                  ) : (
                    <div className="w-full aspect-video bg-gradient-to-br from-primary/30 to-orange-500/30 flex items-center justify-center">
                      <Trophy className="w-10 h-10 text-primary-foreground/70" />
                    </div>
                  )}
                  <CardContent className="p-4 space-y-2">
                    <div className="flex flex-wrap gap-1">
                      {r.result && (
                        <Badge variant={r.result === "W" ? "default" : "secondary"} className="text-[10px]">
                          {r.result} {r.mets_score}-{r.opponent_score}
                        </Badge>
                      )}
                      {r.opponent && (
                        <Badge variant="outline" className="text-[10px]">
                          {r.home_away === "away" ? "@" : "vs"} {r.opponent}
                        </Badge>
                      )}
                      {r.game_date && (
                        <Badge variant="outline" className="text-[10px]">
                          {format(new Date(r.game_date), "MMM d")}
                        </Badge>
                      )}
                    </div>
                    <h2 className="font-semibold leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                      {r.title}
                    </h2>
                    {r.summary && <p className="text-xs text-muted-foreground line-clamp-2">{r.summary}</p>}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
