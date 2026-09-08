import { initializeApp, getApps, getApp } from "firebase/app";
import { getMessaging, getToken, isSupported, onMessage } from "firebase/messaging";

// Public Firebase web config (safe to ship in client code).
const FALLBACK = {
  apiKey: "AIzaSyDyMirQ2w07ntuKUTcaZquuDQLTxvBG8QQ",
  projectId: "metsxmfanzone-e5abd",
  appId: "", // set to the Firebase **Web** app id: 1:30387701485:web:xxxxxxxx
  senderId: "30387701485",
  vapidKey:
    "BDU-_e5zFy4oRtVYQECn0Ni3TntvarTZkzy8YFTBoruvphBYWHbZPp4QiV5nhUZG4C8w2rVEJ1qOgcNjP0VRiAM",
};

const appId =
  (import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_APP_ID as string | undefined) ||
  FALLBACK.appId;
const vapidKey =
  (import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_VAPID_KEY as string | undefined) ||
  FALLBACK.vapidKey;

export const firebaseConfig = {
  apiKey:
    (import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_WEB_API_KEY as string | undefined) ||
    FALLBACK.apiKey,
  projectId:
    (import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_PROJECT_ID as string | undefined) ||
    FALLBACK.projectId,
  appId,
  messagingSenderId: appId?.split(":")[1] || FALLBACK.senderId,
};


export type PushResult =
  | { status: "registered"; token: string }
  | { status: "not-configured" | "unsupported" | "open-in-new-tab" | "denied" };

function isConfigured() {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.projectId &&
      firebaseConfig.appId &&
      firebaseConfig.messagingSenderId &&
      vapidKey
  );
}

function getFirebaseApp() {
  return getApps().length ? getApp() : initializeApp(firebaseConfig as Record<string, string>);
}

/** Must be called from a user gesture (click). */
export async function enablePush(): Promise<PushResult> {
  if (!isConfigured()) return { status: "not-configured" };
  if (!("Notification" in window) || !(await isSupported())) return { status: "unsupported" };
  if (window.top !== window.self) return { status: "open-in-new-tab" };

  const permission =
    Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") return { status: "denied" };

  const query = new URLSearchParams(firebaseConfig as Record<string, string>).toString();
  const serviceWorkerRegistration = await navigator.serviceWorker.register(
    `/firebase-messaging-sw.js?${query}`
  );
  const messaging = getMessaging(getFirebaseApp());
  const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration });
  return token ? { status: "registered", token } : { status: "denied" };
}

/** Foreground message listener. Returns an unsubscribe function (or noop). */
export async function onForegroundMessage(
  handler: (payload: { title?: string; body?: string; data?: Record<string, string> }) => void
): Promise<() => void> {
  if (!isConfigured() || !(await isSupported())) return () => {};
  const messaging = getMessaging(getFirebaseApp());
  return onMessage(messaging, (payload) => {
    handler({
      title: payload.notification?.title,
      body: payload.notification?.body,
      data: (payload.data as Record<string, string>) ?? {},
    });
  });
}
