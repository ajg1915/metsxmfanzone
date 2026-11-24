import { Link, useLocation } from "react-router-dom";
import { Gift, ShieldCheck, Truck } from "lucide-react";

// Shared look for the two stores: /shop (Mets tees) and /merch (MetsXMFanZone gear).

const STORES = [
  { to: "/shop", label: "Mets Shop" },
  { to: "/merch", label: "MetsXMFanZone Merch" },
];

export function StoreHero({ title, subtitle, perks }: { title: string; subtitle: string; perks: { icon: "truck" | "gift" | "shield"; text: string }[] }) {
  const { pathname } = useLocation();
  const Icon = { truck: Truck, gift: Gift, shield: ShieldCheck };
  return (
    <header className="relative overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(120%_140%_at_0%_0%,#0b3a8c_0%,#08224f_45%,#061430_100%)] px-5 pb-5 pt-6 text-white sm:px-10 sm:pb-8 sm:pt-9">
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#FF5910]/25 blur-3xl" />
      <nav aria-label="Stores" className="relative mb-5 inline-flex rounded-full bg-black/30 p-1 text-[13px] font-bold">
        {STORES.map((s) => (
          <Link key={s.to} to={s.to} aria-current={pathname === s.to ? "page" : undefined}
            className={`rounded-full px-3.5 py-1.5 transition-colors sm:px-4 ${pathname === s.to ? "bg-[#FF5910] text-white" : "text-white/70 hover:text-white"}`}>
            {s.label}
          </Link>
        ))}
      </nav>
      <h1 className="relative font-display break-words text-[34px] uppercase leading-[0.95] tracking-wide sm:text-6xl">{title}</h1>
      <p className="relative mt-2 max-w-xl text-[15px] leading-relaxed text-white/75 sm:text-base">{subtitle}</p>
      <ul className="relative -mx-5 mt-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        {perks.map((p) => {
          const I = Icon[p.icon];
          return (
            <li key={p.text} className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[12.5px] font-semibold text-white/90">
              <I className="h-3.5 w-3.5 text-[#FF5910]" /> {p.text}
            </li>
          );
        })}
      </ul>
    </header>
  );
}

// One product tile. Same look on both stores.
export function StoreCard({ image, altImage, title, price, meta, badge, soldOut, swatches, onOpen }: {
  image: string; altImage?: string; title: string; price: string; meta?: string; badge?: string; soldOut?: boolean;
  swatches?: string[]; onOpen: () => void;
}) {
  return (
    <button type="button" onClick={onOpen}
      className="group flex w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0d1a2e] text-left shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] transition hover:-translate-y-0.5 hover:border-[#FF5910]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5910]">
      <div className="relative aspect-[4/5] overflow-hidden bg-[#e9ecf1]">
        <img src={image} alt={title} loading="lazy" className={`absolute inset-0 h-full w-full object-cover transition duration-500 ${altImage ? "group-hover:opacity-0" : "group-hover:scale-[1.04]"} ${soldOut ? "opacity-50 grayscale" : ""}`} />
        {altImage && <img src={altImage} alt="" aria-hidden loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-0 transition duration-500 group-hover:opacity-100" />}
        {(badge || soldOut) && (
          <span className={`absolute left-2.5 top-2.5 rounded-full px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-wide shadow ${soldOut ? "bg-black/80 text-white" : "bg-[#FF5910] text-white"}`}>
            {soldOut ? "Sold out" : badge}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3 sm:p-4">
        <h3 className="line-clamp-2 min-h-[2.6em] text-[13.5px] font-semibold leading-[1.3] text-white sm:text-[15px]">{title}</h3>
        <div className="mt-auto flex items-end justify-between gap-2 pt-1">
          <p className="text-[17px] font-extrabold text-[#FF5910] sm:text-lg" style={{ fontVariantNumeric: "tabular-nums" }}>{price}</p>
          {swatches && (
            <span className="flex -space-x-1" aria-hidden>
              {swatches.map((c) => <span key={c} className="h-3.5 w-3.5 rounded-full border border-white/40" style={{ backgroundColor: c }} />)}
            </span>
          )}
        </div>
        {meta && <p className="truncate text-[11.5px] text-white/50">{meta}</p>}
      </div>
    </button>
  );
}

export function ComingSoonCard() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 p-4 text-center sm:p-6">
      <p className="font-display text-xl uppercase tracking-wide text-white/80 sm:text-2xl">More drops soon</p>
      <p className="mt-1 text-xs text-white/50">New Mets tees are added often. Check back.</p>
    </div>
  );
}

export const storeGrid = "mt-6 grid grid-cols-2 gap-3 sm:mt-8 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4";

// Store pop-ups: a bottom sheet on phones (full width, fits under the keyboard), a centered card on bigger screens.
export const storeSheet =
  "grid-cols-[minmax(0,1fr)] gap-3 border-white/10 bg-[#0b1426] text-white " +
  "max-sm:inset-x-0 max-sm:bottom-0 max-sm:left-0 max-sm:top-auto max-sm:w-full max-sm:max-w-full max-sm:translate-x-0 max-sm:translate-y-0 " +
  "max-sm:rounded-b-none max-sm:rounded-t-2xl max-sm:max-h-[90dvh] max-sm:px-4 max-sm:pb-[max(1rem,env(safe-area-inset-bottom))] max-sm:pt-4 " +
  "max-sm:data-[state=closed]:slide-out-to-left-0 max-sm:data-[state=open]:slide-in-from-left-0 max-sm:data-[state=closed]:slide-out-to-top-full max-sm:data-[state=open]:slide-in-from-top-full";
