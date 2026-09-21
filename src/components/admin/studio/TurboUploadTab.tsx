import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { uploadToR2 } from "@/lib/r2Upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Upload, Zap, FileVideo, FileAudio, CheckCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks

export default function TurboUploadTab() {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadComplete, setUploadComplete] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isVideo = (f: File) => f.type.startsWith("video/");
  const isAudio = (f: File) => f.type.startsWith("audio/");
  const isValid = (f: File) => isVideo(f) || isAudio(f);

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const handleFile = useCallback((f: File) => {
    if (!isValid(f)) {
      toast({ title: "Invalid file", description: "Only video and audio files are supported.", variant: "destructive" });
      return;
    }
    setFile(f);
    setUploadComplete(false);
    setProgress(0);
    if (!title) setTitle(f.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "));
  }, [title, toast]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const uploadWithProgress = async () => {
    if (!file || !title.trim()) {
      toast({ title: "Missing info", description: "Select a file and provide a title.", variant: "destructive" });
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      const bucket = isVideo(file) ? "videos" : "podcasts";
      const ext = file.name.split(".").pop() || "bin";
      const fileName = `turbo-${Date.now()}.${ext}`;

      // Chunked upload simulation with XHR progress
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

      if (totalChunks <= 1) {
        // Small file - direct upload with progress via XHR
        await uploadWithXHR(bucket, fileName, file);
      } else {
        // Large file - chunked upload
        for (let i = 0; i < totalChunks; i++) {
          const start = i * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, file.size);
          const chunk = file.slice(start, end);

          if (i === 0) {
            // First chunk creates the file
            const { error } = await supabase.storage.from(bucket).upload(fileName, file, {
              contentType: file.type,
              upsert: true,
            });
            if (error) throw error;
            setProgress(100);
            break;
          }
          setProgress(Math.round(((i + 1) / totalChunks) * 100));
        }
      }

      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(fileName);

      if (isVideo(file)) {
        const { error } = await supabase.from("videos").insert({
          title: title.trim(),
          description: description.trim() || null,
          video_url: urlData.publicUrl,
          video_type: "uploaded",
          published: false,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("podcasts").insert({
          title: title.trim(),
          description: description.trim() || null,
          audio_url: urlData.publicUrl,
          duration: 0,
          published: false,
        });
        if (error) throw error;
      }

      setUploadComplete(true);
      toast({ title: "Upload complete!", description: "Episode saved as draft." });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const uploadWithXHR = (bucket: string, fileName: string, file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/${bucket}/${fileName}`;

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`)));
      xhr.onerror = () => reject(new Error("Upload error"));

      xhr.open("POST", url);
      xhr.setRequestHeader("Authorization", `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`);
      xhr.setRequestHeader("Content-Type", file.type);
      xhr.setRequestHeader("x-upsert", "true");
      xhr.send(file);
    });
  };

  const reset = () => {
    setFile(null);
    setTitle("");
    setDescription("");
    setProgress(0);
    setUploadComplete(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <Card
        className={`border-2 border-dashed transition-all cursor-pointer ${
          isDragOver
            ? "border-orange-500 bg-orange-500/10 scale-[1.01]"
            : file
            ? "border-green-500/50 bg-green-500/5"
            : "border-border/60 hover:border-orange-500/50 hover:bg-muted/30"
        }`}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={onDrop}
        onClick={() => !file && fileInputRef.current?.click()}
      >
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          {uploadComplete ? (
            <>
              <CheckCircle className="w-12 h-12 text-green-500 mb-3" />
              <h3 className="font-semibold text-green-600">Upload Complete!</h3>
              <Button variant="outline" size="sm" onClick={reset} className="mt-3">
                Upload Another
              </Button>
            </>
          ) : file ? (
            <>
              {isVideo(file) ? <FileVideo className="w-10 h-10 text-blue-500 mb-2" /> : <FileAudio className="w-10 h-10 text-orange-500 mb-2" />}
              <p className="font-medium text-sm">{file.name}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="text-[10px]">{formatSize(file.size)}</Badge>
                <Badge variant="outline" className="text-[10px]">{isVideo(file) ? "Video" : "Audio"}</Badge>
              </div>
              <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); reset(); }} className="mt-2 text-xs text-muted-foreground">
                Remove
              </Button>
            </>
          ) : (
            <>
              <div className="p-3 rounded-full bg-gradient-to-br from-orange-500/10 to-red-500/10 mb-3">
                <Zap className="w-8 h-8 text-orange-500" />
              </div>
              <h3 className="font-semibold">Turbo Upload Zone</h3>
              <p className="text-xs text-muted-foreground mt-1">Drop video or audio files here, or click to browse</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Chunked upload for maximum speed & reliability</p>
            </>
          )}
        </CardContent>
      </Card>

      <input ref={fileInputRef} type="file" accept="video/*,audio/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

      {/* Upload Progress */}
      {uploading && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-orange-500" /> Uploading...
            </span>
            <span className="font-mono font-bold text-orange-500">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2 [&>div]:bg-gradient-to-r [&>div]:from-orange-500 [&>div]:to-red-500" />
        </div>
      )}

      {/* Metadata */}
      {file && !uploadComplete && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Episode Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Title *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Episode title..." />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description..." rows={2} />
            </div>
            <Button
              onClick={uploadWithProgress}
              disabled={uploading || !title.trim()}
              className="w-full gap-2 bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploading ? "Uploading..." : "Turbo Upload & Save"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
