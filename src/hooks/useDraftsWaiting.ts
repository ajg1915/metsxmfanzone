import { useEffect, useState } from "react";
import { draftCounts } from "@/lib/draftsApi";

// One shared lookup so the tab strip and the phone bottom bar don't each ask the
// drafts service on every page change.
let cached: { at: number; waiting: number } | null = null;
let inflight: Promise<number | null> | null = null;
const TTL_MS = 30_000;

async function fetchWaiting(force: boolean): Promise<number | null> {
  if (!force && cached && Date.now() - cached.at < TTL_MS) return cached.waiting;
  if (!inflight) {
    inflight = draftCounts()
      .then((c) => {
        cached = { at: Date.now(), waiting: c.pending };
        return c.pending;
      })
      .catch(() => null) // the Drafts page itself explains any problem; the badge just stays hidden
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** How many drafts are waiting for approval (null until known, or if the service can't be reached). */
export function useDraftsWaiting(refreshKey?: string): number | null {
  const [waiting, setWaiting] = useState<number | null>(cached?.waiting ?? null);

  useEffect(() => {
    let alive = true;
    fetchWaiting(false).then((n) => {
      if (alive && n !== null) setWaiting(n);
    });
    return () => {
      alive = false;
    };
  }, [refreshKey]);

  return waiting;
}

/** Call after approving or rejecting so the badge doesn't show a stale number. */
export const forgetDraftsWaiting = () => {
  cached = null;
};
