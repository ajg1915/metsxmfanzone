import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mic, Video, Upload, Film, Radio } from "lucide-react";
import LiveStudioTab from "@/components/admin/studio/LiveStudioTab";
import EpisodesTab from "@/components/admin/studio/EpisodesTab";
import FilmRoomTab from "@/components/admin/studio/FilmRoomTab";
import TurboUploadTab from "@/components/admin/studio/TurboUploadTab";

export default function ClubhouseStudio() {
  const [activeTab, setActiveTab] = useState("episodes");
  const [editingEpisodeId, setEditingEpisodeId] = useState<string | null>(null);

  const handleEditEpisode = (id: string) => {
    setEditingEpisodeId(id);
    setActiveTab("film-room");
  };

  return (
    <div className="w-full max-w-full overflow-hidden px-1 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Radio className="w-4 h-4 text-primary flex-shrink-0" />
        <div className="min-w-0">
          <h1 className="text-sm sm:text-base font-bold truncate">The Clubhouse Studio</h1>
          <p className="text-[10px] text-muted-foreground">
            Major League Content Production
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 h-11 bg-muted/60 backdrop-blur-sm border border-border/50">
          <TabsTrigger value="live-studio" className="gap-1.5 text-xs sm:text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-red-500 data-[state=active]:text-white">
            <Video className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Live Studio</span>
            <span className="sm:hidden">Studio</span>
          </TabsTrigger>
          <TabsTrigger value="episodes" className="gap-1.5 text-xs sm:text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-red-500 data-[state=active]:text-white">
            <Mic className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Episodes</span>
            <span className="sm:hidden">Eps</span>
          </TabsTrigger>
          <TabsTrigger value="film-room" className="gap-1.5 text-xs sm:text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-red-500 data-[state=active]:text-white">
            <Film className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Film Room</span>
            <span className="sm:hidden">Edit</span>
          </TabsTrigger>
          <TabsTrigger value="turbo-upload" className="gap-1.5 text-xs sm:text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-red-500 data-[state=active]:text-white">
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Turbo Upload</span>
            <span className="sm:hidden">Upload</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="live-studio" className="mt-4">
          <LiveStudioTab />
        </TabsContent>
        <TabsContent value="episodes" className="mt-4">
          <EpisodesTab onEditEpisode={handleEditEpisode} />
        </TabsContent>
        <TabsContent value="film-room" className="mt-4">
          <FilmRoomTab episodeId={editingEpisodeId} onBack={() => { setEditingEpisodeId(null); setActiveTab("episodes"); }} />
        </TabsContent>
        <TabsContent value="turbo-upload" className="mt-4">
          <TurboUploadTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
