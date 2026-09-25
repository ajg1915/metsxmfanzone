import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Image as ImageIcon, Music } from "lucide-react";

interface MediaPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Which media type to show. Defaults to images. */
  kind?: "image" | "audio";
  onSelect: (url: string) => void;
}

/** Admin-only picker that chooses an existing file from the media library. */
export default function MediaPickerDialog({ open, onOpenChange, kind = "image", onSelect }: MediaPickerDialogProps) {
  const [search, setSearch] = useState("");

  const { data: media, isLoading } = useQuery({
    queryKey: ["media-library", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("media_library")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const prefix = kind === "audio" ? "audio/" : "image/";
  const items = (media || []).filter(
    (m: any) => m.file_url && (m.file_type || "").startsWith(prefix)
  );
  const filtered = items.filter((m: any) =>
    (m.file_name || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            {kind === "audio" ? <Music className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
            Choose from Media Library
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search files…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>

        <div className="flex-1 overflow-y-auto mt-2 pr-1">
          {isLoading ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-md" />
              ))}
            </div>
          ) : !filtered.length ? (
            <p className="text-xs text-muted-foreground text-center py-10">
              No {kind === "audio" ? "audio files" : "images"} in your media library yet. Upload one first.
            </p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {filtered.map((item: any) => (
                <button
                  key={item.id}
                  type="button"
                  className="group relative rounded-md overflow-hidden border border-border/50 hover:border-primary transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                  onClick={() => {
                    onSelect(item.file_url);
                    onOpenChange(false);
                  }}
                  title={item.file_name}
                >
                  <div className="aspect-square bg-muted flex items-center justify-center">
                    {kind === "image" ? (
                      <img
                        src={item.file_url}
                        alt={item.file_name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <Music className="w-8 h-8 text-muted-foreground/60" />
                    )}
                  </div>
                  <span className="absolute bottom-0 inset-x-0 bg-background/85 text-[9px] px-1 py-0.5 truncate text-left">
                    {item.file_name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
