import { useQuery } from "@tanstack/react-query";
import { ExternalLink, ShoppingBag } from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";

type Item = { id: string; name: string; image: string; price: number | null; was: number | null; url: string; brand: string };
type ShopData = { configured: boolean; shopUrl: string; items: Item[] };

const money = (n: number) => `$${n.toFixed(2)}`;

const MetsShop = () => {
  const { data, isLoading } = useQuery<ShopData>({
    queryKey: ["mets-shop"],
    queryFn: async () => {
      const r = await fetch("/api/mets-shop");
      if (!r.ok) throw new Error("shop");
      return r.json();
    },
    staleTime: 30 * 60 * 1000,
  });
  const items = data?.items ?? [];
  const shopUrl = data?.shopUrl ?? "https://www.fanatics.com/mlb/new-york-mets/o-1306+t-47360259+z-9-1738925264";

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Mets Shop | Jerseys, Hats & Gear | MetsXMFanZone"
        description="Shop official New York Mets jerseys, hats, tees and gear from Fanatics, picked for MetsXMFanZone fans."
        canonical="https://metsxmfanzone.com/mets-shop"
      />
      <Navigation />
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-24 md:pt-28">
        <header className="rounded-2xl border-t-4 border-t-primary bg-gradient-to-b from-[hsl(var(--mets-blue))] to-[hsl(var(--mets-blue-dark))] p-6 text-center text-white sm:p-10">
          <ShoppingBag className="mx-auto h-9 w-9 text-primary" />
          <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">Mets Shop</h1>
          <p className="mx-auto mt-2 max-w-xl text-sm text-white/80 sm:text-base">
            Official New York Mets jerseys, hats, tees and more from Fanatics. Gear up for the next game.
          </p>
          <a
            href={shopUrl}
            target="_blank"
            rel="sponsored noopener noreferrer"
            className="mt-5 inline-flex min-h-[48px] items-center gap-2 rounded-full bg-primary px-6 font-bold text-primary-foreground shadow-lg active:scale-95"
          >
            Shop all Mets gear at Fanatics <ExternalLink className="h-4 w-4" />
          </a>
        </header>

        {isLoading && <p className="mt-10 text-center text-muted-foreground">Loading gear…</p>}

        {items.length > 0 && (
          <section className="mt-8 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4" aria-label="Mets gear">
            {items.map((i) => (
              <a
                key={i.id}
                href={i.url}
                target="_blank"
                rel="sponsored noopener noreferrer"
                className="group flex flex-col overflow-hidden rounded-xl border border-border/50 bg-card transition hover:border-primary/60"
              >
                <div className="aspect-square bg-white">
                  <img src={i.image} alt={i.name} loading="lazy" className="h-full w-full object-contain p-2" />
                </div>
                <div className="flex flex-1 flex-col gap-1 p-3">
                  <p className="line-clamp-2 text-sm font-semibold">{i.name}</p>
                  {i.price != null && (
                    <p className="mt-auto text-sm">
                      <span className="font-bold text-primary">{money(i.price)}</span>
                      {i.was != null && <span className="ml-2 text-xs text-muted-foreground line-through">{money(i.was)}</span>}
                    </p>
                  )}
                </div>
              </a>
            ))}
          </section>
        )}

        <p className="mt-10 text-center text-xs text-muted-foreground">
          MetsXMFanZone is an affiliate of Fanatics. If you buy through these links we may earn a commission at no extra cost to you.
          Prices and availability are set by Fanatics.
        </p>
      </main>
      <Footer />
    </div>
  );
};

export default MetsShop;
