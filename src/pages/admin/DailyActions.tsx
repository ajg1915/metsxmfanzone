import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import ContentIdeasCard from "@/components/admin/ContentIdeasCard";
import RefreshEveryoneCard from "@/components/admin/RefreshEveryoneCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Bell, ClipboardList, Loader2, RefreshCw, Sparkles, Video } from "lucide-react";

function ManualFetchButton({
  label,
  icon,
  functionName,
  successMessage,
  onCreditsExhausted,
}: {
  label: string;
  icon: React.ReactNode;
  functionName: string;
  successMessage: string;
  onCreditsExhausted?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const handleFetch = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(functionName);
      if (error) {
        try {
          const errorBody = JSON.parse(error.message || "{}");
          if (errorBody.creditsExhausted || error.message?.includes("402") || error.message?.includes("credits")) {
            toast.error("AI Credits Exhausted", {
              description: "Use manual entry in Predictions Management instead.",
              action: onCreditsExhausted ? { label: "Go to Manual Entry", onClick: onCreditsExhausted } : undefined,
            });
            return;
          }
        } catch {
          /* not JSON, fall through */
        }
        throw error;
      }
      toast.success(successMessage, { description: data?.message || JSON.stringify(data) });
    } catch (err: any) {
      const msg = err?.message || "Unknown error";
      if (msg.includes("credits") || msg.includes("402")) {
        toast.error("AI Credits Exhausted", {
          description: "Use manual entry in Predictions Management instead.",
          action: onCreditsExhausted ? { label: "Go to Manual Entry", onClick: onCreditsExhausted } : undefined,
        });
      } else {
        toast.error("Fetch failed", { description: msg });
      }
    } finally {
      setLoading(false);
    }
  };
  return (
    <button
      onClick={handleFetch}
      disabled={loading}
      className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-xs font-semibold text-slate-200 transition-all hover:border-[#FF5910]/50 hover:bg-white/[0.08] disabled:opacity-60"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin text-[#FF7A3D]" /> : icon}
      {label}
    </button>
  );
}

function TestPushButton() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [link, setLink] = useState("/");

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error("Add a title and a message first");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-beams-notification", {
        body: {
          title: title.trim(),
          body: message.trim(),
          path: link.trim() || "/",
          interests: ["hello", "all-users"],
        },
      });
      if (error) throw error;
      if (!data?.sent) {
        toast.error("Notification not sent", { description: data?.error || "Please try again." });
        return;
      }
      toast.success("Push notification sent");
      setTitle("");
      setMessage("");
      setLink("/");
      setOpen(false);
    } catch (err: any) {
      toast.error("Push notification failed", { description: err?.message || "Unknown error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-xs font-semibold text-slate-200 transition-all hover:border-[#FF5910]/50 hover:bg-white/[0.08]">
          <Bell className="h-4 w-4" />
          Send push notification
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Send push notification</DialogTitle>
          <DialogDescription>Goes to every device that turned on notifications.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Title (e.g. Mets game starts soon!)" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
          <textarea
            placeholder="Message"
            maxLength={500}
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <Input placeholder="Link when tapped (e.g. /live)" maxLength={300} value={link} onChange={(e) => setLink(e.target.value)} />
          <Button onClick={handleSend} disabled={loading} className="w-full">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bell className="mr-2 h-4 w-4" />}
            Send now
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}


export default function DailyActions() {
  const navigate = useNavigate();
  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <div>
        <h1 className="text-white">Daily Actions</h1>
        <p className="mt-1 text-sm text-slate-400">Refresh today's content, send a push and get video ideas.</p>
      </div>

      <section className="adm-panel p-4 sm:p-5">
        <h2 className="mb-3 text-white">Refresh content</h2>
        <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
          <ManualFetchButton label="Lineup card" icon={<ClipboardList className="h-4 w-4" />} functionName="fetch-mets-lineup" successMessage="Lineup card fetched!" />
          <ManualFetchButton label="Highlights" icon={<Video className="h-4 w-4" />} functionName="fetch-mets-highlights" successMessage="Highlights fetched!" />
          <ManualFetchButton label="Schedule" icon={<RefreshCw className="h-4 w-4" />} functionName="fetch-mets-schedule" successMessage="Schedule fetched!" />
          <ManualFetchButton
            label="Predictions"
            icon={<Sparkles className="h-4 w-4" />}
            functionName="generate-daily-predictions"
            successMessage="Predictions generated!"
            onCreditsExhausted={() => navigate("/admin/predictions")}
          />
          <TestPushButton />
        </div>
      </section>

      <RefreshEveryoneCard />

      <ContentIdeasCard />
    </div>
  );
}
