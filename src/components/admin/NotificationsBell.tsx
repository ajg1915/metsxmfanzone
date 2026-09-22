import { useEffect, useState } from "react";
import { AlertTriangle, Bell, UserPlus, CreditCard, MessageSquare, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";

type Item = {
  id: string;
  type: "signup" | "subscription" | "contact" | "stream_issue";
  title: string;
  subtitle: string;
  created_at: string;
  href: string;
};

export function NotificationsBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);

  const load = async () => {
    setLoading(true);
    try {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const [profilesRes, subsRes, contactsRes, issuesRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, email, created_at")
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("subscriptions")
          .select("id, plan_type, status, amount, created_at, user_id")
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("contact_submissions")
          .select("id, name, subject, created_at")
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("stream_health_reports")
          .select("id, issue_type, severity, description, created_at")
          .ilike("description", "[Viewer ticket]%")
          .eq("resolved", false)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      const merged: Item[] = [];
      (profilesRes.data || []).forEach((p: any) =>
        merged.push({
          id: `signup-${p.id}`,
          type: "signup",
          title: "New signup",
          subtitle: p.full_name || p.email || "New member",
          created_at: p.created_at,
          href: "/admin/user-management",
        })
      );
      (subsRes.data || []).forEach((s: any) =>
        merged.push({
          id: `sub-${s.id}`,
          type: "subscription",
          title: `Subscription ${s.status}`,
          subtitle: `${s.plan_type} • $${s.amount ?? 0}`,
          created_at: s.created_at,
          href: "/admin/user-management",
        })
      );
      (contactsRes.data || []).forEach((c: any) =>
        merged.push({
          id: `contact-${c.id}`,
          type: "contact",
          title: "Contact message",
          subtitle: `${c.name || "Anon"}: ${c.subject || "(no subject)"}`,
          created_at: c.created_at,
          href: "/admin/contact-submissions",
        })
      );
      (issuesRes.data || []).forEach((issue: any) =>
        merged.push({
          id: `stream-${issue.id}`,
          type: "stream_issue",
          title: `${issue.severity} stream issue`,
          subtitle: issue.issue_type,
          created_at: issue.created_at,
          href: "/admin/stream-issues",
        })
      );

      merged.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
      const top = merged.slice(0, 20);
      setItems(top);

      const lastSeen = localStorage.getItem("admin_notifications_last_seen");
      const lastSeenDate = lastSeen ? new Date(lastSeen) : new Date(0);
      setUnread(top.filter((i) => new Date(i.created_at) > lastSeenDate).length);
    } catch (e) {
      console.error("notifications load error", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, []);

  const handleOpen = (next: boolean) => {
    setOpen(next);
    if (next) {
      localStorage.setItem("admin_notifications_last_seen", new Date().toISOString());
      setUnread(0);
    }
  };

  const iconFor = (t: Item["type"]) =>
    t === "signup" ? UserPlus : t === "subscription" ? CreditCard : t === "stream_issue" ? AlertTriangle : MessageSquare;

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/5 transition-all hidden sm:inline-flex"
          title="Notifications"
        >
          <Bell className="w-4 h-4" />
          {unread > 0 && (
            <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 text-[9px] font-bold text-white bg-[#FF5910] rounded-full flex items-center justify-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 p-0 bg-[#0b1220] border-white/10 text-slate-200"
      >
        <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between">
          <span className="text-xs font-semibold text-white">Notifications</span>
          <span className="text-[10px] text-slate-500">Last 7 days</span>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {loading && items.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
            </div>
          ) : items.length === 0 ? (
            <div className="px-3 py-8 text-center text-xs text-slate-500">
              No new activity
            </div>
          ) : (
            items.map((item) => {
              const Icon = iconFor(item.type);
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setOpen(false);
                    navigate(item.href);
                  }}
                  className="w-full flex items-start gap-2.5 px-3 py-2.5 hover:bg-white/5 border-b border-white/5 text-left"
                >
                  <div className="w-7 h-7 rounded-full bg-[#FF5910]/15 text-[#FF5910] flex items-center justify-center flex-shrink-0">
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-white truncate">
                      {item.title}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {item.subtitle}
                    </p>
                    <p className="text-[9px] text-slate-600 mt-0.5">
                      {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
