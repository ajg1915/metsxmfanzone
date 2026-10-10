import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { sendForceRefresh } from "@/lib/forceRefresh";

// Admin control: after a new update goes live, make every open site, phone app and TV app reload.
export default function RefreshEveryoneCard() {
  const [busy, setBusy] = useState(false);
  const [lastSent, setLastSent] = useState<string | null>(null);

  const send = async () => {
    setBusy(true);
    const { error, at } = await sendForceRefresh();
    setBusy(false);
    if (error) {
      toast.error("Could not send the refresh: " + error);
      return;
    }
    setLastSent(at ?? null);
    toast.success("Refresh sent. Everyone's screen reloads within about a minute.");
  };

  return (
    <section className="adm-panel flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-foreground">Refresh everyone</h2>
        <p className="text-sm text-muted-foreground">
          Use after an update goes live. Every open website, phone app and TV app reloads with the newest version within about a minute.
        </p>
        {lastSent && <p className="mt-1 text-xs text-muted-foreground">Last sent {new Date(lastSent).toLocaleTimeString()}</p>}
      </div>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button disabled={busy} className="h-11 shrink-0 gap-2 rounded-full px-5">
            <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
            Refresh everyone
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reload everyone's screen?</AlertDialogTitle>
            <AlertDialogDescription>
              Anyone watching a stream will see it restart for a few seconds while the page reloads.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={send}>Refresh everyone</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
