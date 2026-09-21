import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Video, Mic, Square, Circle, Download, Camera, CameraOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { uploadToR2 } from "@/lib/r2Upload";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

export default function LiveStudioTab() {
  const { toast } = useToast();
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [hasRecording, setHasRecording] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [recordingMode, setRecordingMode] = useState<"video" | "audio">("video");

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordedBlobRef = useRef<Blob | null>(null);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const startCamera = useCallback(async () => {
    try {
      const constraints = recordingMode === "video"
        ? { video: { width: 1280, height: 720, facingMode: "user" }, audio: true }
        : { audio: true };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current && recordingMode === "video") {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
    } catch {
      toast({ title: "Permission denied", description: "Allow camera/mic access to use Live Studio.", variant: "destructive" });
    }
  }, [recordingMode, toast]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    streamRef.current = null;
    setCameraActive(false);
  }, []);

  const startRecording = useCallback(() => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const mimeType = recordingMode === "video" ? "video/webm;codecs=vp9,opus" : "audio/webm;codecs=opus";
    const recorder = new MediaRecorder(streamRef.current, { mimeType: MediaRecorder.isTypeSupported(mimeType) ? mimeType : undefined });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = () => {
      const type = recordingMode === "video" ? "video/webm" : "audio/webm";
      recordedBlobRef.current = new Blob(chunksRef.current, { type });
      setHasRecording(true);
    };

    recorder.start(1000);
    setIsRecording(true);
    setRecordingTime(0);
    timerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
  }, [recordingMode]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const downloadRecording = () => {
    if (!recordedBlobRef.current) return;
    const ext = recordingMode === "video" ? "webm" : "webm";
    const url = URL.createObjectURL(recordedBlobRef.current);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clubhouse-${Date.now()}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const saveEpisode = async () => {
    if (!recordedBlobRef.current || !title.trim()) {
      toast({ title: "Missing info", description: "Provide a title and record content first.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const ext = recordingMode === "video" ? "webm" : "webm";
      const fileName = `studio-${Date.now()}.${ext}`;
      const bucket = recordingMode === "video" ? "videos" : "podcasts";
      const { error: uploadError } = await supabase.storage.from(bucket).upload(fileName, recordedBlobRef.current, { contentType: recordedBlobRef.current.type });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(fileName);

      if (recordingMode === "video") {
        const { error } = await supabase.from("videos").insert({
          title: title.trim(),
          description: description.trim() || null,
          video_url: urlData.publicUrl,
          video_type: "recorded",
          duration: recordingTime,
          published: false,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("podcasts").insert({
          title: title.trim(),
          description: description.trim() || null,
          audio_url: urlData.publicUrl,
          duration: recordingTime,
          published: false,
        });
        if (error) throw error;
      }

      toast({ title: "Episode saved as draft!" });
      setTitle("");
      setDescription("");
      setHasRecording(false);
      recordedBlobRef.current = null;
      setRecordingTime(0);
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    return () => {
      stopCamera();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [stopCamera]);

  return (
    <div className="space-y-4">
      {/* Mode selector */}
      <div className="flex gap-2">
        <Button
          variant={recordingMode === "video" ? "default" : "outline"}
          size="sm"
          onClick={() => { if (!isRecording) { stopCamera(); setRecordingMode("video"); } }}
          className={recordingMode === "video" ? "bg-gradient-to-r from-orange-500 to-red-500 text-white" : ""}
        >
          <Video className="w-4 h-4 mr-1.5" /> Video
        </Button>
        <Button
          variant={recordingMode === "audio" ? "default" : "outline"}
          size="sm"
          onClick={() => { if (!isRecording) { stopCamera(); setRecordingMode("audio"); } }}
          className={recordingMode === "audio" ? "bg-gradient-to-r from-orange-500 to-red-500 text-white" : ""}
        >
          <Mic className="w-4 h-4 mr-1.5" /> Audio Only
        </Button>
      </div>

      {/* Camera Preview */}
      <Card className="border-2 border-border/60 bg-black/95 overflow-hidden">
        <div className="relative aspect-video flex items-center justify-center">
          {recordingMode === "video" ? (
            <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <Mic className={`w-16 h-16 ${isRecording ? "text-red-500 animate-pulse" : "text-orange-400"}`} />
              <span className="text-sm font-medium">Audio Recording Mode</span>
            </div>
          )}

          {/* Recording indicator */}
          {isRecording && (
            <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/70 backdrop-blur-sm rounded-full px-3 py-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-white text-sm font-mono font-bold">{formatTime(recordingTime)}</span>
              <Badge variant="destructive" className="text-[10px] px-1.5">REC</Badge>
            </div>
          )}

          {/* Camera off overlay */}
          {!cameraActive && recordingMode === "video" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-muted-foreground gap-2">
              <CameraOff className="w-12 h-12" />
              <span className="text-sm">Camera is off</span>
            </div>
          )}
        </div>
      </Card>

      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        {!cameraActive ? (
          <Button onClick={startCamera} className="bg-gradient-to-r from-orange-500 to-red-500 text-white gap-2">
            <Camera className="w-4 h-4" />
            {recordingMode === "video" ? "Start Camera" : "Connect Mic"}
          </Button>
        ) : (
          <>
            {!isRecording ? (
              <Button onClick={startRecording} variant="destructive" className="gap-2">
                <Circle className="w-4 h-4" /> Record
              </Button>
            ) : (
              <Button onClick={stopRecording} variant="outline" className="gap-2 border-red-500 text-red-500 hover:bg-red-500/10">
                <Square className="w-4 h-4" /> Stop
              </Button>
            )}
            <Button onClick={stopCamera} variant="ghost" size="sm">
              <CameraOff className="w-4 h-4 mr-1" /> Turn Off
            </Button>
          </>
        )}

        {hasRecording && (
          <Button onClick={downloadRecording} variant="outline" size="sm" className="gap-1.5">
            <Download className="w-3.5 h-3.5" /> Download Raw
          </Button>
        )}
      </div>

      {/* Save as Episode */}
      {hasRecording && (
        <Card className="border border-orange-500/30 bg-orange-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Save as Episode</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Title *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Episode title..." />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What's this about?" rows={2} />
            </div>
            <Button onClick={saveEpisode} disabled={saving || !title.trim()} className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white">
              {saving ? "Saving..." : "Save Episode as Draft"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
