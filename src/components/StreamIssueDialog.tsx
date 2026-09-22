import { useMemo, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type IssueCategory = "buffering" | "audio" | "video" | "casting" | "access" | "other";

interface StreamIssueDialogProps {
  streamId?: string;
  streamTitle: string;
  video?: HTMLVideoElement | null;
  compact?: boolean;
}

function getSessionId() {
  const key = "stream-support-session";
  const existing = sessionStorage.getItem(key);
  if (existing) return existing;
  const value = crypto.randomUUID();
  sessionStorage.setItem(key, value);
  return value;
}

export function StreamIssueDialog({ streamId, streamTitle, video, compact }: StreamIssueDialogProps) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<IssueCategory>("buffering");
  const [description, setDescription] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);

  const canSend = useMemo(() => description.trim().length >= 5 && description.trim().length <= 1500, [description]);

  const submit = async () => {
    if (!canSend || sending) return;
    setSending(true);
    try {
      const connection = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection;
      const buffered = video?.buffered.length
        ? Math.max(0, video.buffered.end(video.buffered.length - 1) - video.currentTime)
        : 0;
      const { data, error } = await supabase.functions.invoke("stream-health-report", {
        body: {
          stream_id: streamId || null,
          issue_type: category,
          severity: "medium",
          description: description.trim(),
          session_id: getSessionId(),
          manual: true,
          contact_email: email.trim() || null,
          page_path: window.location.pathname,
          stream_title: streamTitle,
          diagnostics: {
            online: navigator.onLine,
            connection: connection?.effectiveType || "unknown",
            ready_state: video?.readyState ?? null,
            paused: video?.paused ?? null,
            muted: video?.muted ?? null,
            buffer_seconds: Number(buffered.toFixed(1)),
            viewport: `${window.innerWidth}x${window.innerHeight}`,
          },
        },
      });
      if (error || !data?.success) throw error || new Error("Ticket could not be submitted");
      toast.success("Issue sent to the stream team");
      setDescription("");
      setEmail("");
      setOpen(false);
    } catch {
      toast.error("Issue could not be sent. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size={compact ? "icon" : "sm"}
          className={compact ? "h-9 w-9 rounded-full bg-background/70 text-foreground backdrop-blur-md" : "h-9 gap-1.5"}
          aria-label="Report a stream issue"
          title="Report a stream issue"
        >
          <AlertTriangle className="h-4 w-4" />
          {!compact && <span>Report issue</span>}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Report a stream issue</DialogTitle>
          <DialogDescription>Tell us what is happening on {streamTitle}. Diagnostics are attached automatically.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Select value={category} onValueChange={(value) => setCategory(value as IssueCategory)}>
            <SelectTrigger aria-label="Issue type"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="buffering">Buffering or lag</SelectItem>
              <SelectItem value="audio">Audio problem</SelectItem>
              <SelectItem value="video">Picture problem</SelectItem>
              <SelectItem value="casting">Casting problem</SelectItem>
              <SelectItem value="access">Login or access problem</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
          <Textarea
            value={description}
            onChange={(event) => setDescription(event.target.value.slice(0, 1500))}
            placeholder="What happened?"
            rows={5}
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>At least 5 characters</span><span>{description.length}/1500</span>
          </div>
          <Input
            type="email"
            inputMode="email"
            value={email}
            onChange={(event) => setEmail(event.target.value.slice(0, 254))}
            placeholder="Reply email (optional)"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!canSend || sending}>
            {sending && <Loader2 className="h-4 w-4 animate-spin" />}
            Send report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}