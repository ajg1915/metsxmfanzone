import { cn } from "@/lib/utils";

export interface TVRailItem {
  id: string;
  title: string;
  thumbnail: string;
  badge?: string;
  subtitle?: string;
  isLive?: boolean;
  /** Logos and portraits: show the whole image on a coloured card instead of cropping it. */
  fit?: "cover" | "contain";
  bg?: string;
}

interface TVContentRailProps {
  title: string;
  note?: string;
  items: TVRailItem[];
  accent?: boolean;
  onItemClick?: (item: TVRailItem) => void;
}

// Row of large cards for the couch: big type, wide cards, and a focus treatment
// that comes from the global .tv-mode :focus-visible ring (white outline + lift).
export function TVContentRail({ title, note, items: rawItems, accent, onItemClick }: TVContentRailProps) {
  if (rawItems.length === 0) return null;

  // Anything live goes to the front of its row; the rest keep their order.
  const isLiveItem = (i: TVRailItem) => !!i.isLive || i.badge === "LIVE";
  const items = [...rawItems].sort((a, b) => Number(isLiveItem(b)) - Number(isLiveItem(a)));

  return (
    <section className="group/rail relative mt-[2.4vh]" aria-label={title}>
      <div className="flex items-center gap-3 mb-[1.4vh] pl-[0.2vw]">
        {accent && <span className="h-3 w-3 rounded-full bg-[color:var(--tv-accent)] animate-pulse" />}
        <span aria-hidden="true" className="h-[1.2rem] w-[4px] rounded-full bg-[color:var(--tv-accent)]" />
        <h2 className={cn("text-[1.1rem] font-bold", accent ? "text-[color:var(--tv-accent)]" : "text-[color:var(--tv-text)]")}>{title}</h2>
        {note && <span className="text-[0.85rem] text-[color:var(--tv-subtext)]">{note}</span>}
        {items.length > 1 && (
          <span className="ml-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[0.8rem] text-[color:var(--tv-subtext)] opacity-0 transition-opacity duration-200 group-focus-within/rail:opacity-100 group-hover/rail:opacity-100">
            <span aria-hidden="true">◀</span> Use left and right to browse <span aria-hidden="true">▶</span>
          </span>
        )}
      </div>

      {items.length > 1 && (
        <>
          <span aria-hidden="true" className="pointer-events-none absolute left-0 top-[calc(1.1rem+3vh)] z-10 flex h-[calc(20vw*9/16)] min-h-[135px] w-[3.2vw] min-w-[44px] items-center justify-start bg-gradient-to-r from-[color:var(--tv-bg)] to-transparent pl-1 text-[2rem] text-white opacity-0 transition-opacity duration-200 group-focus-within/rail:opacity-100 group-hover/rail:opacity-100 animate-[tv-nudge-left_1.2s_ease-in-out_infinite]">‹</span>
          <span aria-hidden="true" className="pointer-events-none absolute right-0 top-[calc(1.1rem+3vh)] z-10 flex h-[calc(20vw*9/16)] min-h-[135px] w-[3.2vw] min-w-[44px] items-center justify-end bg-gradient-to-l from-[color:var(--tv-bg)] to-transparent pr-1 text-[2rem] text-white opacity-0 transition-opacity duration-200 group-focus-within/rail:opacity-100 group-hover/rail:opacity-100 animate-[tv-nudge-right_1.2s_ease-in-out_infinite]">›</span>
        </>
      )}

      <div className="flex gap-[1vw] overflow-x-auto px-[0.6vw] py-[1.8vh] scrollbar-none">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onItemClick?.(item)}
            onFocus={(e) =>
              e.currentTarget.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" })
            }
            className="group shrink-0 w-[20vw] min-w-[260px] rounded-[0.6rem] text-left focus:outline-none"
          >
            <div
              className="relative aspect-video w-full overflow-hidden rounded-[0.6rem] bg-[color:var(--tv-surface)] border border-white/5"
              style={item.bg ? { background: item.bg } : undefined}
            >
              <img
                src={item.thumbnail}
                alt=""
                loading="lazy"
                className={item.fit === "contain" ? "h-full w-full object-contain p-[6%]" : "h-full w-full object-cover"}
              />
              {item.badge && (
                <span
                  className={cn(
                    "absolute top-3 left-3 rounded-md px-3 py-1 text-[0.7rem] font-bold uppercase tracking-wider text-white",
                    item.badge === "LIVE" ? "bg-[#e11d48]" : "bg-black/70",
                  )}
                >
                  {item.badge}
                </span>
              )}
            </div>
            <p className="mt-[1vh] pl-[0.2vw] text-[0.85rem] font-medium leading-tight text-[color:var(--tv-text)] line-clamp-2">
              {item.title}
            </p>
            {item.subtitle && (
              <p className="mt-[0.3vh] pl-[0.2vw] text-[0.75rem] leading-tight text-[color:var(--tv-subtext)] line-clamp-1">
                {item.subtitle}
              </p>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}
