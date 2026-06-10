import { Pencil } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSubscription } from "@/hooks/useSubscription";

interface AdminEditBadgeProps {
  /** Admin route to navigate to (e.g. /admin/hero) */
  to: string;
  /** Short label shown on hover/desktop */
  label?: string;
  /** Optional className for positioning override */
  className?: string;
}

/**
 * Floating "Edit" badge visible only to admins on the live site.
 * Tapping/clicking takes them straight to the matching admin page —
 * faster than digging through the sidebar.
 */
export function AdminEditBadge({ to, label = "Edit", className }: AdminEditBadgeProps) {
  const navigate = useNavigate();
  const { isAdmin } = useSubscription();

  if (!isAdmin) return null;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        navigate(to);
      }}
      title={`Edit (${to})`}
      className={
        className ??
        "absolute top-2 right-2 z-30 flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/90 hover:bg-primary text-primary-foreground text-[10px] font-semibold shadow-lg backdrop-blur-sm transition-all active:scale-95"
      }
    >
      <Pencil className="w-3 h-3" />
      <span>{label}</span>
    </button>
  );
}

export default AdminEditBadge;
