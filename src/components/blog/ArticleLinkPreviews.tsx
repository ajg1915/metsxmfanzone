import { useEffect, useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

interface Preview {
  url: string;
  title: string | null;
  description: string | null;
  site: string | null;
  image: string | null;
}

const SITE_HOSTS = ["metsxmfanzone.com", "www.metsxmfanzone.com", "localhost"];

/** Collects external links that appear in the article body. */
function extractLinks(content: string): string[] {
  if (!content) return [];
  const found = new Set<string>();

  const hrefRe = /href=["'](https?:\/\/[^"'\s]+)["']/gi;
  const bareRe = /(?<!["'=])(https?:\/\/[^\s<>"')]+)/gi;

  for (const re of [hrefRe, bareRe]) {
    let match: RegExpExecArray | null;
    while ((match = re.exec(content))) {
      const raw = (match[1] || "").replace(/[.,)]+$/, "");
      try {
        const parsed = new URL(raw);
        if (SITE_HOSTS.includes(parsed.hostname)) continue;
        found.add(parsed.toString());
      } catch {
        // ignore malformed urls
      }
    }
  }

  return Array.from(found).slice(0, 6);
}

export default function ArticleLinkPreviews({ content }: { content: string }) {
  const links = useMemo(() => extractLinks(content), [content]);
  const [previews, setPreviews] = useState<Preview[]>([]);

  useEffect(() => {
    if (links.length === 0) {
      setPreviews([]);
      return;
    }

    let cancelled = false;

    (async () => {
      const results = await Promise.all(
        links.map(async (url) => {
          try {
            const { data, error } = await supabase.functions.invoke("iframely-preview", {
              body: { url },
            });
            if (error || !data?.title) return null;
            return data as Preview;
          } catch {
            return null;
          }
        })
      );

      if (!cancelled) {
        setPreviews(results.filter(Boolean) as Preview[]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [links]);

  if (previews.length === 0) return null;

  return (
    <section className="mt-8 space-y-3" aria-label="Links mentioned in this article">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Links in this article
      </h2>
      {previews.map((preview) => (
        <a
          key={preview.url}
          href={preview.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block transition-transform hover:-translate-y-0.5"
        >
          <Card className="overflow-hidden border-border/60 bg-card/90 backdrop-blur">
            <CardContent className="flex gap-4 p-4">
              {preview.image && (
                <img
                  src={preview.image}
                  alt=""
                  loading="lazy"
                  className="h-20 w-28 flex-shrink-0 rounded-md object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              )}
              <div className="min-w-0">
                <p className="line-clamp-2 font-semibold leading-snug">{preview.title}</p>
                {preview.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {preview.description}
                  </p>
                )}
                <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                  <ExternalLink className="h-3 w-3" />
                  {preview.site || new URL(preview.url).hostname}
                </p>
              </div>
            </CardContent>
          </Card>
        </a>
      ))}
    </section>
  );
}
