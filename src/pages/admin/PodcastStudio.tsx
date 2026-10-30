import { useCallback, useEffect, useState } from "react";
import { Mic, Plus, Video } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllShows, type LenoreEpisode } from "@/lib/lenore";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminPage, AdminPageHeader } from "@/components/admin/AdminUI";
import PodcastAudioRecorder from "@/components/PodcastAudioRecorder";
import StudioShowCard from "@/components/admin/studio/StudioShowCard";
import ShowEditorDialog from "@/components/admin/studio/ShowEditorDialog";
import { Button } from "@/components/ui/button";
import StudioEpisodes from "@/components/admin/studio/StudioEpisodes";
import TurboUploadTab from "@/components/admin/studio/TurboUploadTab";

/** One page for the show editor, recording or uploading audio, fan art, and the episode list. */
export default function PodcastStudio() {
  const [shows, setShows] = useState<LenoreEpisode[] | null>(null);
  const [error, setError] = useState(false);
  const [haveAudio, setHaveAudio] = useState<number[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [episodesKey, setEpisodesKey] = useState(0);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<LenoreEpisode | null>(null);

  const hasAudio = useCallback(
    (s: LenoreEpisode) => haveAudio.includes(new Date(s.available).getTime()),
    [haveAudio],
  );

  const load = useCallback(async () => {
    try {
      setShows(await fetchAllShows());
      setError(false);
    } catch {
      setError(true);
    }
    const { data } = await supabase.from("podcasts").select("published_at").not("published_at", "is", null);
    setHaveAudio((data || []).map((r: any) => new Date(r.published_at).getTime()));
  }, []);

  useEffect(() => { load(); }, [load]);

  // Start on the soonest show that still needs audio.
  useEffect(() => {
    if (selectedId || !shows) return;
    const next = shows.find((s) => !hasAudio(s));
    if (next) setSelectedId(next.id);
  }, [shows, selectedId, hasAudio]);

  const selected = shows?.find((s) => s.id === selectedId) ?? null;

  return (
    <AdminPage>
      <AdminPageHeader
        icon={Mic}
        title="Podcast Studio"
        description="Create shows, add fan art, record or upload audio and manage episodes"
      />

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4">
          <section className="space-y-2" aria-labelledby="studio-shows">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="studio-shows" className="text-base font-extrabold uppercase tracking-wide">Shows</h2>
                <p className="text-sm text-muted-foreground">
                  Add a show with a title, date and fan art. Pick one to record or upload it. Each goes live on its own at the time shown.
                </p>
              </div>
              <Button type="button" className="h-11 shrink-0" onClick={() => { setEditing(null); setEditorOpen(true); }}>
                <Plus className="mr-1.5 h-4 w-4" /> New show
              </Button>
            </div>
            {error && <p role="alert" className="text-sm text-destructive">Could not load the shows. Try again in a minute.</p>}
            {!shows && !error && <p className="text-sm text-muted-foreground">Loading shows...</p>}
            {shows && shows.length === 0 && (
              <p className="text-sm text-muted-foreground">No shows yet. Tap New show to add your first one.</p>
            )}
            {shows?.map((s) => (
              <StudioShowCard
                key={s.id}
                show={s}
                selected={s.id === selectedId}
                hasAudio={hasAudio(s)}
                onSelect={() => setSelectedId(s.id)}
                onEdit={() => { setEditing(s); setEditorOpen(true); }}
              />
            ))}
          </section>

          <section aria-labelledby="studio-add" className="space-y-2">
            <h2 id="studio-add" className="text-base font-extrabold uppercase tracking-wide">Add audio</h2>
            <Tabs defaultValue="audio">
              <TabsList className="grid h-11 w-full grid-cols-2">
                <TabsTrigger value="audio" className="gap-1.5"><Mic className="h-4 w-4" /> Record or upload</TabsTrigger>
                <TabsTrigger value="video" className="gap-1.5"><Video className="h-4 w-4" /> Video upload</TabsTrigger>
              </TabsList>
              <TabsContent value="audio" className="mt-3">
                <PodcastAudioRecorder
                  lenoreMode
                  show={selected}
                  onAttached={() => {
                    setSelectedId("");
                    load();
                    setEpisodesKey((k) => k + 1);
                  }}
                />
              </TabsContent>
              <TabsContent value="video" className="mt-3">
                <TurboUploadTab />
              </TabsContent>
            </Tabs>
          </section>
        </div>

        <div className="min-w-0">
          <StudioEpisodes key={episodesKey} />
        </div>
      </div>
      <ShowEditorDialog open={editorOpen} onOpenChange={setEditorOpen} show={editing} onSaved={() => { setSelectedId(""); load(); }} />
    </AdminPage>
  );
}
