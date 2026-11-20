import { Link } from "react-router-dom";
import { ShoppingBag, ChevronRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { MERCH, merchFrom, merchImage, merchMoney } from "@/lib/merchCatalog";

// "MetsXMFanZone Gear" strip for the live player page. Signed-in members only:
// signed-out visitors never see it.
export default function MemberGearSection({ className = "" }: { className?: string }) {
  const { user } = useAuth();
  if (!user) return null;
  const items = MERCH.filter((m) => !m.hidden);
  return (
    <section aria-labelledby="member-gear" className={`rounded-2xl border border-border/60 bg-card/70 p-3 sm:p-4 ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="member-gear" className="flex items-center gap-2 font-display text-lg font-bold uppercase tracking-wide text-foreground sm:text-xl">
          <ShoppingBag className="h-5 w-5 text-primary" /> MetsXMFanZone Gear
        </h2>
        <Link to="/merch" className="inline-flex items-center gap-0.5 text-sm font-bold text-primary">
          Shop all <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
        {items.map((m) => (
          <Link key={m.sku} to="/merch" className="group overflow-hidden rounded-xl border border-border/50 bg-background/40 transition-colors hover:border-primary/60">
            <div className="aspect-square overflow-hidden bg-[#0d1b30]">
              <img src={merchImage(m.sku, "royal")} alt={m.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
            </div>
            <div className="p-2.5">
              <p className="line-clamp-1 text-[13px] font-semibold text-foreground">{m.title.replace("MetsXMFanZone ", "")}</p>
              <p className="text-sm font-extrabold text-primary">{merchFrom(m) === 15 || m.sku === "hoodie" || m.sku === "jacket" ? merchMoney(merchFrom(m)) : `From ${merchMoney(merchFrom(m))}`}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
