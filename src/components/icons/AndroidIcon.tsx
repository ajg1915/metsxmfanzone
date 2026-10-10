// The Android robot head, as a simple single-colour icon (the Android robot is shared by Google
// for use under CC BY 3.0).
export function AndroidIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.6 9.48l1.84-3.18a.38.38 0 0 0-.66-.38l-1.86 3.22A11.4 11.4 0 0 0 12 8.08c-1.77 0-3.43.38-4.92 1.06L5.22 5.92a.38.38 0 0 0-.66.38L6.4 9.48A10.78 10.78 0 0 0 1 18h22a10.78 10.78 0 0 0-5.4-8.52zM7 15.25a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5zm10 0a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5z" />
    </svg>
  );
}

export const isAndroidDevice = () =>
  typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent) && !/MetsXMFanZoneTV|AFT|SHIELD|Android TV|AndroidTV|BRAVIA|GoogleTV/i.test(navigator.userAgent);
