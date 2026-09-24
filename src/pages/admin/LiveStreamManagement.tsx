import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isAutoStartMetsGame } from "@/lib/metsGameCheck";
import { TikTokLiveToggle } from "@/components/admin/TikTokLiveToggle";

// Team matchup preset images
import fanartMetsAway from "@/assets/fanart-mets-away.jpg";
import fanartMetsBraves from "@/assets/fanart-mets-braves.jpg";
import fanartMetsDodgers from "@/assets/fanart-mets-dodgers.jpg";
import fanartMetsGeneral from "@/assets/fanart-mets-general.jpg";
import fanartMetsHome from "@/assets/fanart-mets-home.jpg";
import fanartMetsPhillies from "@/assets/fanart-mets-phillies.jpg";
import fanartMetsSpring from "@/assets/fanart-mets-spring.jpg";
import fanartMetsYankees from "@/assets/fanart-mets-yankees.jpg";
import springMetsAstros from "@/assets/spring-mets-astros.jpg";
import springMetsBraves from "@/assets/spring-mets-braves.jpg";
import springMetsCards from "@/assets/spring-mets-cards.jpg";
import springMetsNats from "@/assets/spring-mets-nats.jpg";
import springMetsRedsox from "@/assets/spring-mets-redsox.jpg";
import springMetsYankees from "@/assets/spring-mets-yankees.jpg";

const TEAM_PRESET_IMAGES = [
  { label: "Mets Home", src: fanartMetsHome },
  { label: "Mets Away", src: fanartMetsAway },
  { label: "Mets General", src: fanartMetsGeneral },
  { label: "vs Braves", src: fanartMetsBraves },
  { label: "vs Dodgers", src: fanartMetsDodgers },
  { label: "vs Phillies", src: fanartMetsPhillies },
  { label: "vs Yankees", src: fanartMetsYankees },
  { label: "Spring Training", src: fanartMetsSpring },
  { label: "ST vs Astros", src: springMetsAstros },
  { label: "ST vs Braves", src: springMetsBraves },
  { label: "ST vs Cardinals", src: springMetsCards },
  { label: "ST vs Nationals", src: springMetsNats },
  { label: "ST vs Red Sox", src: springMetsRedsox },
  { label: "ST vs Yankees", src: springMetsYankees },
];
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useFreeStreams } from "@/hooks/useFreeStreams";

import { Trash2, Plus, Edit, Radio, Upload, X, Loader2, RotateCcw, GripVertical, Image, CheckSquare } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { uploadToR2 } from "@/lib/r2Upload";
import { AdminPage, AdminPageHeader, AdminLoading, AdminEmpty } from "@/components/admin/AdminUI";

interface LiveStream {
  id: string;
  title: string;
  description: string;
  stream_url: string;
  thumbnail_url: string;
  status: 'live' | 'scheduled' | 'ended';
  scheduled_start: string;
  scheduled_end: string;
  assigned_pages: string[];
  viewers_count: number;
  published: boolean;
  created_at: string;
  display_order: number;
}

const PAGE_LABELS: Record<string, string> = { guide: 'Guide Page', live: 'Live Page', metsxmfanzone: 'MetsXMFanZone TV', 'metsxmfanzone-2': 'MetsXMFanZone Stream 2 24/7 (Sports Network Streams)', 'mlb-network': 'MLB Network 24/7 (Sports Network Streams)', 'sny-tv': 'SNY.TV 24/7 (Sports Network Streams)', 'msg-network': 'MSG Network 24/7 (Sports Network Streams)', 'espn-network': 'ESPN 24/7 (Sports Network Streams)', 'pix11-network': 'Game Events (non-Mets)', 'ny-jets': 'New York Jets', 'ny-giants': 'New York Giants', 'ny-knicks': 'New York Knicks', 'ny-rangers': 'New York Rangers', 'ny-islanders': 'New York Islanders', 'brooklyn-nets': 'Brooklyn Nets', 'regular-season-games': 'Regular Season Games', 'replay-games': 'Replay Games' };

const WATCH_PAGE_OPTIONS = [
  { value: 'own', label: 'Own stream page (/live/…)' },
  { value: 'metsxmfanzone', label: 'MetsXMFanZone TV' },
  { value: 'metsxmfanzone-2', label: 'MetsXMFanZone Stream 2 24/7' },
  { value: 'pix11-network', label: 'Game Events (non-Mets games & events)' },
];

const SPORTS_EVENTS_STREAM_URL = "https://mystream.metsxmfanzone.com/hls/mystream.m3u8";
const PIX11_STREAM_URL = "https://video1.getstreamhosting.com:1936/resyweugpd/resyweugpd/playlist.m3u8";

