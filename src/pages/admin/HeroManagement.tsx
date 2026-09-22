import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Plus, Trash2, Save, GripVertical, ChevronDown, ChevronUp, Eye, EyeOff, Image as ImageIcon, ImagePlus, Loader2, Search, X, Images } from "lucide-react";
import { AdminPage, AdminPageHeader, AdminLoading } from "@/components/admin/AdminUI";
import { Badge } from "@/components/ui/badge";
import {
  DndContext, closestCenter, KeyboardSensor, MouseSensor, TouchSensor, useSensor, useSensors, DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface HeroSlide {
  id: string;
  title: string;
  description: string;
  image_url: string | null;
  display_order: number;
  is_for_members: boolean;
  published: boolean;
  blog_post_id: string | null;
  link_url: string | null;
  link_text: string | null;
  show_watch_live: boolean;
  show_reminder: boolean;
}

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  featured_image_url: string | null;
  excerpt: string | null;
}

interface MediaFile {
  file_url: string;
  file_name: string;
  file_type: string | null;
}

// Media Library Image Picker
const MediaImagePicker = ({ imageUrl, onImageChange }: { imageUrl: string | null; onImageChange: (url: string) => void }) => {
  const [open, setOpen] = useState(false);
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [fetched, setFetched] = useState(false);

  const fetchMedia = async () => {
    if (fetched) return;
    setLoading(true);
    const { data } = await supabase
      .from("media_library")
      .select("file_url, file_name, file_type")
      .or("file_type.ilike.%image%,file_type.ilike.%video%,file_name.ilike.%.jpg,file_name.ilike.%.png,file_name.ilike.%.jpeg,file_name.ilike.%.webp,file_name.ilike.%.gif,file_name.ilike.%.mp4,file_name.ilike.%.webm,file_name.ilike.%.mov")
      .order("created_at", { ascending: false })
      .limit(200);
    setMediaFiles(data || []);
    setLoading(false);
    setFetched(true);
  };

  const handleOpen = () => {
    setOpen(true);
    setSearch("");
    fetchMedia();
  };

  const selectImage = (url: string) => {
    onImageChange(url);
    setOpen(false);
  };

  const filtered = search
    ? mediaFiles.filter(f => f.file_name.toLowerCase().includes(search.toLowerCase()))
    : mediaFiles;

  const isVideo = (url: string) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);

  return (
    <div className="space-y-1">
      <Label className="text-[10px]">Image / GIF / Video</Label>
      {imageUrl ? (
        <div className="relative group">
          {isVideo(imageUrl) ? (
            <video src={imageUrl} muted loop playsInline autoPlay className="w-full h-20 rounded object-cover border border-border" />
          ) : (
            <img src={imageUrl} alt="" className="w-full h-20 rounded object-cover border border-border" />
          )}
          <button onClick={handleOpen} className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded text-[10px] text-white gap-1">
            <ImagePlus className="w-3 h-3" /> Replace
          </button>
        </div>
      ) : (
        <button onClick={handleOpen} className="w-full h-20 rounded border-2 border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center gap-1 transition-colors">
          <ImagePlus className="w-4 h-4 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground">Select from Media</span>
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <ImagePlus className="w-4 h-4" /> Select Image, GIF, or Video
            </DialogTitle>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
            <Input placeholder="Search media files..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
            {search && (
              <Button variant="ghost" size="sm" className="absolute right-1 top-1 h-6 w-6 p-0" onClick={() => setSearch("")}>
                <X className="w-3 h-3" />
              </Button>
            )}
          </div>
          <ScrollArea className="h-[50vh]">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-12">
                {search ? "No matching files found" : "No media available"}
              </p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 p-1">
                {filtered.map((file, i) => (
                  <button
                    key={i}
                    onClick={() => selectImage(file.file_url)}
                    className="aspect-video rounded-md overflow-hidden border border-border hover:border-primary hover:ring-2 hover:ring-primary/30 transition-all cursor-pointer group relative"
                  >
                    {isVideo(file.file_url) ? (
                      <video src={file.file_url} muted loop playsInline className="w-full h-full object-cover" preload="metadata" />
                    ) : (
                      <img src={file.file_url} alt={file.file_name} className="w-full h-full object-cover" loading="lazy" />
                    )}
                    {isVideo(file.file_url) && (
                      <span className="absolute top-1 left-1 text-[8px] bg-black/70 text-white px-1 rounded">VIDEO</span>
                    )}
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
    </div>
  );
};

// Compact sortable slide row
const SortableSlideRow = ({
  slide, index, blogPosts, saving, expanded, onToggle, onUpdate, onLinkBlog, onSave, onDelete,
}: {
  slide: HeroSlide; index: number; blogPosts: BlogPost[]; saving: boolean; expanded: boolean;
  onToggle: () => void;
  onUpdate: (id: string, field: keyof HeroSlide, value: string | boolean | number | null) => void;
  onLinkBlog: (slideId: string, blogId: string | null) => void;
  onSave: (slide: HeroSlide) => void;
  onDelete: (id: string) => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: slide.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <Card ref={setNodeRef} style={style} className={`border-border overflow-hidden ${isDragging ? 'ring-2 ring-primary' : ''}`}>
      <div className="flex items-center gap-1.5 px-2 py-1.5 cursor-pointer" onClick={onToggle}>
        <div {...attributes} {...listeners} style={{ touchAction: "none" }} className="cursor-grab active:cursor-grabbing p-2 hover:bg-muted rounded select-none" onClick={e => e.stopPropagation()}>
          <GripVertical className="w-3.5 h-3.5 text-muted-foreground" />
        </div>
        {slide.image_url ? (
          <img src={slide.image_url} alt="" className="w-10 h-6 rounded object-cover flex-shrink-0" />
        ) : (
          <div className="w-10 h-6 rounded bg-muted flex items-center justify-center flex-shrink-0">
            <ImageIcon className="w-3 h-3 text-muted-foreground" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">{slide.title || "Untitled"}</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Badge variant={slide.is_for_members ? "default" : "secondary"} className="text-[9px] px-1 py-0 h-4">
            {slide.is_for_members ? "Members" : "Public"}
          </Badge>
          <button onClick={e => { e.stopPropagation(); onUpdate(slide.id, "published", !slide.published); }} className="p-0.5" title={slide.published ? "Published" : "Draft"}>
            {slide.published ? <Eye className="w-3.5 h-3.5 text-green-500" /> : <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />}
          </button>
          {expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
        </div>
      </div>

      {expanded && (
        <CardContent className="px-2 pb-2 pt-0 space-y-2 border-t border-border/50">
          <div className="grid grid-cols-2 gap-1.5 pt-1.5">
            <div>
              <Label className="text-[10px]">Title</Label>
              <Input value={slide.title} onChange={e => onUpdate(slide.id, "title", e.target.value)} className="h-7 text-xs" />
            </div>
            <MediaImagePicker imageUrl={slide.image_url} onImageChange={url => onUpdate(slide.id, "image_url", url)} />
          </div>

          <div>
            <Label className="text-[10px]">Description</Label>
            <Textarea value={slide.description} onChange={e => onUpdate(slide.id, "description", e.target.value)} rows={2} className="text-xs min-h-[48px]" />
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <Label className="text-[10px]">Button Text</Label>
              <Input value={slide.link_text || ""} onChange={e => onUpdate(slide.id, "link_text", e.target.value)} className="h-7 text-xs" placeholder="e.g. Watch Now" />
            </div>
            <div>
              <Label className="text-[10px]">Button URL</Label>
              <Input value={slide.link_url || ""} onChange={e => onUpdate(slide.id, "link_url", e.target.value || null)} className="h-7 text-xs" placeholder="/pricing" />
            </div>
          </div>

          <div>
            <Label className="text-[10px]">Link to Blog</Label>
            <Select value={slide.blog_post_id || "none"} onValueChange={v => onLinkBlog(slide.id, v === "none" ? null : v)}>
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {blogPosts.map(b => <SelectItem key={b.id} value={b.id}>{b.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-1 pt-1">
            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
              <label className="flex items-center gap-1 text-[10px]">
                <Switch checked={slide.is_for_members} onCheckedChange={c => onUpdate(slide.id, "is_for_members", c)} className="scale-75" />
                Members
              </label>
              <label className="flex items-center gap-1 text-[10px]">
                <Switch checked={slide.show_watch_live} onCheckedChange={c => onUpdate(slide.id, "show_watch_live", c)} className="scale-75" />
                Watch Live
              </label>
              <label className="flex items-center gap-1 text-[10px]">
                <Switch checked={slide.show_reminder ?? false} onCheckedChange={c => onUpdate(slide.id, "show_reminder", c)} className="scale-75" />
                Reminder
              </label>
              <label className="flex items-center gap-1 text-[10px]">
                <Switch checked={slide.published} onCheckedChange={c => onUpdate(slide.id, "published", c)} className="scale-75" />
                Published
              </label>
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => onDelete(slide.id)} className="h-6 px-2 text-destructive text-[10px]">
                <Trash2 className="w-3 h-3 mr-1" /> Delete
              </Button>
              <Button size="sm" onClick={() => onSave(slide)} disabled={saving} className="h-6 px-2 text-[10px]">
                <Save className="w-3 h-3 mr-1" /> Save
              </Button>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
};

const HeroManagement = () => {
  const [slides, setSlides] = useState<HeroSlide[]>([]);
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<"all" | "members" | "public">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const fetchData = async () => {
    try {
      const [slidesRes, blogsRes] = await Promise.all([
        supabase.from("hero_slides").select("*").order("display_order", { ascending: true }),
        supabase.from("blog_posts").select("id, title, slug, featured_image_url, excerpt").eq("published", true).order("published_at", { ascending: false }).limit(50),
      ]);
      if (slidesRes.error) throw slidesRes.error;
      if (blogsRes.error) throw blogsRes.error;
      setSlides(slidesRes.data || []);
      setBlogPosts(blogsRes.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = slides.findIndex(s => s.id === active.id);
      const newIndex = slides.findIndex(s => s.id === over.id);
      const newSlides = arrayMove(slides, oldIndex, newIndex).map((slide, i) => ({ ...slide, display_order: i + 1 }));
      setSlides(newSlides);
      try {
        await Promise.all(newSlides.map(s => supabase.from("hero_slides").update({ display_order: s.display_order }).eq("id", s.id)));
        toast.success("Order updated");
      } catch { toast.error("Failed to update order"); fetchData(); }
    }
  };

  const addSlide = async () => {
    try {
      const newOrder = slides.length > 0 ? Math.max(...slides.map(s => s.display_order)) + 1 : 1;
      const { data, error } = await supabase.from("hero_slides").insert({
        title: "New Slide",
        description: "Enter description",
        image_url: null,
        link_url: null,
        link_text: null,
        display_order: newOrder,
        is_for_members: true,
        published: false,
        show_watch_live: true,
      }).select().single();
      if (error) throw error;
      setSlides([...slides, data]);
      setExpandedId(data.id);
      toast.success("Slide added");
    } catch { toast.error("Failed to add slide"); }
  };

  const updateSlide = (id: string, field: keyof HeroSlide, value: string | boolean | number | null) => {
    setSlides(slides.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const linkBlogPost = (slideId: string, blogId: string | null) => {
    const blog = blogPosts.find(b => b.id === blogId);
    setSlides(slides.map(s => {
      if (s.id !== slideId) return s;
      if (blog) return { ...s, blog_post_id: blogId, title: blog.title, description: blog.excerpt || s.description, image_url: blog.featured_image_url || s.image_url, link_url: `/blog/${blog.slug}`, link_text: "Read Article" };
      return { ...s, blog_post_id: null, link_url: null };
    }));
  };

  const saveSlide = async (slide: HeroSlide) => {
    setSaving(true);
    try {
      const { error } = await supabase.from("hero_slides").update({
        title: slide.title, description: slide.description, image_url: slide.image_url,
        display_order: slide.display_order, is_for_members: slide.is_for_members, published: slide.published,
        blog_post_id: slide.blog_post_id, link_url: slide.link_url, link_text: slide.link_text, show_watch_live: slide.show_watch_live, show_reminder: slide.show_reminder ?? false,
      }).eq("id", slide.id);
      if (error) throw error;
      toast.success("Saved");
    } catch { toast.error("Failed to save"); }
    finally { setSaving(false); }
  };

  const deleteSlide = async (id: string) => {
    if (!confirm("Delete this slide?")) return;
    try {
      const { error } = await supabase.from("hero_slides").delete().eq("id", id);
      if (error) throw error;
      setSlides(slides.filter(s => s.id !== id));
      if (expandedId === id) setExpandedId(null);
      toast.success("Deleted");
    } catch { toast.error("Failed to delete"); }
  };

  const filteredSlides = slides.filter(s => filter === "all" || (filter === "members" ? s.is_for_members : !s.is_for_members));

  if (loading) return <AdminLoading />;

  return (
    <AdminPage>
      <AdminPageHeader
        icon={Images}
        title="Hero Slides"
        count={slides.length}
        actions={
          <Button size="sm" onClick={addSlide} className="h-8 text-xs gap-1">
            <Plus className="w-3.5 h-3.5" /> Add Slide
          </Button>
        }
      />

      {/* Filter tabs */}
      <div className="flex gap-1">
        {(["all", "public", "members"] as const).map(f => (
          <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)} className="h-6 text-[10px] px-2 capitalize">
            {f} ({f === "all" ? slides.length : slides.filter(s => f === "members" ? s.is_for_members : !s.is_for_members).length})
          </Button>
        ))}
      </div>

      {/* Slides list */}
      {filteredSlides.length === 0 ? (
        <p className="text-center text-muted-foreground text-xs py-8">No slides. Click Add to create one.</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={filteredSlides.map(s => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-1.5">
              {filteredSlides.map((slide, index) => (
                <SortableSlideRow
                  key={slide.id}
                  slide={slide}
                  index={index}
                  blogPosts={blogPosts}
                  saving={saving}
                  expanded={expandedId === slide.id}
                  onToggle={() => setExpandedId(expandedId === slide.id ? null : slide.id)}
                  onUpdate={updateSlide}
                  onLinkBlog={linkBlogPost}
                  onSave={saveSlide}
                  onDelete={deleteSlide}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </AdminPage>
  );
};

export default HeroManagement;
