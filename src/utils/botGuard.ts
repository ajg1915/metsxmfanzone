import { useRef, useState } from "react";

/**
 * Lightweight client-side bot deterrents for public forms:
 *  - honeypot field (hidden from humans, filled by naive bots)
 *  - minimum fill time (bots submit instantly)
 *  - per-form submit throttle stored in localStorage
 *
 * This complements Cloudflare Bot Fight Mode at the edge — it is not a
 * replacement for it.
 */

const MIN_FILL_MS = 600;
const THROTTLE_MS = 5_000;

export type BotGuardResult = { ok: boolean; reason?: string };

export const useBotGuard = (formKey: string) => {
  const mountedAt = useRef<number>(Date.now());
  const [honeypot, setHoneypot] = useState("");

  const check = (): BotGuardResult => {
    if (honeypot.trim() !== "") {
      return { ok: false, reason: "Submission blocked." };
    }

    if (Date.now() - mountedAt.current < MIN_FILL_MS) {
      return { ok: false, reason: "That was too fast — please try again." };
    }

    try {
      const last = Number(localStorage.getItem(`bg:${formKey}`) ?? 0);
      if (last && Date.now() - last < THROTTLE_MS) {
        return { ok: false, reason: "Please wait a moment before submitting again." };
      }
    } catch {
      // storage unavailable — skip throttle
    }

    return { ok: true };
  };

  const markSubmitted = () => {
    try {
      localStorage.setItem(`bg:${formKey}`, String(Date.now()));
    } catch {
      // ignore
    }
  };

  const reset = () => {
    mountedAt.current = Date.now();
    setHoneypot("");
  };

  /** Props to spread onto a visually hidden text input inside the form. */
  const honeypotProps = {
    type: "text" as const,
    name: "company_website",
    tabIndex: -1,
    autoComplete: "off",
    "aria-hidden": true,
    value: honeypot,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setHoneypot(e.target.value),
    style: {
      position: "absolute" as const,
      left: "-9999px",
      width: "1px",
      height: "1px",
      opacity: 0,
    },
  };

  return { check, markSubmitted, reset, honeypotProps };
};
