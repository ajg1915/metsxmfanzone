import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { enablePush, GLOBAL_INTEREST, userInterest } from "@/lib/pusherBeams";

/** Registers this device with Pusher Beams and stores the device id. */
async function registerBeamsDevice(userId: string) {
  try {
    const result = await enablePush([GLOBAL_INTEREST, userInterest(userId)]);
    if (result.status !== "registered") {
      console.warn("[Beams] not registered:", result.status);
      return;
    }
    const { error } = await supabase.from("fcm_tokens").upsert(
      {
        user_id: userId,
        token: result.deviceId,
        platform: "beams-web",
        user_agent: navigator.userAgent,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "token" }
    );
    if (error) console.error("[Beams] device save failed:", error);
  } catch (err) {
    console.error("[Beams] registration error:", err);
  }
}


export const useNotifications = () => {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if ("Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = async () => {
    if (!("Notification" in window)) {
      toast({
        title: "Not Supported",
        description: "Your browser doesn't support notifications",
        variant: "destructive",
      });
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      setPermission(permission);

      if (permission === "granted") {
        await subscribeToPushNotifications();
        return true;
      } else {
        toast({
          title: "Permission Denied",
          description: "You won't receive notifications about news and updates",
        });
        return false;
      }
    } catch (error) {
      console.error("Error requesting notification permission:", error);
      toast({
        title: "Error",
        description: "Failed to request notification permission",
        variant: "destructive",
      });
      return false;
    }
  };

  const subscribeToPushNotifications = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log("User not authenticated");
        return;
      }

      // Register this device with Pusher Beams
      await registerBeamsDevice(user.id);

      // Always use the main "/" service worker for web push (it owns the push handler)
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;


      // Fetch VAPID public key from edge function (safe to expose - it's a public key)
      let vapidPublicKey: string | undefined;
      
      try {
        const { data, error } = await supabase.functions.invoke('get-vapid-key');
        if (error) {
          console.error("Error fetching VAPID key:", error);
        } else {
          vapidPublicKey = data?.vapidPublicKey;
        }
      } catch (fetchError) {
        console.error("Failed to fetch VAPID key:", fetchError);
      }

      if (!vapidPublicKey) {
        console.warn(
          "[Notifications] Missing VAPID public key. Push subscription skipped."
        );
        toast({
          title: "Notifications not configured",
          description: "Push notifications are not available. Please try again later.",
          variant: "destructive",
        });
        return;
      }

      // Always unsubscribe existing and create fresh subscription with current VAPID key
      // This ensures the subscription matches the server's VAPID credentials
      let subscription = await (registration as any).pushManager.getSubscription();

      if (subscription) {
        // Unsubscribe old subscription to ensure fresh key match
        await subscription.unsubscribe();
        console.log("Unsubscribed old push subscription");
      }

      // Create new subscription with current VAPID key
      subscription = await (registration as any).pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      console.log("Created new push subscription");

      // Get subscription data
      const subscriptionJSON = subscription.toJSON();
      const endpoint = subscriptionJSON.endpoint || "";
      const p256dh = subscriptionJSON.keys?.p256dh || "";
      const auth = subscriptionJSON.keys?.auth || "";

      // Encrypt subscription data before storing
      const { data: encryptedData, error: encryptError } = await supabase.functions.invoke('encrypt-on-save', {
        body: {
          action: 'encrypt',
          table: 'notification_subscriptions',
          data: { endpoint, p256dh, auth }
        }
      });

      if (encryptError) {
        console.error("Encryption failed, storing unencrypted:", encryptError);
        // Fallback to unencrypted storage
        const { error } = await supabase
          .from("notification_subscriptions")
          .upsert({
            user_id: user.id,
            endpoint,
            p256dh,
            auth,
          });
        if (error) throw error;
      } else {
        // Store encrypted subscription
        const { error } = await supabase
          .from("notification_subscriptions")
          .upsert({
            user_id: user.id,
            endpoint: encryptedData?.data?.endpoint || endpoint,
            p256dh: encryptedData?.data?.p256dh || p256dh,
            auth: encryptedData?.data?.auth || auth,
          });
        if (error) throw error;
      }

      setIsSubscribed(true);
      toast({
        title: "Notifications Enabled",
        description: "You'll receive notifications about news and updates!",
      });
    } catch (error) {
      console.error("Error subscribing to push notifications:", error);
      toast({
        title: "Error",
        description: "Failed to enable notifications",
        variant: "destructive",
      });
    }
  };

  const unsubscribe = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const registration = await navigator.serviceWorker.ready;
      const subscription = await (registration as any).pushManager.getSubscription();
      
      if (subscription) {
        await subscription.unsubscribe();
      }

      await supabase.from("fcm_tokens").delete().eq("user_id", user.id);

      const { error } = await supabase
        .from("notification_subscriptions")
        .delete()
        .eq("user_id", user.id);

      if (error) throw error;


      setIsSubscribed(false);
      toast({
        title: "Notifications Disabled",
        description: "You won't receive notifications anymore",
      });
    } catch (error) {
      console.error("Error unsubscribing from notifications:", error);
      toast({
        title: "Error",
        description: "Failed to disable notifications",
        variant: "destructive",
      });
    }
  };

  return {
    permission,
    isSubscribed,
    requestPermission,
    unsubscribe,
  };
};

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
