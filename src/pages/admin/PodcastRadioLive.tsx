import { Link } from "react-router-dom";
import { Radio, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import RadioBroadcaster from "@/components/admin/RadioBroadcaster";
import { useRadioStatus } from "@/lib/podcastRadio";

// Admin › Marketing › Podcast Live: go live with the MetsXMFanZone podcast from this device's microphone.
export default function PodcastRadioLive() {
  const radio = useRadioStatus();
  return (
    <div className="max-w-2xl space-y-4 px-2 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Marketing</p>
          <h1 className="text-2xl font-bold text-foreground">Podcast Live</h1>
          <p className="text-sm text-muted-foreground">Go live with your microphone. Listeners hear it on the site, the app and the TV.</p>
        </div>
        {radio.live ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white animate-pulse">
            <Radio className="h-3 w-3" /> LIVE
          </span>
        ) : (
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-bold text-muted-foreground">OFFLINE</span>
        )}
      </div>

      <RadioBroadcaster />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Before you start</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 px-4 pb-4 text-xs text-muted-foreground">
          <p>Allow the microphone when your phone or browser asks.</p>
          <p>Keep this page open while you are on air. Leaving it ends the show.</p>
          <p>Using OBS on a computer? Pick the input that carries your OBS audio, and turn off "Clean up my voice" if there is music.</p>
          <Link to="/podcast" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
            See the Podcast page <ExternalLink className="h-3 w-3" />
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
