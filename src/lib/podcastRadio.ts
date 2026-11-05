import { useEffect, useState } from "react";

// Live podcast radio, no VDO.Ninja: you broadcast your microphone from the admin page, visitors
// listen on the site. Audio travels over WebRTC through Cloudflare Realtime; the
// podcast-radio Worker (cloudflare/podcast-radio-worker.js) does the signalling.
export const RADIO_API =
  (import.meta.env.VITE_PODCAST_RADIO_URL as string | undefined) || "https://podcast-radio.metsxmfan.workers.dev";

const ICE: RTCConfiguration = { iceServers: [{ urls: "stun:stun.cloudflare.com:3478" }], bundlePolicy: "max-bundle" };

export type RadioStatus = { live: boolean; title?: string; description?: string; startedAt?: number; ready: boolean };

/** Is the radio show on right now? Checked every 15 seconds. */
export function useRadioStatus(): RadioStatus {
  const [s, setS] = useState<RadioStatus>({ live: false, ready: false });
  useEffect(() => {
    let stop = false;
    const load = async () => {
      try {
        const r = await fetch(`${RADIO_API}/status`);
        const j = await r.json();
        if (!stop) setS({ live: !!j.live, title: j.title, description: j.description, startedAt: j.startedAt, ready: true });
      } catch {
        if (!stop) setS((p) => ({ ...p, live: false, ready: true }));
      }
    };
    void load();
    const id = window.setInterval(load, 15_000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, []);
  return s;
}

/** Start playing the live show into an <audio> element. Returns a function that stops it. */
export async function listenToRadio(audio: HTMLAudioElement, onEnded: () => void): Promise<() => void> {
  const pc = new RTCPeerConnection(ICE);
  const stream = new MediaStream();
  pc.ontrack = (e) => {
    stream.addTrack(e.track);
    audio.srcObject = stream;
    void audio.play().catch(() => onEnded());
  };
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === "failed" || pc.connectionState === "closed" || pc.connectionState === "disconnected") onEnded();
  };
  const stop = () => {
    pc.onconnectionstatechange = null;
    pc.close();
    audio.srcObject = null;
  };
  try {
    const res = await fetch(`${RADIO_API}/listen`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not start");
    await pc.setRemoteDescription(data.sessionDescription);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    const fin = await fetch(`${RADIO_API}/listen/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: data.sessionId, sdp: answer.sdp }),
    });
    if (!fin.ok) throw new Error("Could not finish connecting");
  } catch (err) {
    stop();
    throw err;
  }
  return stop;
}

export type BroadcastOptions = {
  token: string;
  deviceId?: string;
  title: string;
  description: string;
  /** Echo cancel, noise suppression and auto level. Turn off when sending an OBS mix that has music. */
  voiceCleanup: boolean;
  onDrop: () => void;
};

export type Broadcast = { stream: MediaStream; stop: () => Promise<void> };

async function call(path: string, token: string, body?: unknown) {
  const res = await fetch(`${RADIO_API}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.setup ? "The podcast-radio Worker is not set up yet." : data.error || `Request failed (${res.status})`);
  }
  return data;
}

/** Go live with a microphone (a phone mic, a laptop mic, or any input device, such as one carrying OBS audio). */
export async function startBroadcast(o: BroadcastOptions): Promise<Broadcast> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      deviceId: o.deviceId ? { exact: o.deviceId } : undefined,
      echoCancellation: o.voiceCleanup,
      noiseSuppression: o.voiceCleanup,
      autoGainControl: o.voiceCleanup,
      channelCount: 1,
    },
  });
  const pc = new RTCPeerConnection(ICE);
  let timer: number | undefined;
  const release = () => {
    if (timer) window.clearInterval(timer);
    pc.onconnectionstatechange = null;
    pc.close();
    stream.getTracks().forEach((t) => t.stop());
  };
  try {
    const transceiver = pc.addTransceiver(stream.getAudioTracks()[0], { direction: "sendonly" });
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    const out = await call("/go-live", o.token, { sdp: offer.sdp, mid: transceiver.mid ?? "0", title: o.title, description: o.description });
    await pc.setRemoteDescription({ type: "answer", sdp: out.sdp });
  } catch (err) {
    release();
    throw err;
  }
  timer = window.setInterval(() => {
    call("/heartbeat", o.token).catch(() => undefined);
  }, 60_000);
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === "failed" || pc.connectionState === "closed") o.onDrop();
  };
  return {
    stream,
    stop: async () => {
      release();
      await call("/end", o.token).catch(() => undefined);
    },
  };
}
