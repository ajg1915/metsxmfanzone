import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ArrowRight, Bot, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type LiveMsg = { id: string; role: "user" | "assistant" | "admin"; content: string; created_at: string };
type LiveConv = {
  id: string;
  agent_name: string;
  is_member: boolean;
  taken_over: boolean;
  last_message_at: string;
  messages: LiveMsg[];
};

const callFanChat = async (body: Record<string, unknown>) => {
  const { data, error } = await supabase.functions.invoke("fan-chat", { body });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
};

/** Admin dashboard panel: Chat status, what needs you, and the latest live chats. */
export default function ChatDashboardCard() {
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState(false);
  const [online, setOnline] = useState(false);
  const [gameLabel, setGameLabel] = useState("");
  const [waitingMessages, setWaitingMessages] = useState(0);
  const [chatsToday, setChatsToday] = useState(0);
  const [convs, setConvs] = useState<LiveConv[]>([]);

  useEffect(() => {
    let stopped = false;
    const load = async () => {
      try {
        const [overview, live] = await Promise.all([
          callFanChat({ action: "admin_overview" }),
          callFanChat({ action: "admin_live", hours: 6 }),
        ]);
        if (stopped) return;
        setOnline(!!overview.online);
        setGameLabel(overview.gameLabel ?? "");
        setWaitingMessages(overview.stats?.pending ?? 0);
        setChatsToday(overview.stats?.chatsToday ?? 0);
        setConvs(live.conversations ?? []);
      } catch {
        /* keep last good values */
      } finally {
        if (!stopped) setLoaded(true);
      }
    };
    load();
    const t = window.setInterval(load, 20_000);
    return () => {
      stopped = true;
      window.clearInterval(t);
    };
  }, []);

  const recentCutoff = Date.now() - 30 * 60_000;
  const activeNow = convs.filter((c) => new Date(c.last_message_at).getTime() > recentCutoff).length;
  const needsYou = convs.filter((c) => c.taken_over && c.messages[c.messages.length - 1]?.role === "user").length;
  const latest = convs.slice(0, 3);

  const stat = (label: string, value: number | string, highlight = false) => (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
      <p className="adm-chip text-slate-500">{label}</p>
      <p className={`adm-display mt-0.5 text-lg font-bold ${highlight ? "text-[#FF7A3D]" : "text-white"}`}>
        {loaded ? value : "—"}
      </p>
    </div>
  );

  return (
    <section className="adm-panel p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="text-white">Chat</h2>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 adm-chip ${
              online
                ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-400"
                : "border-white/10 bg-white/5 text-slate-400"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${online ? "animate-pulse bg-emerald-400" : "bg-slate-500"}`} />
            {online ? "Online" : "Offline"}
          </span>
          {gameLabel && <span className="hidden truncate text-[11px] text-slate-500 sm:inline">{gameLabel}</span>}
        </div>
        <button
          onClick={() => navigate("/admin/chat")}
          className="flex items-center gap-1 text-xs font-semibold text-[#FF7A3D] hover:underline"
        >
          Open chat <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stat("Needs you", needsYou, needsYou > 0)}
        {stat("Active now", activeNow)}
        {stat("Left messages", waitingMessages, waitingMessages > 0)}
        {stat("AI chats today", chatsToday)}
      </div>

      <div className="mt-3 space-y-1.5">
        {loaded && latest.length === 0 && (
          <p className="py-2 text-center text-xs text-slate-500">No chats in the last 6 hours.</p>
        )}
        {latest.map((c) => {
          const last = c.messages[c.messages.length - 1];
          const waiting = c.taken_over && last?.role === "user";
          return (
            <button
              key={c.id}
              onClick={() => navigate("/admin/chat")}
              className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors hover:bg-white/[0.06] ${
                waiting ? "border-[#FF5910]/40 bg-[#FF5910]/[0.06]" : "border-white/10 bg-white/[0.02]"
              }`}
            >
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#FF5910]/15 text-xs font-bold text-[#FF7A3D]">
                {c.agent_name[0]}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-white">
                  Chat · {c.agent_name}
                  <span className="font-normal text-slate-500">· {c.is_member ? "Member" : "Visitor"}</span>
                  {c.taken_over ? (
                    <UserRound className="h-3 w-3 text-[#FF7A3D]" aria-label="You have this chat" />
                  ) : (
                    <Bot className="h-3 w-3 text-slate-500" aria-label="AI has this chat" />
                  )}
                </span>
                <span className="block truncate text-[11px] text-slate-400">
                  {last ? `${last.role === "user" ? "Fan" : c.agent_name}: ${last.content}` : "…"}
                </span>
              </span>
              <span className="flex-shrink-0 text-[10px] text-slate-500">
                {formatDistanceToNow(new Date(c.last_message_at), { addSuffix: true })}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
