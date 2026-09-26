import { useEffect, useMemo, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  MessageCircle, Trash2, Reply, Mail, RefreshCw, Clock, CheckCircle2, Users,
  Bot, UserRound, ChevronUp, MessagesSquare, Send,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  AdminPage, AdminPageHeader, AdminList, AdminListCard, AdminRow, AdminEmpty,
  AdminLoading, AdminIconButton, AdminStat, AdminStatGrid, AdminToolbar, AdminFilterChips,
} from "@/components/admin/AdminUI";

type ChatMsg = {
  id: string;
  agent_name: string;
  email: string | null;
  message: string;
  status: "pending" | "replied" | "failed";
  reply: string | null;
  replied_at: string | null;
  reply_emailed: boolean;
  created_at: string;
  is_member: boolean;
};

type Overview = {
  online: boolean;
  gameLabel: string;
  messages: ChatMsg[];
  stats: { chatsToday: number; chatsWeek: number; pending: number; memberLimit: number; visitorLimit: number };
};

const callAdmin = async (body: Record<string, unknown>) => {
  const { data, error } = await supabase.functions.invoke("fan-chat", { body });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
};

type LiveMsg = { id: string; role: "user" | "assistant" | "admin"; content: string; created_at: string };
type LiveConv = {
  id: string;
  agent_name: string;
  is_member: boolean;
  taken_over: boolean;
  started_at: string;
  last_message_at: string;
  messages: LiveMsg[];
};

