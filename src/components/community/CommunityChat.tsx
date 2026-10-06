import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bot, Loader2, Lock, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

// Community assistant — talks to the `community-chat` Supabase function
// (Cloudflare Workers AI). Members only, 10 messages per day. Replies stream in
// as OpenAI-style SSE chunks.

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/community-chat`;
const MAX_LEN = 1000;

type Msg = { role: "user" | "assistant"; content: string };

const CommunityChat = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages]);

  const send = async () => {
    const text = input.trim().slice(0, MAX_LEN);
    if (!text || sending) return;

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setError("Please log in to chat.");
      return;
    }

    setError(null);
    setInput("");
    setSending(true);
    const history: Msg[] = [...messages, { role: "user", content: text }];
    setMessages([...history, { role: "assistant", content: "" }]);

    const setReply = (content: string) =>
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: "assistant", content };
        return next;
      });

    try {
      const res = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY ?? "",
        },
        // The function allows at most 20 messages per request
        body: JSON.stringify({ messages: history.slice(-20) }),
      });

      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "The assistant is unavailable right now. Please try again shortly.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let reply = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const delta = JSON.parse(payload)?.choices?.[0]?.delta?.content;
            if (typeof delta === "string" && delta) {
              reply += delta;
              setReply(reply);
            }
          } catch {
            // ignore partial/malformed chunk
          }
        }
      }
      if (!reply.trim()) throw new Error("No reply came back. Please try again.");
    } catch (e) {
      setMessages((prev) => (prev[prev.length - 1]?.content === "" ? prev.slice(0, -1) : prev));
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-primary" />
          Ask the Community Assistant
        </CardTitle>
        <CardDescription>
          Questions about the Mets, the site, or your account. Members get 10 messages a day.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!user ? (
          <div className="text-center p-6 bg-muted/50 rounded-lg">
            <Lock className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground mb-4">Log in to chat with the assistant.</p>
            <Button onClick={() => navigate("/auth?mode=login")}>Log In</Button>
          </div>
        ) : (
          <>
            {messages.length > 0 && (
              <div className="max-h-80 overflow-y-auto space-y-3 pr-1" aria-live="polite">
                {messages.map((m, i) => (
                  <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                    <div
                      className={
                        "rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words max-w-[85%] " +
                        (m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted")
                      }
                    >
                      {m.content || <Loader2 className="w-4 h-4 animate-spin" />}
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask anything about the Mets or the site..."
                maxLength={MAX_LEN}
                disabled={sending}
              />
              <Button type="submit" disabled={sending || !input.trim()} aria-label="Send message">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </form>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default CommunityChat;
