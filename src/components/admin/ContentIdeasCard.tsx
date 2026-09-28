import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { CheckCircle2, Circle, Flame, Lightbulb, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Idea = {
  id: string;
  idea_date: string;
  headline: string;
  description: string | null;
  category: string | null;
  style: "hot_take" | "informative" | null;
  platforms: string[] | null;
  used: boolean;
};

const PLATFORM_LABELS: Record<string, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "YouTube",
  facebook: "Facebook",
};

// TikTok is the main platform, so it always leads.
const sortPlatforms = (list: string[] | null) =>
  [...(list ?? ["tiktok"])].sort((a, b) => (a === "tiktok" ? -1 : b === "tiktok" ? 1 : 0));

const prettyCategory = (c: string | null) =>
  c ? c.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()) : "";

/** Admin dashboard panel: the two short-video ideas generated each morning at 5 AM. */
export default function ContentIdeasCard() {
  const [loaded, setLoaded] = useState(false);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [unusedCount, setUnusedCount] = useState(0);

  const load = async () => {
    const db = supabase as any; // table isn't in the generated types yet
    const latest = await db
      .from("content_ideas")
      .select("idea_date")
      .order("idea_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latest.data?.idea_date) {
      const { data } = await db
        .from("content_ideas")
        .select("id, idea_date, headline, description, category, style, platforms, used")
        .eq("idea_date", latest.data.idea_date)
        .order("style", { ascending: true });
      setIdeas((data as Idea[]) ?? []);
    } else {
      setIdeas([]);
    }

    const { count } = await db
      .from("content_ideas")
      .select("*", { count: "exact", head: true })
      .eq("used", false);
    setUnusedCount(count ?? 0);
    setLoaded(true);
  };

  useEffect(() => {
    load().catch(() => setLoaded(true));
  }, []);

  const toggleUsed = async (idea: Idea) => {
    const next = !idea.used;
    setIdeas((prev) => prev.map((i) => (i.id === idea.id ? { ...i, used: next } : i)));
    setUnusedCount((n) => Math.max(0, n + (next ? -1 : 1)));
    const { error } = await (supabase as any).from("content_ideas").update({ used: next }).eq("id", idea.id);
    if (error) {
      toast.error("Couldn't update that idea", { description: error.message });
      load();
    }
  };

  const dateLabel = ideas[0]?.idea_date ? format(parseISO(ideas[0].idea_date), "EEE, MMM d") : "";

  return (
    <section className="adm-panel p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#FF5910]/30 bg-[#FF5910]/12 text-[#FF7A3D]">
            <Lightbulb className="h-4.5 w-4.5" />
          </span>
          <div>
            <h2 className="text-white">Today's video ideas</h2>
            <p className="text-[11px] text-slate-500">
              {loaded ? (dateLabel ? `${dateLabel} · new pair every morning at 5 AM` : "First pair lands at 5 AM") : "Loading…"}
            </p>
          </div>
        </div>
        <span className="adm-chip text-slate-500">{loaded ? `${unusedCount} unused` : "—"}</span>
      </div>

      {loaded && ideas.length === 0 && (
        <p className="py-6 text-center text-sm text-slate-500">No ideas yet. They'll show up here after the next 5 AM run.</p>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {ideas.map((idea) => {
          const hot = idea.style === "hot_take";
          return (
            <div
              key={idea.id}
              className={`rounded-xl border p-4 transition-opacity ${
                idea.used ? "border-white/5 bg-white/[0.02] opacity-60" : "border-white/10 bg-white/[0.04]"
              }`}
            >
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 adm-chip ${
                    hot
                      ? "border-[#FF5910]/30 bg-[#FF5910]/12 text-[#FF7A3D]"
                      : "border-[#1E5FBF]/30 bg-[#1E5FBF]/12 text-[#4F8FE8]"
                  }`}
                >
                  {hot ? <Flame className="h-3 w-3" /> : <BookOpen className="h-3 w-3" />}
                  {hot ? "Hot take" : "Informative"}
                </span>
                {idea.category && <span className="adm-chip text-slate-500">{prettyCategory(idea.category)}</span>}
              </div>

              <p className="adm-display text-sm font-bold text-white">{idea.headline}</p>
              {idea.description && <p className="mt-1 text-xs text-slate-400">{idea.description}</p>}

              <div className="mt-3 flex items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1">
                  {sortPlatforms(idea.platforms).map((p, i) => (
                    <span
                      key={p}
                      className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                        i === 0 ? "bg-white/15 text-white" : "bg-white/5 text-slate-400"
                      }`}
                    >
                      {PLATFORM_LABELS[p] ?? p}
                    </span>
                  ))}
                </div>
                <button
                  onClick={() => toggleUsed(idea)}
                  className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-white"
                >
                  {idea.used ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <Circle className="h-4 w-4" />}
                  {idea.used ? "Made it" : "Mark made"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
