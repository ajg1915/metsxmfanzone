import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Trash2, Crown, Shield, Star } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile?: {
    full_name: string | null;
    avatar_url: string | null;
  };
  tier?: "admin" | "annual" | "premium";
}

export function GameDayChat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  const hydrate = async (msgs: ChatMessage[]): Promise<ChatMessage[]> => {
    const ids = Array.from(new Set(msgs.map((m) => m.user_id)));
    if (!ids.length) return msgs;
    const [{ data: profiles }, { data: roles }, { data: subs }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, avatar_url").in("id", ids),
      supabase.from("user_roles").select("user_id, role").in("user_id", ids),
      supabase
        .from("subscriptions")
        .select("user_id, plan_type, status")
        .in("user_id", ids)
        .eq("status", "active"),
    ]);
    const pMap = new Map(profiles?.map((p) => [p.id, p]) || []);
    const rSet = new Set(roles?.filter((r) => r.role === "admin").map((r) => r.user_id) || []);
    const sMap = new Map(subs?.map((s) => [s.user_id, s.plan_type]) || []);
    return msgs.map((m) => ({
      ...m,
      profile: pMap.get(m.user_id),
      tier: rSet.has(m.user_id)
        ? "admin"
        : sMap.get(m.user_id) === "annual"
        ? "annual"
        : "premium",
    }));
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from("gameday_chat")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(100);
      if (!mounted || !data) return;
      const hydrated = await hydrate(data as ChatMessage[]);
      if (mounted) setMessages(hydrated);
    })();

    const channel = supabase
      .channel("gameday_chat_realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "gameday_chat" },
        async (payload) => {
          const [hydrated] = await hydrate([payload.new as ChatMessage]);
          setMessages((prev) => [...prev, hydrated].slice(-200));
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "gameday_chat" },
        (payload) => {
          setMessages((prev) => prev.filter((m) => m.id !== (payload.old as any).id));
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!user || !input.trim() || sending) return;
    setSending(true);
    const content = input.trim().slice(0, 500);
    setInput("");
    const { error } = await supabase.from("gameday_chat").insert({ user_id: user.id, content });
    if (error) {
      toast({ title: "Could not send", description: error.message, variant: "destructive" });
      setInput(content);
    }
    setSending(false);
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("gameday_chat").delete().eq("id", id);
    if (error) toast({ title: "Delete failed", variant: "destructive" });
  };

  const tierBadge = (tier?: string) => {
    if (tier === "admin")
      return <Shield className="w-3 h-3 text-orange-400" aria-label="Admin" />;
    if (tier === "annual")
      return <Crown className="w-3 h-3 text-yellow-400" aria-label="Annual" />;
    return <Star className="w-3 h-3 text-primary" aria-label="Premium" />;
  };

  return (
    <div className="flex flex-col h-full bg-card/50 backdrop-blur-sm rounded-lg border border-border overflow-hidden">
      <div className="px-3 py-2 border-b border-border bg-card/80 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Game Day Chat
        </span>
        <span className="text-xs text-muted-foreground">{messages.length} msgs</span>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
        {messages.length === 0 && (
          <p className="text-center text-xs text-muted-foreground py-8">
            Be the first to chat. Let's go Mets! 🧡
          </p>
        )}
        {messages.map((m) => {
          const mine = m.user_id === user?.id;
          return (
            <div key={m.id} className="group flex gap-2 items-start text-sm">
              <div className="w-7 h-7 rounded-full bg-primary/20 overflow-hidden flex-shrink-0 flex items-center justify-center text-xs font-bold">
                {m.profile?.avatar_url ? (
                  <img src={m.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  (m.profile?.full_name?.[0] || "?").toUpperCase()
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span
                    className={cn(
                      "text-xs font-semibold truncate",
                      m.tier === "admin"
                        ? "text-orange-400"
                        : m.tier === "annual"
                        ? "text-yellow-400"
                        : "text-primary"
                    )}
                  >
                    {m.profile?.full_name || "Fan"}
                  </span>
                  {tierBadge(m.tier)}
                  {(mine || isAdmin) && (
                    <button
                      onClick={() => remove(m.id)}
                      className="opacity-0 group-hover:opacity-100 ml-auto text-muted-foreground hover:text-destructive transition-opacity"
                      aria-label="Delete message"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <p className="text-foreground/90 break-words whitespace-pre-wrap leading-snug">
                  {m.content}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="p-2 border-t border-border bg-card/80 flex gap-2"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={user ? "Say something…" : "Sign in to chat"}
          maxLength={500}
          disabled={!user || sending}
          className="text-sm"
        />
        <Button type="submit" size="icon" disabled={!user || !input.trim() || sending}>
          <Send className="w-4 h-4" />
        </Button>
      </form>
    </div>
  );
}
