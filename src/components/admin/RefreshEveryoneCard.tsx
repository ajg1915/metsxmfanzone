import { useState } from "react";
import { Eraser, RadioTower, RefreshCw } from "lucide-react";
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
import { clearCacheHere, refreshStreamsHere, sendForceRefresh, type RefreshScope } from "@/lib/forceRefresh";

// Admin "Clear cache": refresh live streams, or push the newest MetsXMFanZone version to everyone.
export default function RefreshEveryoneCard() {
  const [busy, setBusy] = useState<RefreshScope | null>(null);

  const send = async (scope: RefreshScope) => {
    setBusy(scope);
    const { error } = await sendForceRefresh(scope);
    setBusy(null);
    if (error) {
      toast.error("Could not send: " + error);
      return;
    }
    if (scope === "streams") {
      refreshStreamsHere();
      toast.success("Live streams refreshing for everyone within about a minute.");
    } else {
      toast.success("Everyone's screen updates to the newest version within about a minute.");
    }
  };

  const Action = ({
    scope,
    icon: Icon,
    title,
    text,
    confirm,
  }: {
    scope: RefreshScope;
    icon: typeof RefreshCw;
    title: string;
    text: string;
    confirm: string;
  }) => (
    <div className="flex flex-col gap-3 rounded-xl border border-border/50 bg-background/40 p-4">
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-foreground">{title}</h3>
      </div>
      <p className="text-sm text-muted-foreground">{text}</p>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button disabled={busy !== null} className="mt-auto h-11 gap-2 rounded-full">
            <RefreshCw className={`h-4 w-4 ${busy === scope ? "animate-spin" : ""}`} />
            {title}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}?</AlertDialogTitle>
            <AlertDialogDescription>{confirm}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void send(scope)}>{title}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

  return (
    <section className="adm-panel p-5">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Clear cache</h2>
          <p className="text-sm text-muted-foreground">Make every open website, phone app and TV app pick up your latest changes.</p>
        </div>
        <Button variant="ghost" size="sm" className="gap-2 self-start" onClick={() => void clearCacheHere()}>
          <Eraser className="h-4 w-4" /> Clear my screen only
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Action
          scope="streams"
          icon={RadioTower}
          title="Refresh live streams"
          text="Use after changing a stream link or going live. Players restart and the live list updates, without reloading the page."
          confirm="Anyone watching will see their stream restart for a few seconds."
        />
        <Action
          scope="site"
          icon={RefreshCw}
          title="Update MetsXMFanZone"
          text="Use after a site update goes live. Clears saved files and reloads everyone onto the newest version."
          confirm="Every open screen reloads. Anyone watching will see the stream restart for a few seconds."
        />
      </div>
    </section>
  );
}
