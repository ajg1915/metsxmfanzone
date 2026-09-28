// Shared sound settings for every stream player on the site.
// Default is sound ON. Once a viewer changes volume or mutes, that choice is
// remembered across pages and visits.

const KEY = "mxfz-player-sound";

type SoundPref = { on: boolean; volume: number };

export function getSoundPref(): SoundPref {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw);
      const volume = typeof p.volume === "number" && p.volume > 0 && p.volume <= 1 ? p.volume : 1;
      return { on: p.on !== false, volume };
    }
  } catch {}
  return { on: true, volume: 1 };
}

/** Save the video's current sound state as the viewer's choice. */
export function rememberSound(video: HTMLVideoElement | null) {
  if (!video) return;
  const on = !video.muted && video.volume > 0;
  const prev = getSoundPref();
  try {
    localStorage.setItem(KEY, JSON.stringify({ on, volume: on ? video.volume : prev.volume }));
  } catch {}
}

/** Turn sound on from a tap/click and remember it. */
export function unmuteFromTap(video: HTMLVideoElement | null) {
  if (!video) return;
  const { volume } = getSoundPref();
  video.muted = false;
  video.volume = volume;
  delete video.dataset.autoMuted;
  video.play().catch(() => {});
  rememberSound(video);
}

/**
 * Start playback with sound when allowed. If the browser blocks sound,
 * fall back to muted playback and call onSoundBlocked so the page can show
 * a "Tap for sound" button. Calls onPlayBlocked if even muted play fails.
 */
export function playWithSound(
  video: HTMLVideoElement,
  onSoundBlocked: () => void,
  onPlayBlocked: () => void,
) {
  const pref = getSoundPref();
  if (!pref.on) {
    video.muted = true;
    video.play().catch(onPlayBlocked);
    return;
  }
  video.volume = pref.volume;
  video.muted = false;
  delete video.dataset.autoMuted;
  video.play().catch(() => {
    // Browser requires a tap before sound: play muted for now.
    video.dataset.autoMuted = "1";
    video.muted = true;
    video.play().then(onSoundBlocked).catch(onPlayBlocked);
  });
}
