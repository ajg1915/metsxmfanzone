import { useEffect, useRef } from "react";
import { listenToRadio } from "@/lib/podcastRadio";

/** Plays the live podcast radio while mounted. Renders nothing visible. */
export default function RadioAudio({ onEnded, onError }: { onEnded: () => void; onError?: (message: string) => void }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    let stop: (() => void) | undefined;
    let cancelled = false;
    if (ref.current) {
      listenToRadio(ref.current, onEnded)
        .then((s) => {
          if (cancelled) s();
          else stop = s;
        })
        .catch((e) => {
          if (!cancelled) {
            onError?.(e instanceof Error ? e.message : "Could not start");
            onEnded();
          }
        });
    }
    return () => {
      cancelled = true;
      stop?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <audio ref={ref} autoPlay playsInline className="hidden" />;
}
