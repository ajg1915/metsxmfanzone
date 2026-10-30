import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Mic, Square, Upload, Trash2, Play, Pause } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { uploadToR2 } from "@/lib/r2Upload";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { holdAdminSession } from "@/lib/adminActivity";
import { fetchAllShows, fmtShowWhen, type LenoreEpisode } from "@/lib/lenore";

// lenoreMode is for the admin Podcasts page: pick a show, title and description fill in
// and lock, and the episode goes live at the show's scheduled time.
// Pass `show` (a show, or null for none picked yet) to control the picked show from outside,
// as the Podcast Studio page does. Without it, the recorder shows its own show dropdown.
const PodcastAudioRecorder = ({
  lenoreMode = false,
  show,
  onAttached,
}: {
  lenoreMode?: boolean;
  show?: LenoreEpisode | null;
  onAttached?: () => void;
}) => {
  const controlled = show !== undefined;
  const { user } = useAuth();
  const { toast } = useToast();
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [recordingTime, setRecordingTime] = useState(0);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [shows, setShows] = useState<LenoreEpisode[]>([]);
  const [showId, setShowId] = useState("");
  const [haveAudio, setHaveAudio] = useState<number[]>([]);
  const picked = lenoreMode ? (controlled ? show ?? undefined : shows.find((x) => x.id === showId)) : undefined;
  const needsShow = lenoreMode && controlled && !picked;

  const loadShows = useCallback(() => {
    if (!lenoreMode || controlled) return;
    fetchAllShows().then(setShows).catch(() => setShows([]));
    supabase.from("podcasts").select("published_at").not("published_at", "is", null).then(({ data }) =>
      setHaveAudio((data || []).map((r: any) => new Date(r.published_at).getTime())),
    );
  }, [lenoreMode, controlled]);
  useEffect(() => { loadShows(); }, [loadShows]);

  // A show picked from outside fills in its title and description.
  useEffect(() => {
    if (!controlled) return;
    setTitle(show?.title ?? "");
    setDescription(show?.description ?? "");
  }, [controlled, show?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const chooseShow = (id: string) => {
    setShowId(id);
    const s = shows.find((x) => x.id === id);
    setTitle(s ? s.title : "");
    setDescription(s ? s.description : "");
  };

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // While recording, uploading, or holding an unsaved recording, keep the admin signed in
  // and warn before the page is closed, so a recording is never lost to the inactivity timer.
  useEffect(() => {
    if (!(isRecording || audioBlob || isUploading)) return;
    const release = holdAdminSession();
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      release();
      window.removeEventListener("beforeunload", warn);
    };
  }, [isRecording, audioBlob, isUploading]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start(1000);
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    } catch {
      toast({ title: "Microphone access denied", description: "Please allow microphone access to record.", variant: "destructive" });
    }
  }, [toast]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("audio/")) {
      toast({ title: "Invalid file", description: "Please select an audio file.", variant: "destructive" });
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max file size is 50MB.", variant: "destructive" });
      return;
    }
    setUploadedFile(file);
    setAudioBlob(file);
    setAudioUrl(URL.createObjectURL(file));
  };

  const togglePlayback = () => {
    if (!audioRef.current || !audioUrl) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const clearRecording = () => {
    setAudioBlob(null);
    setAudioUrl(null);
    setIsPlaying(false);
    setUploadedFile(null);
    setRecordingTime(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handleSubmit = async () => {
    if (!audioBlob || !title.trim()) {
      toast({ title: "Missing info", description: "Please provide a title and audio.", variant: "destructive" });
      return;
    }
    if (!user) {
      toast({ title: "Not logged in", description: "You must be logged in to upload.", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    try {
      const ext = uploadedFile ? uploadedFile.name.split(".").pop() : "webm";
      const fileName = `community-${Date.now()}.${ext}`;

      const { publicUrl } = await uploadToR2(audioBlob, "podcasts/community", fileName);

      const { error: insertError } = await supabase.from("podcasts").insert({
        title: title.trim(),
        description: description.trim() || null,
        audio_url: publicUrl,
        duration: recordingTime || null,
        ...(picked
          ? { published: true, published_at: picked.available }
          : { published: false }),
      });

      if (insertError) throw insertError;

      toast(
        picked
          ? { title: "Audio attached", description: `Goes live ${fmtShowWhen(picked.available)}.` }
          : { title: "Submitted!", description: "Your recording has been submitted for review." },
      );
      setTitle("");
      setDescription("");
      setShowId("");
      loadShows();
      onAttached?.();
      clearRecording();
    } catch (err: any) {
      console.error("Upload error:", err);
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card className="border-2 border-primary">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <Mic className="w-5 h-5 text-primary" />
          Record or Upload Your Episode
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {needsShow && (
          <p className="text-sm text-muted-foreground">Pick one of the shows above to start.</p>
        )}
        {!user && (
          <p className="text-sm text-destructive font-medium">You must be logged in to submit a recording.</p>
        )}

        {lenoreMode && !controlled && (
          <div className="space-y-2">
            <Label htmlFor="recorder-show">Which show is this?</Label>
            <select
              id="recorder-show"
              value={showId}
              onChange={(e) => chooseShow(e.target.value)}
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Pick a show</option>
              {shows.map((x) => {
                const done = haveAudio.includes(new Date(x.available).getTime());
                return (
                  <option key={x.id} value={x.id} disabled={done}>
                    {done ? "Audio attached · " : "Needs audio · "}
                    {fmtShowWhen(x.available)} · {x.title}
                  </option>
                );
              })}
            </select>
            <p className="text-xs text-muted-foreground">
              Record ahead of time. The title and description come from the show, and the show goes live at its scheduled time.
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="episode-title">Episode Title *</Label>
          <Input id="episode-title" placeholder="Give your episode a title..." value={title} onChange={(e) => setTitle(e.target.value)} readOnly={!!picked} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="episode-desc">Description</Label>
          <Textarea id="episode-desc" placeholder="What's this episode about?" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} readOnly={!!picked} />
        </div>

        {/* Recording controls */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            {!isRecording ? (
              <Button onClick={startRecording} variant="default" className="gap-2" disabled={!!audioBlob || !user || needsShow}>
                <Mic className="w-4 h-4" />
                Record Audio
              </Button>
            ) : (
              <Button onClick={stopRecording} variant="destructive" className="gap-2">
                <Square className="w-4 h-4" />
                Stop ({formatTime(recordingTime)})
              </Button>
            )}

            <span className="text-muted-foreground text-sm">or</span>

            <Button variant="outline" className="gap-2" onClick={() => fileInputRef.current?.click()} disabled={isRecording || !!audioBlob || !user || needsShow}>
              <Upload className="w-4 h-4" />
              Upload File
            </Button>
            <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={handleFileUpload} />
          </div>

          {isRecording && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-destructive animate-pulse" />
              <span className="text-sm text-destructive font-medium">Recording... {formatTime(recordingTime)}</span>
            </div>
          )}
        </div>

        {/* Playback */}
        {audioUrl && (
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={togglePlayback}>
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </Button>
                <span className="text-sm text-muted-foreground">
                  {uploadedFile ? uploadedFile.name : `Recording (${formatTime(recordingTime)})`}
                </span>
              </div>
              <Button size="sm" variant="ghost" onClick={clearRecording}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
            <audio ref={audioRef} src={audioUrl} onEnded={() => setIsPlaying(false)} className="w-full" controls />
          </div>
        )}

        <Button onClick={handleSubmit} disabled={!audioBlob || !title.trim() || isUploading || !user || needsShow} className="w-full gap-2" size="lg">
          <Upload className="w-4 h-4" />
          {isUploading ? "Submitting..." : picked ? "Attach to Show" : "Submit for Review"}
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          {picked ? "Goes live on the show's schedule." : "Submissions are reviewed before publishing."} Max 50MB for uploads.
        </p>
      </CardContent>
    </Card>
  );
};

export default PodcastAudioRecorder;
