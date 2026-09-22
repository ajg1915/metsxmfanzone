import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, LucideIcon } from "lucide-react";

/**
 * Shared admin page primitives, styled to match Blog Management:
 * compact header row, search + filter chips, tight list cards.
 */

export function AdminPage({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-3 w-full max-w-full overflow-hidden px-1">{children}</div>
  );
}

export function AdminPageHeader({
  icon: Icon,
  title,
  count,
  countLabel = "total",
  description,
  actions,
}: {
  icon?: LucideIcon;
  title: string;
  count?: number;
  countLabel?: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 flex-wrap">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {Icon && <Icon className="w-4 h-4 text-primary flex-shrink-0" />}
          <h1 className="text-sm sm:text-base font-bold truncate">{title}</h1>
          {typeof count === "number" && (
            <Badge variant="outline" className="text-[9px] h-5">
              {count} {countLabel}
            </Badge>
          )}
        </div>
        {description && (
          <p className="text-[10px] text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-1.5 flex-wrap">{actions}</div>}
    </div>
  );
}

export function AdminSearch({
  value,
  onChange,
  placeholder = "Search…",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative flex-1 min-w-[180px]">
      <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-8 text-xs pl-6"
      />
    </div>
  );
}

export interface AdminFilter {
  key: string;
  label: string;
  count?: number;
}

export function AdminToolbar({ children }: { children: ReactNode }) {
  return <div className="flex items-center gap-2 flex-wrap">{children}</div>;
}

export function AdminFilterChips({
  filters,
  active,
  onChange,
}: {
  filters: AdminFilter[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="flex gap-1 flex-wrap">
      {filters.map((f) => (
        <Button
          key={f.key}
          variant={active === f.key ? "default" : "outline"}
          size="sm"
          className="h-7 text-[10px] px-2"
          onClick={() => onChange(f.key)}
        >
          {f.label}
          {typeof f.count === "number" && (
            <span className="ml-1 opacity-60">{f.count}</span>
          )}
        </Button>
      ))}
    </div>
  );
}

export function AdminList({ children }: { children: ReactNode }) {
  return <div className="space-y-1.5">{children}</div>;
}

export function AdminListCard({
  children,
  highlight,
  className = "",
}: {
  children: ReactNode;
  highlight?: boolean;
  className?: string;
}) {
  return (
    <Card className={`border-border/30 ${highlight ? "border-yellow-500/50" : ""} ${className}`}>
      <CardContent className="p-2.5 space-y-1.5">{children}</CardContent>
    </Card>
  );
}

export function AdminRow({
  title,
  meta,
  badges,
  actions,
  body,
}: {
  title: ReactNode;
  meta?: ReactNode;
  badges?: ReactNode;
  actions?: ReactNode;
  body?: ReactNode;
}) {
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-medium truncate">{title}</span>
            {badges}
          </div>
          {meta && (
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{meta}</p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-0.5 flex-shrink-0 flex-wrap">{actions}</div>
        )}
      </div>
      {body}
    </>
  );
}

export function AdminEmpty({ message = "Nothing here yet." }: { message?: string }) {
  return (
    <Card className="border-border/30">
      <CardContent className="py-6 text-center text-xs text-muted-foreground">
        {message}
      </CardContent>
    </Card>
  );
}

export function AdminLoading({ label = "Loading…" }: { label?: string }) {
  return <div className="p-4 text-sm text-muted-foreground">{label}</div>;
}

export function AdminStat({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon?: LucideIcon;
  label: string;
  value: ReactNode;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const toneClass =
    tone === "success"
      ? "text-green-400"
      : tone === "warning"
      ? "text-yellow-400"
      : tone === "danger"
      ? "text-red-400"
      : "text-primary";
  return (
    <Card className="border-border/30">
      <CardContent className="p-2.5">
        <div className="flex items-center gap-1.5">
          {Icon && <Icon className={`w-3 h-3 ${toneClass}`} />}
          <span className="text-[10px] text-muted-foreground truncate">{label}</span>
        </div>
        <div className={`text-base font-bold mt-0.5 ${toneClass}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

export function AdminStatGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">{children}</div>;
}

/** Small icon-only action button used in list rows. */
export function AdminIconButton({
  icon: Icon,
  title,
  onClick,
  tone = "default",
  disabled,
}: {
  icon: LucideIcon;
  title: string;
  onClick: () => void;
  tone?: "default" | "primary" | "success" | "danger";
  disabled?: boolean;
}) {
  const toneClass =
    tone === "primary"
      ? "text-primary"
      : tone === "success"
      ? "text-green-500"
      : tone === "danger"
      ? "text-red-400"
      : "";
  return (
    <Button
      variant="ghost"
      size="sm"
      className={`h-7 px-1.5 ${toneClass}`}
      title={title}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon className="w-3 h-3" />
    </Button>
  );
}
