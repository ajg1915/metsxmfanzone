import { cn } from "@/lib/utils";

export interface TVRailItem {
  id: string;
  title: string;
  thumbnail: string;
  badge?: string;
  subtitle?: string;
  isLive?: boolean;
}

interface TVContentRailProps {
  title: string;
  items: TVRailItem[];
  accent?: boolean;
  onItemClick?: (item: TVRailItem) => void;
}

// Row of large cards for the couch: big type, wide cards, and a focus treatment
// that comes from the global .tv-mode :focus-visible ring (white outline + lift).
export function TVContentRail({ title, items, accent, onItemClick }: TVContentRailProps) {
  if (items.length === 0) return null;

  return (
    <section className="mt-[4vh]" aria-label={title}>
      <div className="flex items-center gap-3 mb-[1.4vh] pl-[0.2vw]">
        {accent && <span className="h-3 w-3 rounded-full bg-[#ff5910] animate-pulse" />}
        <h2 className={cn("text-[1.7rem] font-medium", accent ? "text-[#ff5910]" : "text-[#f2f5fa]")}>{title}</h2>
      </div>

      <div className="flex gap-[1.2vw] overflow-x-auto px-[0.6vw] py-[1.8vh] scrollbar-none">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onItemClick?.(item)}
            onFocus={(e) =>
              e.currentTarget.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" })
            }
            className="group shrink-0 w-[22vw] min-w-[240px] rounded-[0.9rem] text-left focus:outline-none"
          >
            <div className="relative aspect-video w-full overflow-hidden rounded-[0.9rem] bg-[#17263f] border border-white/5">
              <img
                src={item.thumbnail}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
              />
              {item.badge && (
                <span
                  className={cn(
                    "absolute top-3 left-3 rounded-md px-3 py-1 text-[0.95rem] font-bold uppercase tracking-wider text-white",
                    item.badge === "LIVE" ? "bg-[#e11d48]" : "bg-black/70",
                  )}
                >
                  {item.badge}
                </span>
              )}
            </div>
            <p className="mt-[1vh] pl-[0.2vw] text-[1.25rem] font-medium leading-tight text-[#f2f5fa] line-clamp-2">
              {item.title}
            </p>
            {item.subtitle && (
              <p className="mt-[0.3vh] pl-[0.2vw] text-[1rem] leading-tight text-[#9fb0c9] line-clamp-1">
                {item.subtitle}
              </p>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}
