import { Capacitor } from "@capacitor/core";

export type NativePushResult =
  | { status: "registered"; token: string; platform: string }
  | { status: "not-native" | "denied" | "error" };

export const isNativeApp = () => Capacitor.isNativePlatform();

/**
 * Requests permission and returns the FCM/APNs device token
 * inside the Capacitor Android/iOS app.
 */
export async function enableNativePush(): Promise<NativePushResult> {
  if (!Capacitor.isNativePlatform()) return { status: "not-native" };

  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");

    let permission = await PushNotifications.checkPermissions();
    if (permission.receive !== "granted") {
      permission = await PushNotifications.requestPermissions();
    }
    if (permission.receive !== "granted") return { status: "denied" };

    const token = await new Promise<string | null>((resolve) => {
      const timeout = setTimeout(() => resolve(null), 15000);

      PushNotifications.addListener("registration", (t) => {
        clearTimeout(timeout);
        resolve(t.value);
      });
      PushNotifications.addListener("registrationError", (err) => {
        clearTimeout(timeout);
        console.error("[NativePush] registration error:", err);
        resolve(null);
      });

      PushNotifications.register();
    });

    if (!token) return { status: "error" };
    return { status: "registered", token, platform: Capacitor.getPlatform() };
  } catch (err) {
    console.error("[NativePush] failed:", err);
    return { status: "error" };
  }
}
