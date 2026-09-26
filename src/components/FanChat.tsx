import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { MessageCircle, Send, X, Loader2, Mail, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "react-router-dom";

// ---------------------------------------------------------------------------
// Fan chat ("Chat · <name>") — talks to the `fan-chat` Supabase function.
// Online while a Mets game is live; otherwise fans can leave a message.
// The bottom bar (mobile) uses <FanChatBarButton />; <FanChat /> renders the
// panel plus a floating button on desktop. Both share the store below.
// ---------------------------------------------------------------------------

const FAN_CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fan-chat`;
const STATUS_POLL_MS = 60_000;

type ChatMessage = { role: "user" | "assistant"; content: string; id?: string };
type InboxItem = {
  id: string;
  agent_name: string;
  message: string;
  status: "pending" | "replied" | "failed";
  reply: string | null;
  created_at: string;
};

// ---------- tiny shared store ----------
type ChatState = { open: boolean; online: boolean; gameLabel: string; statusLoaded: boolean };
let state: ChatState = { open: false, online: false, gameLabel: "", statusLoaded: false };
const listeners = new Set<() => void>();
const setChatState = (patch: Partial<ChatState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const useChatState = () => useSyncExternalStore(subscribe, () => state, () => state);
export const openFanChat = () => setChatState({ open: true });

// ---------- helpers ----------
const getVisitorId = () => {
  const make = () => (crypto.randomUUID?.() ?? `${Date.now()}${Math.random()}`).replace(/[^A-Za-z0-9_-]/g, "");
  try {
    let id = localStorage.getItem("mxfz_chat_visitor");
    if (!id || !/^[A-Za-z0-9_-]{8,64}$/.test(id)) {
      id = make();
      localStorage.setItem("mxfz_chat_visitor", id);
    }
    return id;
  } catch {
    // storage blocked (private mode) — keep one id for this page load
    const w = window as unknown as { __mxfzVisitor?: string };
    w.__mxfzVisitor ??= make();
    return w.__mxfzVisitor;
  }
};

async function callFanChat(payload: Record<string, unknown>, accessToken?: string | null) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const res = await fetch(FAN_CHAT_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ ...payload, visitorId: getVisitorId() }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok && !data?.reply) throw new Error(data?.error || "Something went wrong");
  return data;
}

// Polls online/offline status (one poller for the whole app)
function useStatusPoller(accessToken?: string | null) {
  useEffect(() => {
    let stopped = false;
    const check = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const data = await callFanChat({ action: "status" }, accessToken);
        if (!stopped) setChatState({ online: !!data.online, gameLabel: data.gameLabel ?? "", statusLoaded: true });
      } catch {
        if (!stopped) setChatState({ statusLoaded: true });
      }
    };
    check();
    const t = window.setInterval(check, STATUS_POLL_MS);
    document.addEventListener("visibilitychange", check);
    return () => {
      stopped = true;
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", check);
    };
  }, [accessToken]);
}

const StatusDot = ({ online, className = "" }: { online: boolean; className?: string }) => (
  <span
    className={`inline-block h-2.5 w-2.5 rounded-full ring-2 ring-card ${online ? "bg-green-500" : "bg-muted-foreground/60"} ${className}`}
    aria-hidden
  />
);

// ---------- bottom bar button (mobile) ----------
export const FanChatBarButton = () => {
  const { online } = useChatState();
  return (
    <Button
      variant="ghost"
      onClick={openFanChat}
      aria-label={`Chat, ${online ? "online" : "offline"}`}
      className="relative h-auto min-w-0 flex-col gap-0.5 rounded-sm px-2 py-1 text-muted-foreground hover:bg-secondary/20 hover:text-foreground"
    >
      <span className="relative">
        <MessageCircle className="h-7 w-7" />
        <StatusDot online={online} className="absolute -right-0.5 -top-0.5" />
      </span>
      <span className="text-[10px] font-semibold">Chat</span>
    </Button>
  );
};

// ---------- panel + desktop floating button ----------
export const FanChat = () => {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith("/admin");
  const { session } = useAuth();
  const accessToken = session?.access_token ?? null;
  const isMember = !!session?.user;
  const { open, online, gameLabel } = useChatState();
  useStatusPoller(accessToken);

  const [agentName, setAgentName] = useState("");
  const [conversationId, setConversationId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [starting, setStarting] = useState(false);
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [leaveText, setLeaveText] = useState("");
  const [leaveEmail, setLeaveEmail] = useState("");
  const [leaveSent, setLeaveSent] = useState<null | { willEmail: boolean }>(null);
  const [leaveError, setLeaveError] = useState("");
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [takenOver, setTakenOver] = useState(false);
  const [chatStarted, setChatStarted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // A new chat (new name) every time the panel opens
  const startChat = useCallback(async () => {
    setStarting(true);
    setMessages([]);
    setInput("");
    setLeaveSent(null);
    setLeaveError("");
    setShowLeaveForm(false);
    setTakenOver(false);
    setChatStarted(false);
    try {
      const [status, box] = await Promise.all([
        callFanChat({ action: "status" }, accessToken),
        callFanChat({ action: "inbox" }, accessToken).catch(() => ({ messages: [] })),
      ]);
      setChatState({ online: !!status.online, gameLabel: status.gameLabel ?? "", statusLoaded: true });
      setAgentName(status.agentName);
      setConversationId(status.conversationId);
      setInbox(box.messages ?? []);
      if (status.online) {
        setMessages([{ role: "assistant", content: `Hey! ${status.agentName} here 👋 What's up?` }]);
      }
    } catch {
      setAgentName((n) => n || "Chat");
    } finally {
      setStarting(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (open) startChat();
  }, [open, startChat]);

  // While a chat is going, pick up replies that arrive on their own
  // (someone from the crew jumping in from the admin portal)
  useEffect(() => {
    if (!open || !chatStarted || !conversationId) return;
    let stopped = false;
    const poll = async () => {
      try {
        const data = await callFanChat({ action: "poll", conversationId }, accessToken);
        if (stopped) return;
        setTakenOver(!!data.takenOver);
        if (data.takenOver) setShowLeaveForm(false);
        const incoming: ChatMessage[] = (data.messages ?? []).map((m: any) => ({ role: "assistant", content: m.content, id: m.id }));
        if (incoming.length) {
          setMessages((cur) => {
            const seen = new Set(cur.map((m) => m.id).filter(Boolean));
            const fresh = incoming.filter((m) => !seen.has(m.id));
            return fresh.length ? [...cur, ...fresh] : cur;
          });
        }
      } catch {
        /* try again next tick */
      }
    };
    const t = window.setInterval(poll, 3000);
    return () => {
      stopped = true;
      window.clearInterval(t);
    };
  }, [open, chatStarted, conversationId, accessToken]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing, inbox, leaveSent]);

  const close = () => setChatState({ open: false });

  const send = async () => {
    const text = input.trim();
    if (!text || typing) return;
    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setTyping(true);
    const started = Date.now();
    try {
      const data = await callFanChat({ action: "chat", agentName, conversationId, messages: next }, accessToken);
      setChatStarted(true);
      if (data.queued) {
        // A real person from the crew has this chat — their reply arrives via polling
        setTakenOver(true);
        setShowLeaveForm(false);
        return;
      }
      // a short, natural "typing" pause
      const wait = Math.max(0, 900 + Math.min(text.length * 15, 1200) - (Date.now() - started));
      await new Promise((r) => setTimeout(r, wait));
      if (data.offline) {
        setChatState({ online: false, gameLabel: data.gameLabel ?? "" });
        setShowLeaveForm(true);
        setLeaveText(text);
      } else {
        setMessages((m) => (data.id && m.some((x) => x.id === data.id) ? m : [...m, { role: "assistant", content: data.reply, id: data.id }]));
        if (data.busy) {
          setShowLeaveForm(true);
          setLeaveText(text);
        }
      }
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Hmm, my connection just dropped. Try that again?" }]);
    } finally {
      setTyping(false);
    }
  };

  const leaveMessage = async () => {
    const text = leaveText.trim();
    if (!text) return;
    setLeaveError("");
    try {
      const data = await callFanChat(
        { action: "leave_message", agentName, conversationId, message: text, email: isMember ? undefined : leaveEmail },
        accessToken,
      );
      if (data.saved) {
        setLeaveSent({ willEmail: !!data.willEmail });
        setLeaveText("");
        setShowLeaveForm(false);
      } else {
        setLeaveError(data.error || "Couldn't send that — try again?");
      }
    } catch (e) {
      setLeaveError(e instanceof Error ? e.message : "Couldn't send that — try again?");
    }
  };

  const offlineView = (!online && !takenOver) || showLeaveForm;

  if (isAdminRoute) return null;

  return (
    <>
      {/* Desktop floating button (mobile uses the bottom bar button) */}
      {!open && (
        <button
          onClick={openFanChat}
          aria-label={`Chat, ${online ? "online" : "offline"}`}
          className="fixed bottom-6 right-6 z-50 hidden items-center gap-2 rounded-full bg-primary px-5 py-3 font-semibold text-primary-foreground shadow-elevation-high transition hover:scale-105 md:flex"
        >
          <span className="relative">
            <MessageCircle className="h-5 w-5" />
            <StatusDot online={online} className="absolute -right-1 -top-1 ring-primary" />
          </span>
          Chat
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-label="Chat"
          className="fixed inset-x-3 bottom-[calc(6.5rem+env(safe-area-inset-bottom))] z-[60] flex max-h-[70vh] flex-col overflow-hidden rounded-xl border border-border/50 bg-card shadow-elevation-high md:inset-x-auto md:bottom-6 md:right-6 md:w-[380px] md:max-h-[600px]"
        >
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-border/50 bg-primary/10 px-4 py-3">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">
              {agentName ? agentName[0] : "C"}
              <StatusDot online={online} className="absolute -bottom-0.5 -right-0.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-foreground">Chat{agentName ? ` · ${agentName}` : ""}</p>
              <p className="truncate text-xs text-muted-foreground">
                {online ? "Online" : "Offline"}
                {gameLabel ? ` · ${gameLabel}` : ""}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={close} aria-label="Close chat">
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Body */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {starting && (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}

            {/* Earlier left messages + replies */}
            {!starting && inbox.length > 0 && (
              <div className="space-y-2 rounded-lg border border-border/40 bg-secondary/10 p-3">
                <p className="text-xs font-semibold text-muted-foreground">Your messages</p>
                {inbox.slice(0, 3).map((m) => (
                  <div key={m.id} className="space-y-1 text-sm">
                    <p className="text-foreground">You: {m.message}</p>
                    {m.status === "replied" && m.reply ? (
                      <p className="text-muted-foreground">
                        <span className="font-semibold text-foreground">{m.agent_name}:</span> {m.reply}
                      </p>
                    ) : (
                      <p className="text-xs italic text-muted-foreground">Waiting for a reply…</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {!starting &&
              messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm ${
                      m.role === "user"
                        ? "rounded-br-sm bg-primary text-primary-foreground"
                        : "rounded-bl-sm bg-secondary/30 text-foreground"
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}

            {typing && (
              <p className="text-xs italic text-muted-foreground">{agentName || "Chat"} is typing…</p>
            )}

            {!starting && offlineView && !leaveSent && (
              <div className="space-y-2">
                {!online && (
                  <p className="text-sm text-muted-foreground">
                    We're offline right now — we're online during Mets games. Leave a message and {agentName || "we"}'ll get back to you!
                  </p>
                )}
                <Textarea
                  value={leaveText}
                  onChange={(e) => setLeaveText(e.target.value)}
                  placeholder="Your message…"
                  maxLength={2000}
                  className="min-h-[80px] resize-none"
                />
                {!isMember && (
                  <Input
                    type="email"
                    value={leaveEmail}
                    onChange={(e) => setLeaveEmail(e.target.value)}
                    placeholder="Email (optional, to get the reply)"
                  />
                )}
                {leaveError && <p className="text-xs text-destructive">{leaveError}</p>}
                <Button onClick={leaveMessage} disabled={!leaveText.trim()} className="w-full">
                  <Mail className="mr-2 h-4 w-4" /> Leave a message
                </Button>
              </div>
            )}

            {leaveSent && (
              <div className="flex items-start gap-2 rounded-lg bg-secondary/20 p-3 text-sm text-foreground">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                <span>
                  Got it! {agentName || "We"}'ll get back to you
                  {leaveSent.willEmail ? " — the reply will show up here and in your email." : " — check back here for the reply."}
                </span>
              </div>
            )}
          </div>

          {/* Input (online only) */}
          {(online || takenOver) && !showLeaveForm && !starting && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
              className="flex items-center gap-2 border-t border-border/50 p-3"
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a message…"
                maxLength={1500}
                disabled={typing}
                aria-label="Message"
              />
              <Button type="submit" size="icon" disabled={!input.trim() || typing} aria-label="Send">
                <Send className="h-4 w-4" />
              </Button>
            </form>
          )}
        </div>
      )}
    </>
  );
};

export default FanChat;
