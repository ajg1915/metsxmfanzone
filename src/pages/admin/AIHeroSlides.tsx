import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Sparkles, Loader2, Trash2, Eye, EyeOff, RefreshCw, ImagePlus, Search, X } from "lucide-react";
import { AdminPage, AdminPageHeader, AdminEmpty, AdminLoading } from "@/components/admin/AdminUI";

interface HeroSlide {
  id: string;
  title: string;
  description: string;
  image_url: string | null;
  link_url: string | null;
  link_text: string | null;
  published: boolean;
  is_for_members: boolean;
  is_ai_generated: boolean;
  show_watch_live: boolean;
  display_order: number;
  created_at: string;
}

interface MediaFile {
  file_url: string;
  file_name: string;
  file_type: string | null;
}

export default function AIHeroSlides() {
  const { toast } = useToast();
  const [slides, setSlides] = useState<HeroSlide[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [slideCount, setSlideCount] = useState(3);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [mediaPickerSlideId, setMediaPickerSlideId] = useState<string | null>(null);
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaSearch, setMediaSearch] = useState("");

  const fetchSlides = async () => {
    const { data } = await supabase
      .from("hero_slides")
      .select("*")
      .eq("is_ai_generated", true)
      .order("created_at", { ascending: false });
    setSlides((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { fetchSlides(); }, []);

  const fetchMediaFiles = async () => {
    setMediaLoading(true);
    const { data } = await supabase
      .from("media_library")
      .select("file_url, file_name, file_type")
      .or("file_type.ilike.%image%,file_name.ilike.%.jpg,file_name.ilike.%.png,file_name.ilike.%.jpeg,file_name.ilike.%.webp")
      .order("created_at", { ascending: false })
      .limit(200);
    setMediaFiles(data || []);
    setMediaLoading(false);
  };

  const openMediaPicker = (slideId: string) => {
    setMediaPickerSlideId(slideId);
    setMediaPickerOpen(true);
    setMediaSearch("");
    if (mediaFiles.length === 0) fetchMediaFiles();
  };

  const selectMediaImage = async (fileUrl: string) => {
    if (!mediaPickerSlideId) return;
    await supabase.from("hero_slides").update({ image_url: fileUrl }).eq("id", mediaPickerSlideId);
    setSlides(prev => prev.map(s => s.id === mediaPickerSlideId ? { ...s, image_url: fileUrl } : s));
    setMediaPickerOpen(false);
    setMediaPickerSlideId(null);
    toast({ title: "Image Updated", description: "Slide image replaced from media library" });
  };

  const generateSlides = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-ai-hero-slides", {
        body: { count: slideCount },
      });
      if (error) throw error;
      if (data?.error) {
        toast({ title: "Generation Failed", description: data.error, variant: "destructive" });
      } else {
        toast({ title: "Slides Generated!", description: `${data.slides_generated} AI hero slides created.` });
        fetchSlides();
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to generate slides", variant: "destructive" });
    }
    setGenerating(false);
  };

  const togglePublish = async (id: string, current: boolean) => {
    await supabase.from("hero_slides").update({ published: !current }).eq("id", id);
    setSlides(prev => prev.map(s => s.id === id ? { ...s, published: !current } : s));
  };

  const deleteSlide = async (id: string) => {
    await supabase.from("hero_slides").delete().eq("id", id);
    setSlides(prev => prev.filter(s => s.id !== id));
    toast({ title: "Deleted", description: "AI slide removed" });
  };

  const deleteAllAI = async () => {
    await supabase.from("hero_slides").delete().eq("is_ai_generated", true);
    setSlides([]);
    toast({ title: "Cleared", description: "All AI slides removed" });
  };

  const filteredMedia = mediaSearch
    ? mediaFiles.filter(f => f.file_name.toLowerCase().includes(mediaSearch.toLowerCase()))
    : mediaFiles;

  return (
    <AdminPage>
      <AdminPageHeader
        icon={Sparkles}
        title="AI Hero Slides"
        count={slides.length}
        description="Auto-generate branded Mets hero slides — images from your media library"
        actions={
          <>
            <select
              value={slideCount}
              onChange={e => setSlideCount(Number(e.target.value))}
              className="h-7 rounded border border-muted/40 bg-muted/30 text-[10px] px-2"
            >
              {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} slide{n > 1 ? "s" : ""}</option>)}
            </select>
            <Button onClick={generateSlides} disabled={generating} size="sm" className="h-8 text-xs gap-1.5">
              {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {generating ? "Generating..." : "Generate Slides"}
            </Button>
          </>
        }
      />

      {generating && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <div>
              <p className="font-medium text-sm">Generating AI Hero Slides...</p>
              <p className="text-xs text-muted-foreground">Analyzing content & selecting images from your media library. ~15-30 seconds.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {slides.length > 0 && (
        <div className="flex justify-between items-center">
          <p className="text-xs text-muted-foreground">{slides.length} AI slide{slides.length !== 1 ? "s" : ""}</p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={fetchSlides} className="gap-1">
              <RefreshCw className="w-3 h-3" /> Refresh
            </Button>
            <Button variant="destructive" size="sm" onClick={deleteAllAI} className="gap-1">
              <Trash2 className="w-3 h-3" /> Clear All AI
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <AdminLoading />
      ) : slides.length === 0 ? (
        <AdminEmpty message='Click "Generate Slides" to create branded hero slides from your Mets content.' />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {slides.map(slide => (
            <Card key={slide.id} className="overflow-hidden">
              <div className="aspect-video bg-muted relative overflow-hidden group">
                {slide.image_url ? (
                  <img src={slide.image_url} alt={slide.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <ImagePlus className="w-8 h-8" />
                  </div>
                )}
                <div className="absolute top-1 right-1 flex gap-1">
                  <Badge variant={slide.published ? "default" : "secondary"} className="text-[9px]">
                    {slide.published ? "Live" : "Draft"}
                  </Badge>
                  <Badge variant="outline" className="text-[9px] bg-background/80">
                    {slide.is_for_members ? "Members" : "Public"}
                  </Badge>
                </div>
                {/* Replace Image button */}
                <Button
                  variant="secondary"
                  size="sm"
                  className="absolute bottom-1 left-1 h-6 text-[10px] gap-1 opacity-80 hover:opacity-100"
                  onClick={() => openMediaPicker(slide.id)}
                >
                  <ImagePlus className="w-3 h-3" />
                  {slide.image_url ? "Replace Image" : "Add Image"}
                </Button>
              </div>
              <CardHeader className="p-2">
                <CardTitle className="line-clamp-1">{slide.title}</CardTitle>
                <CardDescription className="line-clamp-2">{slide.description}</CardDescription>
              </CardHeader>
              <CardContent className="p-2 pt-0 flex items-center justify-between">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  {slide.link_text && <Badge variant="outline" className="text-[9px]">{slide.link_text} → {slide.link_url}</Badge>}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => togglePublish(slide.id, slide.published)} className="h-6 w-6 p-0">
                    {slide.published ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => deleteSlide(slide.id)} className="h-6 w-6 p-0 text-destructive">
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Media Library Picker Dialog */}
      <Dialog open={mediaPickerOpen} onOpenChange={setMediaPickerOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ImagePlus className="w-4 h-4" /> Select Image from Media Library
            </DialogTitle>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search media files..."
              value={mediaSearch}
              onChange={e => setMediaSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
            {mediaSearch && (
              <Button variant="ghost" size="sm" className="absolute right-1 top-1 h-6 w-6 p-0" onClick={() => setMediaSearch("")}>
                <X className="w-3 h-3" />
              </Button>
            )}
          </div>
          <ScrollArea className="h-[50vh]">
            {mediaLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : filteredMedia.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-12">
                {mediaSearch ? "No matching images found" : "No images in media library"}
              </p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 p-1">
                {filteredMedia.map((file, i) => (
                  <button
                    key={i}
                    onClick={() => selectMediaImage(file.file_url)}
                    className="aspect-video rounded-md overflow-hidden border border-border hover:border-primary hover:ring-2 hover:ring-primary/30 transition-all cursor-pointer group relative"
                  >
                    <img
                      src={file.file_url}
                      alt={file.file_name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-1">
                      <span className="text-[9px] text-foreground truncate w-full">{file.file_name}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </AdminPage>
  );
}
