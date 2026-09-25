import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FolderOpen, Loader2, Search, X } from "lucide-react";

interface MediaItem {
  id: string;
  file_url: string;
  file_name: string;
  file_type: string | null;
}

interface MediaLibraryPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (url: string, fileName: string) => void;
  title?: string;
}

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif|svg)(\?|$)/i;

/** Searchable grid of images from the media_library table. Click one to select it. */
export default function MediaLibraryPicker({
  open,
  onOpenChange,
  onSelect,
  title = "Select Image from Media Library",
}: MediaLibraryPickerProps) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Refetch every time the picker opens so newly uploaded files show up.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setSearch("");
    setLoading(true);
    setError(null);
    supabase
      .from("media_library")
      .select("id, file_url, file_name, file_type")
      .order("created_at", { ascending: false })
      .limit(500)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setError(error.message);
        const images = ((data as MediaItem[]) || []).filter(
          (m) => m.file_type?.startsWith("image/") || IMAGE_EXT.test(m.file_url || m.file_name),
        );
        setItems(images);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [open]);

  const filtered = search
    ? items.filter((m) => m.file_name.toLowerCase().includes(search.toLowerCase()))
    : items;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <FolderOpen className="w-4 h-4" /> {title}
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search images…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
          {search && (
            <Button variant="ghost" size="sm" className="absolute right-1 top-1 h-6 w-6 p-0" onClick={() => setSearch("")}>
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>

        <ScrollArea className="h-[55vh]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <p className="text-center text-red-400 text-sm py-12">Couldn't load media: {error}</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-12">
              {search ? "No matching images found" : "No images in your media library yet"}
            </p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 p-1">
              {filtered.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => { onSelect(m.file_url, m.file_name); onOpenChange(false); }}
                  className="group relative aspect-square rounded-md overflow-hidden border border-border hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
                  title={m.file_name}
                >
                  <img src={m.file_url} alt={m.file_name} loading="lazy" className="w-full h-full object-cover" />
                  <span className="absolute inset-x-0 bottom-0 bg-black/60 text-[9px] text-white px-1 py-0.5 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                    {m.file_name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
