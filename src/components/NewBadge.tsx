import { cn } from "@/lib/utils";

export type NewBadgeKind = "article" | "episode" | "upload" | "gametime" | "live";

const LABEL: Record<NewBadgeKind, string> = {
  article: "New article",
  episode: "New episode",
  upload: "New upload",
  gametime: "Game time",
  live: "Live now",
};

// Orange for live and time-sensitive things, blue for new content.
const TONE: Record<NewBadgeKind, string> = {
  article: "bg-[#c93b00] text-white",
  gametime: "bg-[#c93b00] text-white",
  live: "bg-[#c93b00] text-white",
  episode: "bg-[#0b3e75] text-white ring-1 ring-white/30",
  upload: "bg-[#0b3e75] text-white ring-1 ring-white/30",
};

interface NewBadgeProps {
  kind: NewBadgeKind;
  /** Position it yourself, e.g. "absolute top-2 left-2". */
  className?: string;
  /** Smaller pill for tight thumbnails. */
  small?: boolean;
}

const NewBadge = ({ kind, className, small = false }: NewBadgeProps) => (
  <span
    className={cn(
      "inline-flex items-center rounded-full font-bold uppercase tracking-wider whitespace-nowrap",
      small ? "px-1.5 py-0.5 text-[9px]" : "px-2.5 py-1 text-[10px] sm:text-[11px]",
      TONE[kind],
      className,
    )}
  >
    {kind === "live" && <span className="mr-1 h-1.5 w-1.5 rounded-full bg-white" aria-hidden="true" />}
    {LABEL[kind]}
  </span>
);

export default NewBadge;
