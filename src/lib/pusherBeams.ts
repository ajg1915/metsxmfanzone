/**
 * Pusher Beams web push.
 * Replaces the previous Firebase Cloud Messaging setup.
 */
import { supabase } from "@/integrations/supabase/client";

let cachedInstanceId: string | null = (import.meta.env.VITE_PUSHER_BEAMS_INSTANCE_ID as string) || null;

async function getInstanceId(): Promise<string | null> {
  if (cachedInstanceId) return cachedInstanceId;
  try {
    const { data } = await supabase.functions.invoke("get-beams-instance");
    cachedInstanceId = data?.instanceId ?? null;
  } catch (err) {
    console.error("[Beams] could not load instance id:", err);
  }
  return cachedInstanceId;
}

export const GLOBAL_INTEREST = "all-users";
export const userInterest = (userId: string) => `user-${userId.replace(/[^a-zA-Z0-9_\-=@,.;]/g, "")}`;

export type BeamsResult =
  | { status: "registered"; deviceId: string }
  | { status: "not-configured" | "unsupported" | "open-in-new-tab" | "denied" | "error" };

let clientPromise: Promise<any> | null = null;

async function getClient(instanceId: string) {
  if (!clientPromise) {
    clientPromise = (async () => {
      const { Client } = await import("@pusher/push-notifications-web");
      return new Client({
        instanceId,
        serviceWorkerRegistration: await navigator.serviceWorker.register("/service-worker.js", {
          scope: "/",
        }),
      });
    })();
  }
  return clientPromise;
}

/** Ask for permission and register this browser with Pusher Beams. */
export async function enablePush(interests: string[] = [GLOBAL_INTEREST]): Promise<BeamsResult> {
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { status: "unsupported" };
  }
  if (window.top !== window.self) return { status: "open-in-new-tab" };

  const instanceId = await getInstanceId();
  if (!instanceId) return { status: "not-configured" };

  try {
    const client = await getClient(instanceId);
    await client.start();

    const permission =
      Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    if (permission !== "granted") return { status: "denied" };

    for (const interest of interests) {
      await client.addDeviceInterest(interest);
    }

    const deviceId = await client.getDeviceId();
    return { status: "registered", deviceId };
  } catch (err) {
    console.error("[Beams] registration failed:", err);
    return { status: "error" };
  }
}

/** Stop receiving pushes on this browser. */
export async function disablePush(): Promise<void> {
  const instanceId = await getInstanceId();
  if (!instanceId) return;
  try {
    const client = await getClient(instanceId);
    await client.stop();
  } catch (err) {
    console.error("[Beams] stop failed:", err);
  }
}
