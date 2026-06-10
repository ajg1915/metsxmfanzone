import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageCircle, Send, Trash2, Radio } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";

interface ChatMessage {
  id: string;
  stream_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile?: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

interface LiveStreamChatProps {
  streamId: string;
  streamTitle?: string;
}

const MAX_LENGTH = 500;

const BOT_NAMES = [
  "MetsFan86", "AmazinAndy", "QueensKid", "FlushingFaithful", "PoloGrounder",
  "PiazzaForever", "LGM_Tony", "CitiFieldCarl", "OrangeBlueJay", "BuckShowtime",
  "AlonsoBomb", "LindorMagic", "NimmoNation", "StrawberryFields", "MetsMomma",
  "BleacherBrendan", "SubwaySeriesSal", "ShortPorchSam", "K_Corner", "RedSeatRyan",
  "ApplePopUp", "MrMet1962", "SengaForkball", "VientosVibes", "SotoShow",
];

// Fallback 2026 roster if MLB API is unavailable
const FALLBACK_ROSTER_FIRST = [
  "Lindor", "Soto", "Alonso", "Nimmo", "Vientos", "Marte", "McNeil",
  "Acuña", "Baty", "Alvarez", "Senga", "Manaea", "Holmes", "Peterson",
  "Megill", "Díaz", "Garrett", "Stanek",
];

const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

const STATIC_MESSAGES = [
  "LET'S GO METS!!! 🧡💙", "LFGM!!!", "Vamos Mets!", "RALLY TIME",
  "Best fanbase in baseball 🙌", "Citi Field looking electric tonight",
  "Anyone else watching from Queens?", "From Long Island, what's up everyone",
  "Joining from Brooklyn 🍕", "Watching with my dad ❤️",
  "Chat moving fast tonight 🔥", "That ump is brutal 😤",
  "MetsXMFanZone in the house 🎙️", "Stream looks crisp 🔥",
  "Audio is perfect tonight", "Hot dog and a beer rn 🌭🍺",
  "MAGIC IS BACK", "Comeback brewing 👀", "One pitch at a time",
  "LGM LGM LGM", "Citi vibes immaculate", "Let's get this W",
  "BOOOOOO that call", "TEXTBOOK double play", "Defense wins games",
  "This is why I love baseball", "Trust the process",
  "Series win incoming", "Who else got off work early for this?",
  "2026 squad is built different 💪", "Best stream on the internet fr",
];

const buildPlayerMessages = (players: string[]): string[] => {
  if (!players.length) return [];
  const templates = [
    (p: string) => `${p} about to do something special 👀`,
    (p: string) => `${p} locked in tonight`,
    (p: string) => `${p} 🔥🔥🔥`,
    (p: string) => `Give ${p} the MVP already`,
    (p: string) => `${p} with the laser!! 🚀`,
    (p: string) => `${p} carrying us rn`,
    (p: string) => `Need ${p} to come through here`,
    (p: string) => `${p} for the W 🙏`,
    (p: string) => `${p} is HIM`,
    (p: string) => `Throw it to ${p} 😤`,
    (p: string) => `${p} 🐐`,
    (p: string) => `That's why we love ${p}`,
    (p: string) => `${p}!!! LET'S GOOO`,
    (p: string) => `${p} cooking tonight 🧑‍🍳`,
  ];
  return players.flatMap((p) => templates.map((t) => t(p)));
};

const timeContextMessages = (): string[] => {
  const now = new Date();
  const hour = now.getHours();
  const month = now.getMonth(); // 0=Jan
  const day = now.toLocaleDateString("en-US", { weekday: "long" });
  const ctx: string[] = [];
  if (hour < 12) ctx.push("Morning Mets fam ☀️", "Coffee + Mets, perfect combo ☕");
  else if (hour < 17) ctx.push(`Happy ${day} afternoon Mets fam`, "Day game vibes ☀️⚾");
  else if (hour < 21) ctx.push(`${day} night baseball, doesn't get better`, "Prime time Mets 🌃");
  else ctx.push("Late night Mets crew checking in 🌙", "Staying up for every pitch");
  if (month >= 2 && month <= 3) ctx.push("Spring Training looking good 🌱", "Can't wait for opening day");
  else if (month >= 9) ctx.push("October baseball baby 🍂", "Playoff push is REAL");
  else ctx.push("2026 season hitting different", "162 game grind 💪");
  return ctx;
};

const LiveStreamChat = ({ streamId, streamTitle }: LiveStreamChatProps) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [roster, setRoster] = useState<string[]>(FALLBACK_ROSTER_FIRST);
  const [gameCtx, setGameCtx] = useState<{ opponent?: string; pitcher?: string }>({});
  const recentRef = useRef<string[]>([]);
  const usedNameRef = useRef<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  // Sync bot chat with today's published lineup (current players + opponent + starter)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("lineup_cards")
        .select("opponent, lineup_data, starting_pitcher, game_date")
        .eq("published", true)
        .order("game_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (data?.lineup_data && Array.isArray(data.lineup_data)) {
        const names = (data.lineup_data as any[])
          .map((p) => (typeof p?.name === "string" ? p.name : null))
          .filter(Boolean) as string[];
        if (names.length) setRoster(names);
        setGameCtx({
          opponent: typeof data.opponent === "string" ? data.opponent : undefined,
          pitcher: (data.starting_pitcher as any)?.name,
        });
        return;
      }
      try {
        const r = await fetch("https://statsapi.mlb.com/api/v1/teams/121/roster?rosterType=active&season=2026");
        const d = await r.json();
        if (cancelled) return;
        const names: string[] = (d?.roster ?? [])
          .map((p: any) => p?.person?.fullName)
          .filter(Boolean);
        if (names.length) setRoster(names);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [streamId]);