const getWatchPage = (pages: string[] | null | undefined) => {
  if (pages?.includes('metsxmfanzone')) return 'metsxmfanzone';
  if (pages?.includes('metsxmfanzone-2')) return 'metsxmfanzone-2';
  if (pages?.includes('pix11-network')) return 'pix11-network';
  return 'own';
};

function SortableStreamCard({ stream, onEdit, onDelete, getStatusBadge, selected, onToggleSelect, isFreeGame, onToggleFree, onSelectWatchPage, onToggleLive }: {
  stream: LiveStream;
  onEdit: (s: LiveStream) => void;
  onDelete: (id: string) => void;
  getStatusBadge: (status: string) => string;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  isFreeGame: boolean;
  onToggleFree: (id: string, free: boolean) => void;
  onSelectWatchPage: (id: string, page: string) => void;
  onToggleLive: (stream: LiveStream, target?: "scheduled") => void;
}) {

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stream.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card ref={setNodeRef} style={style} className={`relative min-w-0 max-w-full overflow-hidden transition-colors ${selected ? 'ring-2 ring-primary' : ''}`}>
      <div className="absolute top-2 right-2 z-10">
        <Checkbox checked={selected} onCheckedChange={() => onToggleSelect(stream.id)} />
      </div>
      <div {...attributes} {...listeners} style={{ touchAction: "none" }} className="absolute top-2 left-2 z-10 cursor-grab active:cursor-grabbing p-2 rounded bg-background/80 backdrop-blur-sm select-none">
        <GripVertical className="w-4 h-4 text-muted-foreground" />
      </div>
      <CardHeader className="pb-3 pl-10 pr-10">
        {stream.thumbnail_url && (
          <div className="aspect-video overflow-hidden rounded-md mb-2 bg-muted">
            <img src={stream.thumbnail_url} alt={stream.title} className="w-full h-full object-cover" />
          </div>
        )}
        <div className="flex flex-wrap items-center gap-1.5 mb-2">
          <Badge className={getStatusBadge(stream.status)}>
            {stream.status === 'live' && <Radio className="w-3 h-3 mr-1" />}
            {stream.status.toUpperCase()}
          </Badge>
          {!stream.published && <Badge variant="outline">Draft</Badge>}
          {isFreeGame && <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">FREE GAME</Badge>}
        </div>
        <CardTitle className="line-clamp-2 text-base">{stream.title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-1.5 text-xs text-muted-foreground mb-3">
          <p>Assigned to: {stream.assigned_pages?.length > 0 ? stream.assigned_pages.map(p => PAGE_LABELS[p] || p).join(', ') : 'None'}</p>
          {stream.scheduled_start && <p>Starts: {new Date(stream.scheduled_start).toLocaleString()}</p>}
          <p>Viewers: {stream.viewers_count}</p>
        </div>
        <div className="mb-3 space-y-1 rounded-md border border-border/60 bg-muted/30 px-2 py-1.5">
          <Label className="text-[11px] font-medium">Watch page</Label>
          <Select
            value={getWatchPage(stream.assigned_pages)}
            onValueChange={(v) => onSelectWatchPage(stream.id, v)}
          >
            <SelectTrigger className="h-7 text-[11px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WATCH_PAGE_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[10px] text-muted-foreground">Where viewers land when they click this event.</p>
        </div>



        <div className="flex items-center justify-between gap-2 mb-3 rounded-md border border-border/60 bg-muted/30 px-2 py-1.5">
          <Label htmlFor={`free-${stream.id}`} className="text-[11px] font-medium leading-tight">
            Free for everyone
            <span className="block text-[10px] font-normal text-muted-foreground">No login or membership needed</span>
          </Label>
          <Switch
            id={`free-${stream.id}`}
            checked={isFreeGame}
            onCheckedChange={(v) => onToggleFree(stream.id, v)}
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={stream.status === "live" ? "secondary" : "default"}
            size="sm"
            onClick={() => onToggleLive(stream)}
            className="flex-1 h-7 text-xs"
          >
            <Radio className="w-3 h-3 mr-1" />
            {stream.status === "live" ? "End Live" : "Go Live"}
          </Button>
          {stream.status === "live" && (
            <Button variant="outline" size="sm" onClick={() => onToggleLive(stream, "scheduled")} className="flex-1 h-7 text-xs">
              Not Live Yet
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => onEdit(stream)} className="flex-1 h-7 text-xs">
            <Edit className="w-3 h-3 mr-1" /> Edit
          </Button>
          <Button variant="destructive" size="sm" onClick={() => onDelete(stream.id)} className="h-7 text-xs">
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function LiveStreamManagement() {
  const { toast } = useToast();
  const freeStreams = useFreeStreams();


  const handleSelectWatchPage = async (id: string, page: string) => {
    const stream = streams.find(s => s.id === id);
    if (!stream) return;
    const destinations = ['metsxmfanzone', 'metsxmfanzone-2', 'pix11-network'];
    const kept = (stream.assigned_pages || []).filter(p => !destinations.includes(p));
    const next = page === 'own' ? kept : [...kept, page];
    if (!next.includes('live')) next.push('live');

    const { error } = await supabase.from("live_streams").update({ assigned_pages: next }).eq("id", id);
    if (error) {
      toast({ title: "Failed to update watch page", variant: "destructive" });
      return;
    }
    setStreams(prev => prev.map(s => (s.id === id ? { ...s, assigned_pages: next } : s)));
    toast({ title: "Watch page updated", description: WATCH_PAGE_OPTIONS.find(o => o.value === page)?.label });
  };

  const handleToggleLive = async (stream: LiveStream, target?: "scheduled") => {
    if (target === "scheduled") {
      const updates = { status: "scheduled" as const, actual_start: null, actual_end: null };
      const { error } = await supabase.from("live_streams").update(updates).eq("id", stream.id);
      if (error) {
        toast({ title: "Could not update", description: error.message, variant: "destructive" });
        return;
      }
      setStreams(prev => prev.map(item => item.id === stream.id ? { ...item, ...updates } : item));
      toast({ title: "Back to scheduled", description: `${stream.title} now shows as Upcoming.` });
      return;
    }
    const goingLive = stream.status !== "live";
    const now = new Date().toISOString();
    const updates = goingLive
      ? { status: "live" as const, published: true, actual_start: now, actual_end: null }
      : { status: "ended" as const, actual_end: now };


    const { error } = await supabase.from("live_streams").update(updates).eq("id", stream.id);
    if (error) {
      toast({ title: "Could not update live status", description: error.message, variant: "destructive" });
      return;
    }

    if (goingLive) await sendLiveNotification(stream.title, stream.id);
    setStreams(prev => prev.map(item => item.id === stream.id ? { ...item, ...updates } : item));
    toast({
      title: goingLive ? "Stream is live" : "Stream ended",
      description: goingLive ? `${stream.title} is published in Live Streams now.` : stream.title,
    });
  };



  const handleToggleFree = async (id: string, free: boolean) => {
    try {
      await freeStreams.toggleStream(id, free);
      toast({
        title: free ? "Game set to free" : "Free access removed",
        description: free
          ? "Everyone can watch this game — no login or membership required."
          : "This game is back to members-only access.",
      });
    } catch (err) {
      console.error("Failed to update free game setting:", err);
      toast({ title: "Update failed", variant: "destructive" });
    }
  };
  const [streams, setStreams] = useState<LiveStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStream, setEditingStream] = useState<LiveStream | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [mediaItems, setMediaItems] = useState<{ id: string; file_url: string; file_name: string; file_type: string | null }[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  
  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkData, setBulkData] = useState({
    status: "" as "" | "live" | "scheduled" | "ended",
    published: "" as "" | "true" | "false",
    assigned_pages: [] as string[],
    applyPages: false,
    thumbnail_url: "",
    applyThumbnail: false,
  });
  const [bulkMediaPickerOpen, setBulkMediaPickerOpen] = useState(false);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === streams.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(streams.map(s => s.id)));
    }
  };

  const handleBulkEdit = async () => {
    const updates: Record<string, any> = {};
    if (bulkData.status) updates.status = bulkData.status;
    if (bulkData.published) updates.published = bulkData.published === "true";
    if (bulkData.applyPages) updates.assigned_pages = bulkData.assigned_pages;
    if (bulkData.applyThumbnail) updates.thumbnail_url = bulkData.thumbnail_url || null;

    if (Object.keys(updates).length === 0) {
      toast({ title: "No changes", description: "Select at least one field to update", variant: "destructive" });
      return;
    }

    try {
      for (const id of selectedIds) {
        const { error } = await supabase.from("live_streams").update(updates).eq("id", id);
        if (error) throw error;
      }
      toast({ title: "Bulk update complete", description: `Updated ${selectedIds.size} streams` });
      setSelectedIds(new Set());
      setBulkEditOpen(false);
      setBulkData({ status: "", published: "", assigned_pages: [], applyPages: false, thumbnail_url: "", applyThumbnail: false });
      fetchStreams();
    } catch (err) {
      console.error("Bulk update error:", err);
      toast({ title: "Bulk update failed", variant: "destructive" });
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.size} streams? This cannot be undone.`)) return;
    try {
      for (const id of selectedIds) {
        const { error } = await supabase.from("live_streams").delete().eq("id", id);
        if (error) throw error;
      }
      toast({ title: "Deleted", description: `${selectedIds.size} streams removed` });
      setSelectedIds(new Set());
      fetchStreams();
    } catch (err) {
      toast({ title: "Delete failed", variant: "destructive" });
    }
  };

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    stream_url: "",
    thumbnail_url: "",
    status: "scheduled" as 'live' | 'scheduled' | 'ended',
    scheduled_start: "",
    scheduled_end: "",
    assigned_pages: [] as string[],
    published: true,
  });

  const fetchMediaLibrary = async () => {
    setMediaLoading(true);
    try {
      const { data, error } = await supabase
        .from("media_library")
        .select("id, file_url, file_name, file_type")
        .or("file_type.ilike.image%,file_type.is.null")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      setMediaItems(data || []);
    } catch (err) {
      console.error("Failed to load media library:", err);
    } finally {
      setMediaLoading(false);
    }
  };

  // Auto-check stream statuses based on scheduled times
  const runAutoStatusCheck = async () => {
    try {
      const now = new Date().toISOString();
      
      // Start scheduled streams whose start time has passed
      const { data: toGoLive } = await supabase
        .from("live_streams")
        .select("id, title, assigned_pages")
        .eq("status", "scheduled")
        .eq("published", true)
        .lte("scheduled_start", now)
        .not("scheduled_start", "is", null);

      if (toGoLive && toGoLive.filter(isAutoStartMetsGame).length > 0) {
        for (const stream of toGoLive.filter(isAutoStartMetsGame)) {
          await supabase
            .from("live_streams")
            .update({ status: "live", actual_start: now })
            .eq("id", stream.id);
          sendLiveNotification(stream.title, stream.id);
        }
        toast({ title: "Streams auto-started", description: `${toGoLive.filter(isAutoStartMetsGame).length} stream(s) went live` });
      }

      // End live streams whose end time has passed
      const { data: toEnd } = await supabase
        .from("live_streams")
        .select("id")
        .eq("status", "live")
        .lte("scheduled_end", now)
        .not("scheduled_end", "is", null);

      if (toEnd && toEnd.length > 0) {
        for (const stream of toEnd) {
          await supabase
            .from("live_streams")
            .update({ status: "ended", actual_end: now })
            .eq("id", stream.id);
        }
        toast({ title: "Streams auto-ended", description: `${toEnd.length} stream(s) ended` });
      }

      if ((toGoLive && toGoLive.length > 0) || (toEnd && toEnd.length > 0)) {
        fetchStreams();
      }
    } catch (err) {
      console.error("Auto status check error:", err);
    }
  };

  useEffect(() => {
    fetchStreams();
    runAutoStatusCheck();

    // Check every 60 seconds for status transitions
    const interval = setInterval(runAutoStatusCheck, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchStreams = async () => {
    try {
      const { data, error } = await supabase
        .from("live_streams")
        .select("*")
        .order("scheduled_start", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      setStreams(data as LiveStream[] || []);
    } catch (error) {
      console.error("Error fetching streams:", error);
      toast({
        title: "Error",
        description: "Failed to load live streams",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const sendLiveNotification = async (title: string, streamId: string) => {
    try {
      await supabase.functions.invoke("send-push-notification", {
        body: {
          title: "🔴 LIVE NOW on MetsXMFanZone!",
          body: title,
          url: "/metsxmfanzone",
          icon: "/logo-192.png",
          tag: `live-stream-${streamId}`,
        },
      });
    } catch (err) {
      console.error("Push notification failed:", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const streamData = {
        ...formData,
        published: formData.status === "live" ? true : formData.published,
        assigned_pages: formData.assigned_pages.includes("live")
          ? formData.assigned_pages
          : [...formData.assigned_pages, "live"],
        scheduled_start: formData.scheduled_start || null,
        scheduled_end: formData.status === "live" && formData.scheduled_end && new Date(formData.scheduled_end) <= new Date()
          ? null
          : formData.scheduled_end || null,
        actual_start: formData.status === 'live' ? new Date().toISOString() : null,
      };

      if (editingStream) {
        const wasLive = editingStream.status === 'live';
        const nowLive = formData.status === 'live';

        const { error } = await supabase
          .from("live_streams")
          .update(streamData)
          .eq("id", editingStream.id);

        if (error) throw error;

        // Fire push if stream just went live
        if (!wasLive && nowLive) {
          await sendLiveNotification(formData.title, editingStream.id);
        }

        toast({
          title: "Success",
          description: `Live stream updated successfully${!wasLive && nowLive ? " — Push notification sent to all subscribers!" : ""}`,
        });
      } else {
        const { data: inserted, error } = await supabase
          .from("live_streams")
          .insert([streamData])
          .select()
          .single();

        if (error) throw error;

        // Fire push if created as live immediately
        if (formData.status === 'live' && inserted) {
          await sendLiveNotification(formData.title, inserted.id);
        }

        toast({
          title: "Success",
          description: `Live stream created successfully${formData.status === 'live' ? " — Push notification sent to all subscribers!" : ""}`,
        });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchStreams();
    } catch (error) {
      console.error("Error saving stream:", error);
      toast({
        title: "Error",
        description: "Failed to save live stream",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this live stream?")) return;

    try {
      const { error } = await supabase
        .from("live_streams")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Live stream deleted successfully",
      });
      fetchStreams();
    } catch (error) {
      console.error("Error deleting stream:", error);
      toast({
        title: "Error",
        description: "Failed to delete live stream",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (stream: LiveStream) => {
    setEditingStream(stream);
    setFormData({
      title: stream.title,
      description: stream.description || "",
      stream_url: stream.stream_url,
      thumbnail_url: stream.thumbnail_url || "",
      status: stream.status,
      scheduled_start: stream.scheduled_start ? new Date(stream.scheduled_start).toISOString().slice(0, 16) : "",
      scheduled_end: stream.scheduled_end ? new Date(stream.scheduled_end).toISOString().slice(0, 16) : "",
      assigned_pages: stream.assigned_pages || [],
      published: stream.published,
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingStream(null);
    setFormData({
      title: "",
      description: "",
      stream_url: "",
      thumbnail_url: "",
      status: "scheduled",
      scheduled_start: "",
      scheduled_end: "",
      assigned_pages: [],
      published: true,
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file",
        description: "Please upload an image file",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Image must be less than 5MB",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      const { publicUrl } = await uploadToR2(file, "live-streams", file.name);

      setFormData({ ...formData, thumbnail_url: publicUrl });
      toast({
        title: "Success",
        description: "Image uploaded successfully",
      });
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: "Failed to upload image",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const clearThumbnail = () => {
    setFormData({ ...formData, thumbnail_url: "" });
  };

  const handleDialogClose = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      resetForm();
    }
  };

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = streams.findIndex(s => s.id === active.id);
    const newIndex = streams.findIndex(s => s.id === over.id);
    const reordered = arrayMove(streams, oldIndex, newIndex);
    setStreams(reordered);

    // Persist new order
    const updates = reordered.map((s, i) => ({ id: s.id, display_order: i }));
    for (const u of updates) {
      await supabase.from("live_streams").update({ display_order: u.display_order }).eq("id", u.id);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      live: "bg-red-600 text-white",
      scheduled: "bg-blue-600 text-white",
      ended: "bg-gray-600 text-white",
    };
    return variants[status as keyof typeof variants] || "bg-gray-600 text-white";
  };

  return (
    <AdminPage>
      <TikTokLiveToggle />
      <AdminPageHeader
        icon={Radio}
        title="Live Stream Management"
        count={streams.length}
        countLabel="streams"
        actions={
        <div className="grid w-full min-w-0 grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:justify-end">
          {streams.length > 0 && (
            <Button size="sm" variant="outline" className="h-8 min-w-0 px-2 text-xs" onClick={selectAll}>
              <CheckSquare className="w-3.5 h-3.5 mr-1" />
              {selectedIds.size === streams.length ? "Deselect All" : "Select All"}
            </Button>
          )}
          {selectedIds.size > 0 && (
            <>
              <Button size="sm" variant="outline" className="h-8 min-w-0 px-2 text-xs" onClick={() => setBulkEditOpen(true)}>
                <Edit className="w-3.5 h-3.5 mr-1" />
                Bulk Edit ({selectedIds.size})
              </Button>
              <Button size="sm" variant="destructive" className="h-8 min-w-0 px-2 text-xs" onClick={handleBulkDelete}>
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                Delete ({selectedIds.size})
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-8 min-w-0 px-2 text-xs"
            onClick={async () => {
              toast({ title: "Scraping...", description: "Fetching replay games from mlblive.net. This may take a minute." });
              try {
                const { data, error } = await supabase.functions.invoke('scrape-replay-games', {
                  body: { maxPages: 3 }
                });
                if (error) throw error;
                toast({
                  title: "Scrape Complete",
                  description: `Found ${data.total_with_embeds} games, ${data.newly_inserted} newly added.`,
                });
              } catch (err: any) {
                toast({ title: "Scrape Failed", description: err.message || "Error scraping replays", variant: "destructive" });
              }
            }}
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            Scrape Replays
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-8 min-w-0 px-2 text-xs">
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Add Live Stream
              </Button>
            </DialogTrigger>
          <DialogContent className="min-w-0 max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-2xl overflow-x-hidden overflow-y-auto p-4 sm:max-h-[90dvh] sm:p-6">
            <DialogHeader className="min-w-0 pr-7 text-left">
              <DialogTitle>{editingStream ? "Edit Live Stream" : "Add New Live Stream"}</DialogTitle>
              <DialogDescription>
                {editingStream ? "Update stream details" : "Schedule a new live stream"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="min-w-0 max-w-full space-y-4 [&>div]:min-w-0 [&_input]:min-w-0 [&_input]:max-w-full [&_textarea]:min-w-0 [&_textarea]:max-w-full">
              <div className="min-w-0">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  className="w-full min-w-0 max-w-full"
                />
              </div>

              <div className="min-w-0">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full min-w-0 max-w-full"
                />
              </div>

              <div className="min-w-0">
                <Label htmlFor="stream_url">Stream URL (M3U8) *</Label>
                <Input
                  id="stream_url"
                  type="url"
                  value={formData.stream_url}
                  onChange={(e) => setFormData({ ...formData, stream_url: e.target.value })}
                  placeholder="https://example.com/stream/playlist.m3u8"
                  required
                  className="w-full min-w-0 max-w-full"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Enter the HLS stream URL ending in .m3u8
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2 h-8 text-xs"
                  onClick={() => setFormData({
                    ...formData,
                    stream_url: PIX11_STREAM_URL,
                    assigned_pages: formData.assigned_pages.includes("live")
                      ? formData.assigned_pages
                      : [...formData.assigned_pages, "live"],
                  })}
                >
                  Use Game Events Stream
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2 ml-2 h-8 text-xs"
                  onClick={() => setFormData({ ...formData, stream_url: SPORTS_EVENTS_STREAM_URL })}
                >
                  Use Sports Events Stream
                </Button>

              </div>


              <div className="min-w-0">
                <Label>Thumbnail</Label>
                <div className="space-y-3 mt-2">
                  {formData.thumbnail_url && (
                    <div className="relative w-full aspect-video rounded-md overflow-hidden bg-muted">
                      <img
                        src={formData.thumbnail_url}
                        alt="Thumbnail preview"
                        className="w-full h-full object-cover"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 h-7 w-7"
                        onClick={clearThumbnail}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                   <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleImageUpload}
                      accept="image/*"
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="flex-1"
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" />
                          Upload Image
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        fetchMediaLibrary();
                        setMediaPickerOpen(true);
                      }}
                      className="flex-1"
                    >
                      <Image className="w-4 h-4 mr-2" />
                      Media Library
                    </Button>
                  </div>
                  {/* Team Matchup Presets */}
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">Team Matchup Presets</Label>
                    <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5 max-h-[160px] overflow-y-auto rounded-md border border-border/50 p-1.5">
                      {TEAM_PRESET_IMAGES.map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => {
                            setFormData({ ...formData, thumbnail_url: preset.src });
                            toast({ title: "Image selected", description: preset.label });
                          }}
                          className={`aspect-video rounded overflow-hidden border-2 transition-colors ${
                            formData.thumbnail_url === preset.src ? 'border-primary ring-1 ring-primary' : 'border-transparent hover:border-primary/50'
                          }`}
                          title={preset.label}
                        >
                          <img src={preset.src} alt={preset.label} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">or URL:</span>
                    <Input
                      type="url"
                      value={formData.thumbnail_url}
                      onChange={(e) => setFormData({ ...formData, thumbnail_url: e.target.value })}
                      placeholder="https://..."
                      className="pl-14"
                    />
                  </div>

                  {/* Media Library Picker Dialog */}
                  <Dialog open={mediaPickerOpen} onOpenChange={setMediaPickerOpen}>
                    <DialogContent className="max-w-3xl max-h-[80vh]">
                      <DialogHeader>
                        <DialogTitle>Select from Media Library</DialogTitle>
                        <DialogDescription>Choose an image to use as the thumbnail</DialogDescription>
                      </DialogHeader>
                      {mediaLoading ? (
                        <div className="flex items-center justify-center py-12">
                          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                      ) : mediaItems.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">No images found in the media library.</p>
                      ) : (
                        <ScrollArea className="h-[50vh]">
                          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 p-1">
                            {mediaItems.map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => {
                                  setFormData({ ...formData, thumbnail_url: item.file_url });
                                  setMediaPickerOpen(false);
                                  toast({ title: "Image selected", description: item.file_name });
                                }}
                                className="aspect-video rounded-md overflow-hidden border-2 border-transparent hover:border-primary transition-colors bg-muted"
                              >
                                <img
                                  src={item.file_url}
                                  alt={item.file_name}
                                  className="w-full h-full object-cover"
                                />
                              </button>
                            ))}
                          </div>
                        </ScrollArea>
                      )}
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="status">Status *</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value: 'live' | 'scheduled' | 'ended') =>
                      setFormData({ ...formData, status: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="live">Live Now</SelectItem>
                      <SelectItem value="ended">Ended</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="watch_page">Watch Page *</Label>
                  <Select
                    value={getWatchPage(formData.assigned_pages)}
                    onValueChange={(page) => {
                      const destinations = ['metsxmfanzone', 'metsxmfanzone-2', 'pix11-network'];
                      const kept = formData.assigned_pages.filter(item => !destinations.includes(item));
                      const assignedPages = page === 'own' ? kept : [...kept, page];
                      setFormData({ ...formData, assigned_pages: assignedPages.includes('live') ? assignedPages : [...assignedPages, 'live'] });
                    }}
                  >
                    <SelectTrigger id="watch_page">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WATCH_PAGE_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Choose Stream 2 to show this game there. Paste the Game Events M3U8 URL above as its video source.
                  </p>
                  <Label className="mt-4 block">Also Show In</Label>
                  <div className="space-y-2 mt-2">
                    {(() => {
                      const defaultPages = ['guide', 'live', 'ny-jets', 'ny-giants', 'ny-knicks', 'ny-rangers', 'ny-islanders', 'brooklyn-nets', 'mlb-network', 'sny-tv', 'msg-network', 'espn-network', 'regular-season-games', 'replay-games'];
                      const customPages = formData.assigned_pages.filter(p => !defaultPages.includes(p));
                      const allPages = [...defaultPages, ...customPages];
                      return allPages.map((page) => (
                        <div key={page} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={page}
                            checked={formData.assigned_pages.includes(page)}
                            onChange={(e) => {
                              const newPages = e.target.checked
                                ? [...formData.assigned_pages, page]
                                : formData.assigned_pages.filter(p => p !== page);
                              setFormData({ ...formData, assigned_pages: newPages });
                            }}
                            className="rounded border-border"
                          />
                          <Label htmlFor={page} className="cursor-pointer font-normal">
                            {PAGE_LABELS[page] || page}
                          </Label>
                          {!defaultPages.includes(page) && (
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, assigned_pages: formData.assigned_pages.filter(p => p !== page) })}
                              className="text-xs text-destructive hover:underline ml-1"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ));
                    })()}
                  </div>
                  <div className="flex min-w-0 flex-col gap-2 mt-3 sm:flex-row sm:items-center">
                    <Input
                      id="custom-page-input"
                      placeholder="Add custom page (e.g. yes-network)"
                      className="flex-1 text-sm"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const val = (e.target as HTMLInputElement).value.trim().toLowerCase().replace(/\s+/g, '-');
                          if (val && !formData.assigned_pages.includes(val)) {
                            setFormData({ ...formData, assigned_pages: [...formData.assigned_pages, val] });
                            (e.target as HTMLInputElement).value = '';
                          }
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const input = document.getElementById('custom-page-input') as HTMLInputElement;
                        if (!input) return;
                        const val = input.value.trim().toLowerCase().replace(/\s+/g, '-');
                        if (val && !formData.assigned_pages.includes(val)) {
                          setFormData({ ...formData, assigned_pages: [...formData.assigned_pages, val] });
                          input.value = '';
                        }
                      }}
                    >
                      Add
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Type a custom page slug and press Enter or click Add</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="scheduled_start">Start Time</Label>
                  <Input
                    id="scheduled_start"
                    type="datetime-local"
                    value={formData.scheduled_start}
                    onChange={(e) => setFormData({ ...formData, scheduled_start: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="scheduled_end">End Time</Label>
                  <Input
                    id="scheduled_end"
                    type="datetime-local"
                    value={formData.scheduled_end}
                    onChange={(e) => setFormData({ ...formData, scheduled_end: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="published"
                  checked={formData.published}
                  onCheckedChange={(checked) => setFormData({ ...formData, published: checked })}
                />
                <Label htmlFor="published">Published</Label>
              </div>

              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => handleDialogClose(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingStream ? "Update" : "Create"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        </div>
        }
      />

      {loading ? (
        <AdminLoading label="Loading streams…" />
      ) : streams.length === 0 ? (
        <AdminEmpty message='No live streams yet. Click "Add Live Stream" to schedule your first stream.' />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={streams.map(s => s.id)} strategy={rectSortingStrategy}>
            <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {streams.map((stream) => (
                <SortableStreamCard
                  key={stream.id}
                  stream={stream}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  getStatusBadge={getStatusBadge}
                  selected={selectedIds.has(stream.id)}
                  onToggleSelect={toggleSelect}
                  isFreeGame={freeStreams.isFree(stream.id)}
                  onToggleFree={handleToggleFree}
                  onSelectWatchPage={handleSelectWatchPage}
                  onToggleLive={handleToggleLive}


                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Bulk Edit Dialog */}
      <Dialog open={bulkEditOpen} onOpenChange={setBulkEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Bulk Edit {selectedIds.size} Streams</DialogTitle>
            <DialogDescription>Only filled fields will be updated</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Status</Label>
              <Select value={bulkData.status} onValueChange={(v: "" | "live" | "scheduled" | "ended") => setBulkData({ ...bulkData, status: v })}>
                <SelectTrigger><SelectValue placeholder="No change" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="live">Live Now</SelectItem>
                  <SelectItem value="ended">Ended</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Published</Label>
              <Select value={bulkData.published} onValueChange={(v) => setBulkData({ ...bulkData, published: v as "" | "true" | "false" })}>
                <SelectTrigger><SelectValue placeholder="No change" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Published</SelectItem>
                  <SelectItem value="false">Draft</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Checkbox checked={bulkData.applyPages} onCheckedChange={(c) => setBulkData({ ...bulkData, applyPages: !!c })} />
                <Label>Update Assigned Pages</Label>
              </div>
              {bulkData.applyPages && (
                <div className="space-y-2 pl-6">
                  {Object.entries(PAGE_LABELS).map(([key, label]) => (
                    <div key={key} className="flex items-center gap-2">
                      <Checkbox
                        checked={bulkData.assigned_pages.includes(key)}
                        onCheckedChange={(c) => {
                          const pages = c
                            ? [...bulkData.assigned_pages, key]
                            : bulkData.assigned_pages.filter(p => p !== key);
                          setBulkData({ ...bulkData, assigned_pages: pages });
                        }}
                      />
                      <Label className="font-normal">{label}</Label>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* Bulk Thumbnail */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Checkbox checked={bulkData.applyThumbnail} onCheckedChange={(c) => setBulkData({ ...bulkData, applyThumbnail: !!c })} />
                <Label>Update Thumbnail</Label>
              </div>
              {bulkData.applyThumbnail && (
                <div className="space-y-2 pl-6">
                  {bulkData.thumbnail_url && (
                    <div className="relative w-full aspect-video rounded-md overflow-hidden bg-muted max-w-[200px]">
                      <img src={bulkData.thumbnail_url} alt="Bulk thumbnail" className="w-full h-full object-cover" />
                      <Button type="button" variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => setBulkData({ ...bulkData, thumbnail_url: "" })}>
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                  <Label className="text-xs text-muted-foreground block">Team Presets</Label>
                  <div className="grid grid-cols-5 gap-1 max-h-[120px] overflow-y-auto rounded border border-border/50 p-1">
                    {TEAM_PRESET_IMAGES.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setBulkData({ ...bulkData, thumbnail_url: preset.src })}
                        className={`aspect-video rounded overflow-hidden border-2 transition-colors ${bulkData.thumbnail_url === preset.src ? 'border-primary ring-1 ring-primary' : 'border-transparent hover:border-primary/50'}`}
                        title={preset.label}
                      >
                        <img src={preset.src} alt={preset.label} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => { fetchMediaLibrary(); setBulkMediaPickerOpen(true); }}>
                      <Image className="w-3.5 h-3.5 mr-1" /> Media Library
                    </Button>
                  </div>
                  <Input
                    type="url"
                    value={bulkData.thumbnail_url}
                    onChange={(e) => setBulkData({ ...bulkData, thumbnail_url: e.target.value })}
                    placeholder="Or paste URL..."
                    className="text-xs"
                  />
                </div>
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setBulkEditOpen(false)}>Cancel</Button>
              <Button onClick={handleBulkEdit}>Apply to {selectedIds.size} Streams</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Media Library Picker */}
      <Dialog open={bulkMediaPickerOpen} onOpenChange={setBulkMediaPickerOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Select Thumbnail for Bulk Edit</DialogTitle>
            <DialogDescription>Choose an image to apply to all selected streams</DialogDescription>
          </DialogHeader>
          {mediaLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : mediaItems.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No images found.</p>
          ) : (
            <ScrollArea className="h-[50vh]">
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 p-1">
                {mediaItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setBulkData({ ...bulkData, thumbnail_url: item.file_url });
                      setBulkMediaPickerOpen(false);
                      toast({ title: "Image selected", description: item.file_name });
                    }}
                    className="aspect-video rounded-md overflow-hidden border-2 border-transparent hover:border-primary transition-colors bg-muted"
                  >
                    <img src={item.file_url} alt={item.file_name} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </AdminPage>
  );
}