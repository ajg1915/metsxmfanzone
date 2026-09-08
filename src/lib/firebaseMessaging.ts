import { initializeApp, getApps, getApp } from "firebase/app";
import { getMessaging, getToken, isSupported, onMessage } from "firebase/messaging";

// Public Firebase web config (safe to ship in client code).
// These values come from the Firebase web app settings for MetsXMFanZone.
const FALLBACK = {
  apiKey: "AIzaSyDyMirQ2w07ntuKUTcaZquuDQLTxvBG8QQ",
  authDomain: "metsxmfanzone-e5abd.firebaseapp.com",
  projectId: "metsxmfanzone-e5abd",
  storageBucket: "metsxmfanzone-e5abd.firebasestorage.app",
  messagingSenderId: "30387701485",
  appId: "1:30387701485:web:42cefe29addd3180872ee4",
  measurementId: "G-V1VNZV7J63",
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
    (import.meta.env.GOOGLE_API_KEY as string | undefined) ||
    FALLBACK.apiKey,
  authDomain:
    (import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_AUTH_DOMAIN as string | undefined) ||
    FALLBACK.authDomain,
  projectId:
    (import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_PROJECT_ID as string | undefined) ||
    FALLBACK.projectId,
  storageBucket:
    (import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_STORAGE_BUCKET as string | undefined) ||
    FALLBACK.storageBucket,
  messagingSenderId:
    (import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_MESSAGING_SENDER_ID as string | undefined) ||
    appId?.split(":")[1] ||
    FALLBACK.messagingSenderId,
  appId,
  measurementId:
    (import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_MEASUREMENT_ID as string | undefined) ||
    FALLBACK.measurementId,
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
