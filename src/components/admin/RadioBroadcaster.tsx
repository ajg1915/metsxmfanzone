import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Mic, Radio } from "lucide-react";
import { startBroadcast, type Broadcast } from "@/lib/podcastRadio";

// Go live from this device: pick a microphone (phone, laptop, or an input carrying OBS audio),
// press Go live, and the MetsXMFanZone podcast radio plays on the site. No VDO.Ninja.
export default function RadioBroadcaster() {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string>("");
  const [title, setTitle] = useState("MetsXMFanZone Podcast live");
  const [description, setDescription] = useState("");
  const [voiceCleanup, setVoiceCleanup] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [onAir, setOnAir] = useState(false);
  const [level, setLevel] = useState(0);
  const broadcast = useRef<Broadcast | null>(null);
  const meter = useRef<{ ctx: AudioContext; raf: number } | null>(null);

  // The site's LIVE badge, "Podcast LIVE" push alerts and emails all key off this one row, so flip it with the show.
  const setSiteLive = async (isLive: boolean) => {
    const { data: row } = await supabase.from("podcast_live_stream").select("id").limit(1).maybeSingle();
    if (!row) return;
    const patch = isLive
      ? { is_live: true, title: title.trim() || "MetsXMFanZone Podcast live", description: description.trim() || null }
      : { is_live: false };
    await supabase.from("podcast_live_stream").update(patch).eq("id", row.id);
  };

  const loadDevices = async () => {
    const list = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "audioinput");
    setDevices(list);
    if (!deviceId && list[0]) setDeviceId(list[0].deviceId);
  };

  useEffect(() => {
    void loadDevices();
    navigator.mediaDevices.addEventListener?.("devicechange", loadDevices);
    return () => {
      navigator.mediaDevices.removeEventListener?.("devicechange", loadDevices);
      void stopMeter();
      void broadcast.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startMeter = (stream: MediaStream) => {
    const ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(stream);
    const an = ctx.createAnalyser();
    an.fftSize = 512;
    src.connect(an);
    const buf = new Uint8Array(an.fftSize);
    const tick = () => {
      an.getByteTimeDomainData(buf);
      let peak = 0;
      for (const v of buf) peak = Math.max(peak, Math.abs(v - 128));
      setLevel(Math.min(100, Math.round((peak / 128) * 140)));
      if (meter.current) meter.current.raf = requestAnimationFrame(tick);
    };
    meter.current = { ctx, raf: requestAnimationFrame(tick) };
  };

  const stopMeter = async () => {
    if (!meter.current) return;
    cancelAnimationFrame(meter.current.raf);
    await meter.current.ctx.close().catch(() => undefined);
    meter.current = null;
    setLevel(0);
  };

  const goLive = async () => {
    setError(null);
    setBusy(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Sign in as admin first.");
      const b = await startBroadcast({
        token,
        deviceId: deviceId || undefined,
        title: title.trim() || "MetsXMFanZone Podcast live",
        description: description.trim(),
        voiceCleanup,
        onDrop: () => {
          setError("The connection dropped. Press Go live again to restart.");
          setOnAir(false);
          void stopMeter();
          void setSiteLive(false);
        },
      });
      broadcast.current = b;
      startMeter(b.stream);
      setOnAir(true);
      await setSiteLive(true);
      await loadDevices();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not go live");
    } finally {
      setBusy(false);
    }
  };

  const endShow = async () => {
    setBusy(true);
    await stopMeter();
    await broadcast.current?.stop();
    broadcast.current = null;
    await setSiteLive(false);
    setOnAir(false);
    setBusy(false);
  };

  return (
    <Card className="border-primary/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <Mic className="w-4 h-4 text-primary" /> Go live from this device
        </CardTitle>
        <CardDescription className="text-xs">
          Uses your phone's or computer's microphone (or the input that carries your OBS audio). Listeners hear it on the site. Keep this page open while you're on air.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 px-3">
        <div className="space-y-1">
          <Label className="text-xs">Microphone / input</Label>
          <select
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
            disabled={onAir}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
          >
            {devices.length === 0 && <option value="">No microphone found (allow mic access)</option>}
            {devices.map((d, i) => (
              <option key={d.deviceId || i} value={d.deviceId}>{d.label || `Input ${i + 1}`}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Show title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-8 text-xs" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Description</Label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} className="h-8 text-xs" placeholder="What's today's show about?" />
        </div>

        <div className="flex items-center justify-between p-2 border rounded-lg">
          <div>
            <Label className="text-xs">Clean up my voice</Label>
            <p className="text-[10px] text-muted-foreground">Turn off for OBS audio with music.</p>
          </div>
          <Switch checked={voiceCleanup} onCheckedChange={setVoiceCleanup} disabled={onAir} />
        </div>

        <div className="h-2 w-full overflow-hidden rounded bg-muted" aria-label="Input level">
          <div className="h-full bg-primary transition-[width] duration-75" style={{ width: `${level}%` }} />
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        {onAir ? (
          <Button variant="destructive" className="w-full h-10" onClick={endShow} disabled={busy}>
            {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Radio className="w-4 h-4 mr-2" />}
            End show
          </Button>
        ) : (
          <Button className="w-full h-10 bg-red-600 hover:bg-red-700" onClick={goLive} disabled={busy}>
            {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Radio className="w-4 h-4 mr-2" />}
            Go live
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
