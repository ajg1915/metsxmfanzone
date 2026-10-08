// One pop-up prompt at a time.
//
// The install banner and the notification request used to appear together a few
// seconds after the page loaded. This keeps them in line:
//   1. Nothing shows for the first 30 seconds of a visit.
//   2. Only one prompt shows per visit (session).
//   3. A prompt someone closes stays quiet for 7 days.
//   4. The notification request waits until the visitor has read an article or
//      watched something (or has been on the site for two minutes).

const SESSION_START_KEY = "mx_session_start";
const SHOWN_KEY = "mx_prompt_shown";
const ENGAGED_KEY = "mx_engaged";
const SNOOZE_PREFIX = "mx_prompt_snooze_";

export const FIRST_PROMPT_DELAY_MS = 30_000;
export const ENGAGEMENT_FALLBACK_MS = 120_000;
export const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

export type PromptKind = "install" | "notifications";

const safeGet = (store: Storage, key: string): string | null => {
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
};

const safeSet = (store: Storage, key: string, value: string) => {
  try {
    store.setItem(key, value);
  } catch {
    /* storage can be blocked (private mode); prompts then simply follow the timers */
  }
};

/** When this visit started. Set once per session. */
export const sessionStartedAt = (): number => {
  const saved = safeGet(sessionStorage, SESSION_START_KEY);
  if (saved) return parseInt(saved, 10);
  const now = Date.now();
  safeSet(sessionStorage, SESSION_START_KEY, String(now));
  return now;
};

const msSinceStart = () => Date.now() - sessionStartedAt();

/** Call when someone reads an article or watches a stream. */
export const markEngaged = () => safeSet(sessionStorage, ENGAGED_KEY, "1");

export const isEngaged = () =>
  safeGet(sessionStorage, ENGAGED_KEY) === "1" || msSinceStart() >= ENGAGEMENT_FALLBACK_MS;

export const isSnoozed = (kind: PromptKind): boolean => {
  const until = safeGet(localStorage, SNOOZE_PREFIX + kind);
  return !!until && Date.now() < parseInt(until, 10);
};

/** Keep a prompt quiet after it is closed. */
export const snoozePrompt = (kind: PromptKind, ms: number = SNOOZE_MS) =>
  safeSet(localStorage, SNOOZE_PREFIX + kind, String(Date.now() + ms));

/** How long until the first prompt of a visit is allowed. */
export const msUntilFirstPrompt = () => Math.max(0, FIRST_PROMPT_DELAY_MS - msSinceStart());

/**
 * Ask for the one prompt slot of this visit. Returns true if the caller may show
 * its prompt now. Once a prompt has the slot, the others wait for the next visit.
 */
export const claimPromptSlot = (kind: PromptKind): boolean => {
  if (isSnoozed(kind)) return false;
  if (msSinceStart() < FIRST_PROMPT_DELAY_MS) return false;
  if (safeGet(sessionStorage, SHOWN_KEY)) return false;
  safeSet(sessionStorage, SHOWN_KEY, kind);
  return true;
};
