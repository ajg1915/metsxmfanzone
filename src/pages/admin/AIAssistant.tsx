import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Send, Loader2, FileText, Mic, Lightbulb, Activity } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";

type Message = { role: "user" | "assistant"; content: string };

const ASSISTANT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-ai-assistant`;

const quickPrompts = [
  {
    label: "Blog Post",
    icon: FileText,
    prompt: "Write a Mets blog post about today's game with a catchy headline and SNY-style body copy.",
  },
  {
    label: "Podcast Script",
    icon: Mic,
    prompt: "Write a 5-minute Mets podcast intro and segment outline for today's show.",
  },
  {
    label: "Content Ideas",
    icon: Lightbulb,
    prompt: "Give me 5 fresh content ideas for MetsXMFanZone this week, with platform and angle for each.",
  },
  {
    label: "Live Stats",
    icon: Activity,
    prompt: "What are the latest Mets live game stats and standings?",
  },
];

export default function AIAssistant() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const streamChat = async (userMessages: Message[]) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error("Please log in to use the assistant.");
    }

    const resp = await fetch(ASSISTANT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ messages: userMessages }),
    });

    if (resp.status === 401) {
      throw new Error("Session expired. Please log in again.");
    }
    if (resp.status === 403) {
      throw new Error("Admin access required.");
    }
    if (!resp.ok) {
      const error = await resp.json().catch(() => ({ error: "Failed to get response" }));
      throw new Error(error.error || "Failed to get response");
    }

    if (!resp.body) throw new Error("No response body");

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = "";
    let assistantContent = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      textBuffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
        let line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);

        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.startsWith(":") || line.trim() === "") continue;
        if (!line.startsWith("data: ")) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") break;

        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            assistantContent += content;
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last?.role === "assistant") {
                return prev.map((m, i) =>
                  i === prev.length - 1 ? { ...m, content: assistantContent } : m
                );
              }
              return [...prev, { role: "assistant", content: assistantContent }];
            });
          }
        } catch {
          textBuffer = line + "\n" + textBuffer;
          break;
        }
      }
    }
  };

  const sendMessage = async (text?: string) => {
    const messageText = (text ?? input).trim();
    if (!messageText || isLoading) return;

    const userMsg: Message = { role: "user", content: messageText };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      await streamChat(newMessages);
    } catch (error) {
      console.error("Assistant error:", error);
      toast({
        title: "Assistant error",
        description: error instanceof Error ? error.message : "Failed to send message",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-full h-full min-h-0 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3 shrink-0">
        <Bot className="w-4 h-4 text-primary flex-shrink-0" />
        <div className="min-w-0">
          <h1 className="text-sm sm:text-base font-bold truncate">Admin AI Assistant</h1>
          <p className="text-[10px] text-muted-foreground">
            Blog posts, podcast scripts, content ideas, and live Mets stats.
          </p>
        </div>
      </div>

      <Card className="flex-1 min-h-0 flex flex-col border-white/10 bg-white/[0.03] backdrop-blur-xl overflow-hidden">
        <CardHeader className="pb-2 border-b border-white/5 shrink-0">
          <CardTitle className="text-sm flex items-center gap-2 text-slate-200">
            <Bot className="h-4 w-4 text-[#FF5910]" />
            MetsXMFanZone Assistant
          </CardTitle>
        </CardHeader>

        <CardContent className="flex-1 min-h-0 flex flex-col p-0">
          <ScrollArea className="flex-1 min-h-0 p-4" ref={scrollRef}>
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 py-12">
                <Bot className="h-12 w-12 mb-4 text-[#FF5910]/40" />
                <p className="text-sm font-medium text-slate-300 mb-1">How can I help today?</p>
                <p className="text-xs max-w-md">
                  Pick a quick prompt below or type your own request. I can pull live MLB stats when you ask about today's game.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[90%] sm:max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                        msg.role === "user"
                          ? "bg-[#FF5910] text-white rounded-br-md"
                          : "bg-white/5 text-slate-200 border border-white/10 rounded-bl-md"
                      }`}
                    >
                      {msg.role === "assistant" ? (
                        <div className="prose prose-sm prose-invert max-w-none">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      )}
                    </div>
                  </div>
                ))}
                {isLoading && messages[messages.length - 1]?.role === "user" && (
                  <div className="flex justify-start">
                    <div className="bg-white/5 border border-white/10 rounded-2xl rounded-bl-md px-4 py-3">
                      <Loader2 className="h-4 w-4 animate-spin text-[#FF5910]" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          {/* Quick prompts */}
          {messages.length === 0 && (
            <div className="px-4 pb-3 shrink-0">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {quickPrompts.map((qp) => (
                  <button
                    key={qp.label}
                    onClick={() => sendMessage(qp.prompt)}
                    className="flex items-center gap-2 p-3 rounded-xl bg-white/5 border border-white/10 hover:border-[#FF5910]/40 hover:bg-white/[0.07] transition-all text-left"
                  >
                    <qp.icon className="h-4 w-4 text-[#FF5910] flex-shrink-0" />
                    <span className="text-xs font-medium text-slate-200">{qp.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="p-4 border-t border-white/5 shrink-0">
            <div className="flex gap-2">
              <Input
                placeholder="Ask the assistant anything..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                disabled={isLoading}
                className="flex-1 bg-white/5 border-white/10 text-slate-200 placeholder:text-slate-500 focus-visible:ring-[#FF5910]/60"
              />
              <Button
                onClick={() => sendMessage()}
                disabled={isLoading || !input.trim()}
                size="icon"
                className="bg-[#FF5910] hover:bg-[#FF5910]/90 text-white"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
