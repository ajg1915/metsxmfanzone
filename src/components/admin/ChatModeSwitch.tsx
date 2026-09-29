import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type ChatMode = "auto" | "online" | "offline";

const OPTIONS: { key: ChatMode; label: string; hint: string }[] = [
  { key: "auto", label: "Auto", hint: "Online during live Mets and NY team games" },
  { key: "online", label: "On", hint: "Online now, game or not" },
  { key: "offline", label: "Off", hint: "Offline — fans can leave messages" },
];

/** Auto / On / Off switch for fan Chat. Used on the admin Chat page and dashboard. */
export default function ChatModeSwitch({
  mode,
  onChanged,
  compact = false,
}: {
  mode: ChatMode | null;
  onChanged: (mode: ChatMode, online: boolean) => void;
  compact?: boolean;
}) {
  const [saving, setSaving] = useState<ChatMode | null>(null);

  const setMode = async (next: ChatMode) => {
    if (next === mode || saving) return;
    setSaving(next);
    try {
      const { data, error } = await supabase.functions.invoke("fan-chat", { body: { action: "admin_set_mode", mode: next } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      onChanged(data.mode, !!data.online);
      toast.success(
        next === "auto" ? "Chat set to Auto" : next === "online" ? "Chat is now On" : "Chat is now Off",
        { description: OPTIONS.find((o) => o.key === next)?.hint },
      );
    } catch (e: any) {
      toast.error("Couldn't change Chat", { description: e?.message });
    } finally {
      setSaving(null);
    }
  };

  const active = OPTIONS.find((o) => o.key === mode);

  return (
    <div className={compact ? "" : "space-y-1"}>
      <div role="radiogroup" aria-label="Chat mode" className="inline-flex rounded-lg border border-white/10 bg-white/[0.04] p-0.5">
        {OPTIONS.map((o) => {
          const isActive = mode === o.key;
          return (
            <button
              key={o.key}
              role="radio"
              aria-checked={isActive}
              disabled={!!saving}
              onClick={() => setMode(o.key)}
              title={o.hint}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-60 ${
                isActive
                  ? o.key === "offline"
                    ? "bg-slate-600 text-white"
                    : o.key === "online"
                    ? "bg-emerald-600 text-white"
                    : "bg-[#FF5910] text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {saving === o.key ? "…" : o.label}
            </button>
          );
        })}
      </div>
      {!compact && active && <p className="text-[10px] text-muted-foreground">{active.hint}</p>}
    </div>
  );
}
