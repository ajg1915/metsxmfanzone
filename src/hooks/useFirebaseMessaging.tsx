import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { enablePush, onForegroundMessage } from "@/lib/firebaseMessaging";

export const useFirebaseMessaging = () => {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Show foreground pushes as toasts
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    onForegroundMessage(({ title, body }) => {
      toast({ title: title || "MetsXMFanZone", description: body });
    }).then((unsub) => {
      cleanup = unsub;
    });
    return () => cleanup?.();
  }, [toast]);

  const register = useCallback(async () => {
    setLoading(true);
    try {
      const result = await enablePush();

      if (result.status !== "registered") {
        const messages: Record<string, string> = {
          "not-configured": "Push notifications aren't set up yet. Please try again later.",
          unsupported: "This browser doesn't support push notifications.",
          "open-in-new-tab": "Open the site in its own tab (or install the app) to turn on notifications.",
          denied: "Notifications are blocked. Enable them in your browser's site settings.",
        };
        toast({
          title: "Notifications not enabled",
          description: messages[result.status],
          variant: "destructive",
        });
        return false;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Sign in required",
          description: "Log in to receive game and stream alerts.",
          variant: "destructive",
        });
        return false;
      }

      const { error } = await supabase.from("fcm_tokens").upsert(
        {
          user_id: user.id,
          token: result.token,
          platform: "web",
          user_agent: navigator.userAgent,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "token" }
      );
      if (error) throw error;

      setToken(result.token);
      toast({
        title: "Notifications on",
        description: "You'll get alerts when we go live and when news drops.",
      });
      return true;
    } catch (err) {
      console.error("[FCM] registration failed:", err);
      toast({
        title: "Error",
        description: "Couldn't turn on notifications. Please try again.",
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const unregister = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const query = supabase.from("fcm_tokens").delete().eq("user_id", user.id);
    const { error } = token ? await query.eq("token", token) : await query;
    if (error) {
      console.error("[FCM] unregister failed:", error);
      return;
    }
    setToken(null);
    toast({ title: "Notifications off", description: "You won't get push alerts anymore." });
  }, [token, toast]);

  return { token, loading, register, unregister };
};
