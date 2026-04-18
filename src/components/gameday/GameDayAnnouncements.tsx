import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Megaphone, X } from "lucide-react";

interface Announcement {
  id: string;
  title: string;
  message: string;
}

export function GameDayAnnouncements() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("gameday_announcements")
        .select("id, title, message")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(5);
      if (data) setItems(data as Announcement[]);
    };
    load();
    const channel = supabase
      .channel("gameday_announcements_live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "gameday_announcements" },
        load
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const visible = items.filter((i) => !dismissed.has(i.id));
  if (visible.length === 0) return null;

  return (
    <div className="space-y-2">
      {visible.map((a) => (
        <div
          key={a.id}
          className="flex items-start gap-3 rounded-lg border border-primary/40 bg-primary/10 backdrop-blur-sm px-4 py-3"
        >
          <Megaphone className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-primary">{a.title}</p>
            <p className="text-sm text-foreground/90 mt-0.5 whitespace-pre-wrap">{a.message}</p>
          </div>
          <button
            onClick={() => setDismissed((prev) => new Set(prev).add(a.id))}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