  // Hydrate profiles for a batch of user_ids
  const hydrateProfiles = async (msgs: ChatMessage[]): Promise<ChatMessage[]> => {
    const ids = Array.from(new Set(msgs.map((m) => m.user_id)));
    if (ids.length === 0) return msgs;
    const { data: profiles } = await supabase
      .from("public_profiles")
      .select("id, full_name, avatar_url")
      .in("id", ids);
    const map = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    return msgs.map((m) => ({ ...m, profile: map.get(m.user_id) ?? null }));
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data } = await supabase
        .from("live_stream_chat")
        .select("*")
        .eq("stream_id", streamId)
        .order("created_at", { ascending: true })
        .limit(100);
      if (!active) return;
      const hydrated = await hydrateProfiles((data ?? []) as ChatMessage[]);
      if (!active) return;
      setMessages(hydrated);
      setLoading(false);
    };
    load();

    const channel = supabase
      .channel(`live_stream_chat:${streamId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "live_stream_chat", filter: `stream_id=eq.${streamId}` },
        async (payload) => {
          const newMsg = payload.new as ChatMessage;
          const [hydrated] = await hydrateProfiles([newMsg]);
          setMessages((prev) => (prev.some((m) => m.id === hydrated.id) ? prev : [...prev, hydrated]));
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "live_stream_chat", filter: `stream_id=eq.${streamId}` },
        (payload) => {
          setMessages((prev) => prev.filter((m) => m.id !== (payload.old as any).id));
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [streamId]);

  // Simulated fan chat — variable pacing + occasional bursts to feel real
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const postOne = () => {
      const availNames = BOT_NAMES.filter((n) => !usedNameRef.current.has(n));
      if (availNames.length === 0) usedNameRef.current.clear();
      const name = pick(availNames.length ? availNames : BOT_NAMES);
      usedNameRef.current.add(name);

      const opponent = gameCtx.opponent;
      const pitcher = gameCtx.pitcher;
      const gameLines: string[] = [];
      if (opponent) {
        gameLines.push(
          `Let's take this one from the ${opponent} 💪`,
          `Beat the ${opponent}!`,
          `${opponent} fans quiet tonight 🤫`,
          `Sweep the ${opponent} please`,
        );
      }
      if (pitcher) {
        gameLines.push(
          `${pitcher} on the bump, we got this`,
          `Need ${pitcher} to settle in here`,
          `${pitcher} dealing 🔥`,
          `Get to ${pitcher} early`,
        );
      }

      const pool: string[] = [
        ...STATIC_MESSAGES,
        ...buildPlayerMessages(roster),
        ...timeContextMessages(),
        ...gameLines,
      ];

      const recent = recentRef.current;
      const fresh = pool.filter((m) => !recent.includes(m));
      const content: string = pick(fresh.length ? fresh : pool) ?? "LFGM!!!";
      recent.push(content);
      if (recent.length > 60) recent.shift();

      const fake: ChatMessage = {
        id: `bot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        stream_id: streamId,
        user_id: `bot-${name}`,
        content,
        created_at: new Date().toISOString(),
        profile: { full_name: name, avatar_url: null },
      };
      setMessages((prev) => {
        const next = [...prev, fake];
        return next.length > 150 ? next.slice(next.length - 150) : next;
      });
    };

    const schedule = () => {
      // 12% chance of a burst (big-play reaction): 3–5 quick msgs, then quiet
      const isBurst = Math.random() < 0.12;
      if (isBurst) {
        const burstCount = 3 + Math.floor(Math.random() * 3);
        for (let i = 0; i < burstCount; i++) {
          setTimeout(() => { if (!cancelled) postOne(); }, i * (250 + Math.random() * 450));
        }
        const cooldown = 6000 + Math.random() * 5000;
        timer = setTimeout(() => { if (!cancelled) schedule(); }, burstCount * 500 + cooldown);
        return;
      }

      // Normal: mostly 1.8–7s; sometimes a longer lull (8–16s)
      const longLull = Math.random() < 0.18;
      const delay = longLull
        ? 8000 + Math.random() * 8000
        : 1800 + Math.random() * 5200;

      timer = setTimeout(() => {
        if (cancelled) return;
        postOne();
        // 20% chance of a quick back-to-back reply
        if (Math.random() < 0.2) {
          setTimeout(() => { if (!cancelled) postOne(); }, 600 + Math.random() * 900);
        }
        schedule();
      }, delay);
    };

    const initial = setTimeout(schedule, 1200 + Math.random() * 1200);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      clearTimeout(initial);
    };
  }, [streamId, roster, gameCtx.opponent, gameCtx.pitcher]);

  useEffect(() => {
    const node = scrollRef.current?.querySelector("[data-radix-scroll-area-viewport]") as HTMLElement | null;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("Please sign in to chat");
      return;
    }
    const content = input.trim();
    if (!content || sending) return;
    if (content.length > MAX_LENGTH) {
      toast.error(`Messages must be under ${MAX_LENGTH} characters`);
      return;
    }
    setSending(true);
    const { error } = await supabase.from("live_stream_chat").insert({
      stream_id: streamId,
      user_id: user.id,
      content,
    });
    setSending(false);
    if (error) {
      toast.error("Could not send message");
      return;
    }
    setInput("");
  };

  const deleteMessage = async (id: string) => {
    const { error } = await supabase.from("live_stream_chat").delete().eq("id", id);
    if (error) toast.error("Could not delete message");
  };

  const initial = (name?: string | null) => (name?.trim()?.[0] ?? "M").toUpperCase();

  return (
    <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-sm overflow-hidden shadow-lg">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
        <div className="flex items-center gap-2">
          <div className="relative">
            <MessageCircle className="w-5 h-5 text-primary" />
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-destructive animate-pulse" />
          </div>
          <h2 className="text-sm sm:text-base font-bold text-foreground">Live Community Chat</h2>
          <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold text-destructive uppercase tracking-wider">
            <Radio className="w-3 h-3" />
            Live
          </span>
        </div>
        <span className="text-xs text-muted-foreground">{messages.length} message{messages.length === 1 ? "" : "s"}</span>
      </div>

      <ScrollArea ref={scrollRef} className="h-80 sm:h-96 px-4 py-3">
        {loading ? (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">Loading chat...</div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-1">
            <MessageCircle className="w-10 h-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-foreground">Be the first to chat!</p>
            <p className="text-xs text-muted-foreground">Say hi to fellow Mets fans watching{streamTitle ? ` ${streamTitle}` : ""}.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            <AnimatePresence initial={false}>
              {messages.map((m) => {
                const isMine = user?.id === m.user_id;
                const name = m.profile?.full_name || "Mets Fan";
                return (
                  <motion.li
                    key={m.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-start gap-2 group"
                  >
                    <Avatar className="w-8 h-8 shrink-0">
                      {m.profile?.avatar_url && <AvatarImage src={m.profile.avatar_url} alt={name} />}
                      <AvatarFallback className="text-xs bg-primary/20 text-primary font-bold">
                        {initial(name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className={`text-xs font-bold truncate ${isMine ? "text-primary" : "text-foreground"}`}>
                          {name}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-sm text-foreground/90 break-words whitespace-pre-wrap">{m.content}</p>
                    </div>
                    {isMine && (
                      <button
                        onClick={() => deleteMessage(m.id)}
                        aria-label="Delete message"
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </ScrollArea>

      <form onSubmit={sendMessage} className="border-t border-border p-3 bg-background/40">
        {user ? (
          <div className="flex items-center gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, MAX_LENGTH))}
              placeholder="Say something to the fans..."
              maxLength={MAX_LENGTH}
              className="flex-1"
              disabled={sending}
            />
            <Button type="submit" size="icon" disabled={sending || !input.trim()} aria-label="Send message">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">Sign in to join the chat</span>
            <Button asChild size="sm">
              <Link to="/auth">Sign In</Link>
            </Button>
          </div>
        )}
        {user && (
          <div className="mt-1 text-[10px] text-muted-foreground text-right">
            {input.length}/{MAX_LENGTH}
          </div>
        )}
      </form>
    </div>
  );
};

export default LiveStreamChat;
