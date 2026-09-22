import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { uploadToR2, deleteFromR2, isR2Url } from "@/lib/r2Upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Upload, Download, Copy, Trash2, Search, Image as ImageIcon,
  FileText, Film, Music, File, Grid3X3, List, FolderOpen, Pencil, Check, X
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { AdminPage, AdminPageHeader, AdminLoading, AdminEmpty } from "@/components/admin/AdminUI";

const FOLDERS = ["general", "hero", "blog", "stories", "events", "podcasts", "social", "misc"];

const getFileIcon = (type: string | null) => {
  if (!type) return File;
  if (type.startsWith("image/")) return ImageIcon;
  if (type.startsWith("video/")) return Film;
  if (type.startsWith("audio/")) return Music;
  return FileText;
};

const formatFileSize = (bytes: number | null) => {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function MediaLibrary() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [folder, setFolder] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { data: media, isLoading } = useQuery({
    queryKey: ["media-library", folder],
    queryFn: async () => {
      let query = supabase
        .from("media_library")
        .select("*")
        .order("created_at", { ascending: false });
      if (folder !== "all") query = query.eq("folder", folder);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const renameMutation = useMutation({
    mutationFn: async ({ id, newName }: { id: string; newName: string }) => {
      const { error } = await supabase.from("media_library").update({ file_name: newName }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["media-library"] });
      toast.success("File renamed");
      setEditingId(null);
    },
    onError: () => toast.error("Failed to rename file"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (item: { id: string; file_name: string; folder: string; file_url?: string }) => {
      const storagePath = `${item.folder}/${item.file_name}`;
      try {
        if (isR2Url(item.file_url)) {
          await deleteFromR2(storagePath);
        } else {
          await supabase.storage.from("media_library").remove([storagePath]);
        }
      } catch (err) {
        console.error("Remove file error:", err);
      }
      const { error } = await supabase.from("media_library").delete().eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["media-library"] });
      toast.success("File deleted");
    },
    onError: () => toast.error("Failed to delete file"),
  });

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !user) return;
    setUploading(true);

    const uploadFolder = folder === "all" ? "general" : folder;

    try {
      for (const file of Array.from(files)) {
        const { key, publicUrl } = await uploadToR2(file, uploadFolder, file.name);

        const { error: dbError } = await supabase.from("media_library").insert({
          uploaded_by: user.id,
          file_name: key.split("/").pop() as string,
          file_url: publicUrl,
          file_size: file.size,
          file_type: file.type,
          folder: uploadFolder,
        });
        if (dbError) throw dbError;
      }
      queryClient.invalidateQueries({ queryKey: ["media-library"] });
      toast.success(`${files.length} file(s) uploaded`);
    } catch (err: any) {
      const msg = String(err?.message || "");
      if (/row-level security|violates|not authorized|403/i.test(msg)) {
        toast.error("Upload blocked: your account needs admin permission on the media library.");
      } else {
        toast.error(msg || "Upload failed");
      }
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }, [user, folder, queryClient]);

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("URL copied to clipboard");
  };

  const downloadFile = (url: string, name: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.target = "_blank";
    a.click();
  };

  const filtered = media?.filter((m) =>
    m.file_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminPage>
      <AdminPageHeader
        icon={FolderOpen}
        title="Media Library"
        count={filtered?.length ?? 0}
        countLabel="files"
        description="Upload, browse, and manage your media files"
        actions={
        <>
          <Button
            type="button"
            disabled={uploading}
            className="gap-2"
            onClick={() => {
              if (fileInputRef.current) {
                fileInputRef.current.value = "";
                fileInputRef.current.click();
              }
            }}
          >
            <Upload className="h-4 w-4" />
            {uploading ? "Uploading..." : "Upload Files"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*,audio/*,.pdf,.svg"
            className="hidden"
            onChange={handleUpload}
          />
        </>
        }
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search files..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={folder} onValueChange={setFolder}>
          <SelectTrigger className="w-[160px]">
            <FolderOpen className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Folders</SelectItem>
            {FOLDERS.map((f) => (
              <SelectItem key={f} value={f} className="capitalize">{f}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-1">
          <Button
            size="icon"
            variant={viewMode === "grid" ? "default" : "outline"}
            onClick={() => setViewMode("grid")}
          >
            <Grid3X3 className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant={viewMode === "list" ? "default" : "outline"}
            onClick={() => setViewMode("list")}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-xs text-muted-foreground">
        <span>{filtered?.length ?? 0} files</span>
        <span>
          {formatFileSize(
            filtered?.reduce((sum, m) => sum + (m.file_size ?? 0), 0) ?? 0
          )} total
        </span>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-lg" />
          ))}
        </div>
      ) : !filtered?.length ? (
        <AdminEmpty message="No media files found. Upload files to get started." />
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filtered.map((item) => {
            const Icon = getFileIcon(item.file_type);
            const isImage = item.file_type?.startsWith("image/");
            return (
              <Card key={item.id} className="group overflow-hidden relative">
                <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
                  {isImage ? (
                    <img
                      src={item.file_url}
                      alt={item.file_name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <Icon className="h-10 w-10 text-muted-foreground/50" />
                  )}
                </div>
                {/* Overlay actions */}
                <div className="absolute inset-0 aspect-square bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button size="icon" variant="secondary" onClick={() => { setEditingId(item.id); setEditName(item.file_name); }} title="Rename">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="secondary" onClick={() => copyUrl(item.file_url)} title="Copy URL">
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="secondary" onClick={() => downloadFile(item.file_url, item.file_name)} title="Download">
                    <Download className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="destructive" title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete file?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete "{item.file_name}".
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteMutation.mutate({ id: item.id, file_name: item.file_name, folder: item.folder ?? "general", file_url: item.file_url })}
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
                <div className="p-2">
                  {editingId === item.id ? (
                    <div className="flex items-center gap-1">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="h-6 text-xs px-1"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") renameMutation.mutate({ id: item.id, newName: editName });
                          if (e.key === "Escape") setEditingId(null);
                        }}
                      />
                      <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => renameMutation.mutate({ id: item.id, newName: editName })}>
                        <Check className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => setEditingId(null)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <p className="text-xs truncate font-medium flex-1">{item.file_name}</p>
                      <Button size="icon" variant="ghost" className="h-5 w-5 flex-shrink-0" onClick={() => { setEditingId(item.id); setEditName(item.file_name); }}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-1">
                    <Badge variant="outline" className="text-[10px] capitalize">{item.folder}</Badge>
                    <span className="text-[10px] text-muted-foreground">{formatFileSize(item.file_size)}</span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => {
            const Icon = getFileIcon(item.file_type);
            const isImage = item.file_type?.startsWith("image/");
            return (
              <Card key={item.id} className="flex items-center gap-4 p-3">
                <div className="h-12 w-12 rounded bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                  {isImage ? (
                    <img src={item.file_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <Icon className="h-5 w-5 text-muted-foreground/50" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  {editingId === item.id ? (
                    <div className="flex items-center gap-1">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="h-7 text-sm px-2"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") renameMutation.mutate({ id: item.id, newName: editName });
                          if (e.key === "Escape") setEditingId(null);
                        }}
                      />
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => renameMutation.mutate({ id: item.id, newName: editName })}>
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingId(null)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <p className="text-sm font-medium truncate">{item.file_name}</p>
                      <Button size="icon" variant="ghost" className="h-6 w-6 flex-shrink-0" onClick={() => { setEditingId(item.id); setEditName(item.file_name); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className="text-[10px] capitalize">{item.folder}</Badge>
                    <span className="text-xs text-muted-foreground">{formatFileSize(item.file_size)}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(item.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => copyUrl(item.file_url)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => downloadFile(item.file_url, item.file_name)}>
                    <Download className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="ghost" className="text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete file?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete "{item.file_name}".
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteMutation.mutate({ id: item.id, file_name: item.file_name, folder: item.folder ?? "general", file_url: item.file_url })}
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </AdminPage>
  );
}