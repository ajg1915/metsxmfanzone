import { useEffect } from "react";

// Remote-control navigation for TV mode. Arrow keys move focus to the nearest
// focusable element in that direction, Enter activates it (native button/link
// behaviour), and Back returns to the previous page. Works on every page, not
// just /tv.

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [role="button"], [role="link"], [tabindex]:not([tabindex="-1"])';

function isVisible(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return false;
  const style = getComputedStyle(el);
  return style.visibility !== "hidden" && style.display !== "none";
}

function focusables(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => isVisible(el) && !el.closest("[aria-hidden='true']"),
  );
}

// Don't steal keys from an open dialog, menu or text field
function dialogOpen(): boolean {
  return !!document.querySelector('[role="dialog"], [role="menu"], [role="listbox"]');
}

function move(dir: "up" | "down" | "left" | "right") {
  const items = focusables();
  if (items.length === 0) return;

  const current = document.activeElement as HTMLElement | null;
  if (!current || !items.includes(current)) {
    items[0].focus();
    items[0].scrollIntoView({ block: "center", inline: "center" });
    return;
  }

  const a = current.getBoundingClientRect();
  const ax = a.left + a.width / 2;
  const ay = a.top + a.height / 2;

  let best: HTMLElement | null = null;
  let bestScore = Infinity;

  for (const el of items) {
    if (el === current) continue;
    const b = el.getBoundingClientRect();
    const bx = b.left + b.width / 2;
    const by = b.top + b.height / 2;
    const dx = bx - ax;
    const dy = by - ay;

    // Only consider candidates in the requested direction
    if (dir === "right" && dx <= 4) continue;
    if (dir === "left" && dx >= -4) continue;
    if (dir === "down" && dy <= 4) continue;
    if (dir === "up" && dy >= -4) continue;

    // Prefer the element straight ahead; penalise sideways drift
    const primary = dir === "left" || dir === "right" ? Math.abs(dx) : Math.abs(dy);
    const cross = dir === "left" || dir === "right" ? Math.abs(dy) : Math.abs(dx);
    const score = primary + cross * 2.5;

    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }

  if (best) {
    best.focus({ preventScroll: true });
    best.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
    return;
  }

  // Nothing ahead on screen: scroll the page in that direction instead
  if (dir === "down") window.scrollBy({ top: window.innerHeight * 0.7, behavior: "smooth" });
  if (dir === "up") window.scrollBy({ top: -window.innerHeight * 0.7, behavior: "smooth" });
}

/**
 * onBack: called for the remote's Back button. Return true when it handled it. When no handler is
 * given, Back falls back to the browser's previous page.
 */
export function useTVFocusNav(enabled: boolean, onBack?: () => boolean) {
  useEffect(() => {
    if (!enabled) return;

    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = !!target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

      switch (e.key) {
        case "ArrowUp":
        case "ArrowDown":
          if (dialogOpen() && !typing) return;
          e.preventDefault();
          move(e.key === "ArrowUp" ? "up" : "down");
          return;
        case "ArrowLeft":
        case "ArrowRight":
          if (typing) return; // let the cursor move inside text fields
          if (dialogOpen()) return;
          e.preventDefault();
          move(e.key === "ArrowLeft" ? "left" : "right");
          return;
        case "GoBack":
        case "BrowserBack":
        case "XF86Back":
          e.preventDefault();
          if (onBack) onBack();
          else window.history.back();
          return;
        case "Backspace":
        case "Escape":
          // Back button on TV remotes; leave it alone inside text fields and dialogs
          if (typing || dialogOpen()) return;
          if (onBack) {
            if (onBack()) e.preventDefault();
            return;
          }
          if (window.history.length > 1) {
            e.preventDefault();
            window.history.back();
          }
          return;
        default:
          return;
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, onBack]);
}