// ---------- Live chats: watch conversations and take them over ----------
const LiveChats = () => {
  const { toast } = useToast();
  const [convs, setConvs] = useState<LiveConv[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    try {
      const res = await callAdmin({ action: "admin_live", hours: 6 });
      setConvs(res.conversations ?? []);
    } catch (e: any) {
      toast({ title: "Couldn't load live chats", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Refresh fast while you're in a chat, slower otherwise
  useEffect(() => {
    load();
    const t = window.setInterval(load, openId ? 3000 : 15000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId]);

  const open = convs.find((c) => c.id === openId) ?? null;
  const lastCount = open?.messages.length ?? 0;
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [openId, lastCount]);

  const send = async () => {
    if (!open || !draft.trim()) return;
    setSending(true);
    try {
      await callAdmin({ action: "admin_send", conversationId: open.id, content: draft.trim() });
      setDraft("");
      load();
    } catch (e: any) {
      toast({ title: "Couldn't send", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const release = async (id: string) => {
    try {
      await callAdmin({ action: "admin_release", conversationId: id });
      toast({ title: "Handed back to Chat's AI" });
      load();
    } catch (e: any) {
      toast({ title: "Couldn't hand back", description: e.message, variant: "destructive" });
    }
  };

  if (loading) return <AdminLoading label="Loading live chats…" />;
  if (!convs.length) return <AdminEmpty message="No chats in the last 6 hours. Chats show up here as soon as a fan sends a message." />;

  return (
    <AdminList>
      {convs.map((c) => {
        const last = c.messages[c.messages.length - 1];
        const fanCount = c.messages.filter((m) => m.role === "user").length;
        const isOpen = openId === c.id;
        const waitingOnYou = c.taken_over && last?.role === "user";
        return (
          <AdminListCard key={c.id} highlight={waitingOnYou}>
            <AdminRow
              title={last ? `${last.role === "user" ? "Fan" : c.agent_name}: ${last.content}` : "(no messages)"}
              meta={`Chat · ${c.agent_name} · ${c.is_member ? "Member" : "Visitor"} · ${fanCount} fan message${fanCount === 1 ? "" : "s"} · ${formatDistanceToNow(new Date(c.last_message_at), { addSuffix: true })}`}
              badges={
                c.taken_over ? (
                  <Badge variant="outline" className="h-4 text-[9px] text-primary">
                    <UserRound className="mr-0.5 h-2.5 w-2.5" /> You
                  </Badge>
                ) : (
                  <Badge variant="outline" className="h-4 text-[9px] text-muted-foreground">
                    <Bot className="mr-0.5 h-2.5 w-2.5" /> AI
                  </Badge>
                )
              }
              actions={
                <>
                  <AdminIconButton
                    icon={isOpen ? ChevronUp : MessagesSquare}
                    title={isOpen ? "Close" : "Open chat"}
                    tone="primary"
                    onClick={() => {
                      setOpenId(isOpen ? null : c.id);
                      setDraft("");
                    }}
                  />
                  {c.taken_over && (
                    <AdminIconButton icon={Bot} title="Hand back to AI" onClick={() => release(c.id)} />
                  )}
                </>
              }
              body={
                isOpen && (
                  <div className="space-y-2">
                    <div className="max-h-80 space-y-1.5 overflow-y-auto rounded-md border border-border/30 bg-background/40 p-2">
                      {c.messages.map((m) => (
                        <div key={m.id} className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}>
                          <div
                            className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-2.5 py-1.5 text-xs ${
                              m.role === "user"
                                ? "bg-secondary/40 text-foreground"
                                : m.role === "admin"
                                ? "bg-primary text-primary-foreground"
                                : "bg-secondary/15 text-muted-foreground"
                            }`}
                          >
                            <span className="mb-0.5 block text-[9px] opacity-70">
                              {m.role === "user" ? "Fan" : m.role === "admin" ? `You (as ${c.agent_name})` : `${c.agent_name} (AI)`}
                              {" · "}
                              {new Date(m.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                            </span>
                            {m.content}
                          </div>
                        </div>
                      ))}
                      <div ref={bottomRef} />
                    </div>
                    <form
                      className="flex items-end gap-1.5"
                      onSubmit={(e) => {
                        e.preventDefault();
                        send();
                      }}
                    >
                      <Textarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            send();
                          }
                        }}
                        placeholder={`Reply as ${c.agent_name}…`}
                        className="min-h-[44px] text-xs"
                        maxLength={2000}
                      />
                      <Button type="submit" size="sm" className="h-9" disabled={!draft.trim() || sending}>
                        <Send className="h-3.5 w-3.5" />
                      </Button>
                    </form>
                    <p className="text-[10px] text-muted-foreground">
                      {c.taken_over
                        ? `You have this chat — the AI is paused. Tap the robot icon to hand it back.`
                        : `Sending a message takes over this chat and pauses the AI.`}
                    </p>
                  </div>
                )
              }
            />
          </AdminListCard>
        );
      })}
    </AdminList>
  );
};

const ChatManagement = () => {
  const { toast } = useToast();
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [tab, setTab] = useState<"live" | "messages">("live");

  const load = async () => {
    try {
      setData(await callAdmin({ action: "admin_overview" }));
    } catch (e: any) {
      toast({ title: "Couldn't load chat", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const t = window.setInterval(load, 60_000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const messages = data?.messages ?? [];
  const counts = useMemo(() => ({
    pending: messages.filter((m) => m.status === "pending").length,
    replied: messages.filter((m) => m.status === "replied").length,
    all: messages.length,
  }), [messages]);
  const shown = filter === "all" ? messages : messages.filter((m) => m.status === filter);

  const sendReply = async (id: string) => {
    if (!replyText.trim()) return;
    setSending(true);
    try {
      const res = await callAdmin({ action: "admin_reply", id, reply: replyText.trim() });
      toast({
        title: "Reply sent",
        description: res.emailed
          ? "Emailed to the fan and shown in their chat."
          : res.hadEmail
          ? "Shown in their chat, but the email didn't go through."
          : "Shown in their chat (they didn't leave an email).",
      });
      setReplyingId(null);
      setReplyText("");
      load();
    } catch (e: any) {
      toast({ title: "Reply failed", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await callAdmin({ action: "admin_delete", id: deleteId });
      toast({ title: "Message deleted" });
      load();
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    } finally {
      setDeleteId(null);
    }
  };

  if (loading) return <AdminLoading label="Loading chat…" />;

  return (
    <AdminPage>
      <AdminPageHeader
        icon={MessageCircle}
        title="Chat"
        count={counts.pending}
        countLabel="waiting"
        description="Fan chat in the bottom bar. Online during live Mets games; offline messages land here."
        actions={
          <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={load}>
            <RefreshCw className="mr-1 h-3 w-3" /> Refresh
          </Button>
        }
      />

      <AdminStatGrid>
        <AdminStat
          icon={MessageCircle}
          label="Status"
          value={data?.online ? "Online" : "Offline"}
          tone={data?.online ? "success" : "default"}
        />
        <AdminStat icon={Users} label="Chats today" value={data?.stats.chatsToday ?? 0} />
        <AdminStat icon={Users} label="Chats this week" value={data?.stats.chatsWeek ?? 0} />
        <AdminStat
          icon={Clock}
          label="Waiting for reply"
          value={data?.stats.pending ?? 0}
          tone={(data?.stats.pending ?? 0) > 0 ? "warning" : "default"}
        />
      </AdminStatGrid>
      {data?.gameLabel && <p className="text-[10px] text-muted-foreground">{data.gameLabel}</p>}

      <AdminToolbar>
        <AdminFilterChips
          active={tab}
          onChange={(k) => setTab(k as "live" | "messages")}
          filters={[
            { key: "live", label: "Live chats" },
            { key: "messages", label: "Left messages", count: counts.pending },
          ]}
        />
      </AdminToolbar>

      {tab === "live" && <LiveChats />}

      {tab === "messages" && (
      <>
      <AdminToolbar>
        <AdminFilterChips
          active={filter}
          onChange={setFilter}
          filters={[
            { key: "pending", label: "Waiting", count: counts.pending },
            { key: "replied", label: "Replied", count: counts.replied },
            { key: "all", label: "All", count: counts.all },
          ]}
        />
      </AdminToolbar>

      <AdminList>
        {shown.length === 0 ? (
          <AdminEmpty message={filter === "pending" ? "No messages waiting — you're all caught up." : "No messages yet."} />
        ) : (
          shown.map((m) => (
            <AdminListCard key={m.id} highlight={m.status === "pending"}>
              <AdminRow
                title={m.message}
                meta={`To ${m.agent_name} · ${m.is_member ? "Member" : "Visitor"}${m.email ? ` · ${m.email}` : ""} · ${formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}`}
                badges={
                  m.status === "replied" ? (
                    <Badge variant="outline" className="h-4 text-[9px] text-green-500">
                      <CheckCircle2 className="mr-0.5 h-2.5 w-2.5" /> Replied
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="h-4 text-[9px] text-yellow-500">Waiting</Badge>
                  )
                }
                actions={
                  <>
                    <AdminIconButton
                      icon={Reply}
                      title={m.status === "replied" ? "Reply again" : "Reply"}
                      tone="primary"
                      onClick={() => {
                        setReplyingId(replyingId === m.id ? null : m.id);
                        setReplyText("");
                      }}
                    />
                    <AdminIconButton icon={Trash2} title="Delete" tone="danger" onClick={() => setDeleteId(m.id)} />
                  </>
                }
                body={
                  <>
                    {m.reply && (
                      <div className="rounded-md bg-secondary/20 p-2 text-xs">
                        <span className="font-semibold">{m.agent_name}:</span> {m.reply}
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {m.replied_at ? formatDistanceToNow(new Date(m.replied_at), { addSuffix: true }) : ""}
                          {m.reply_emailed && (
                            <span className="ml-1 inline-flex items-center"><Mail className="mr-0.5 h-2.5 w-2.5" />emailed</span>
                          )}
                        </p>
                      </div>
                    )}
                    {replyingId === m.id && (
                      <div className="space-y-1.5">
                        <Textarea
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder={`Reply as ${m.agent_name}…`}
                          className="min-h-[70px] text-xs"
                          maxLength={2000}
                        />
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[10px] text-muted-foreground">
                            {m.email ? `Sends to ${m.email} and shows in their chat.` : "No email — shows in their chat next time they open it."}
                          </p>
                          <Button size="sm" className="h-7 text-[10px]" disabled={!replyText.trim() || sending} onClick={() => sendReply(m.id)}>
                            {sending ? "Sending…" : "Send reply"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                }
              />
            </AdminListCard>
          ))
        )}
      </AdminList>
      </>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this message?</AlertDialogTitle>
            <AlertDialogDescription>It'll be removed for good, including from the fan's chat history.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminPage>
  );
};

export default ChatManagement;
