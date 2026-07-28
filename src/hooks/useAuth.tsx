import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { isTimeoutError, withTimeout } from "@/utils/asyncTimeout";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const clearLocalAuthStorage = () => {
      try {
        Object.keys(localStorage).forEach((key) => {
          if (key.startsWith("sb-") || key === "supabase.auth.token") {
            localStorage.removeItem(key);
          }
        });
        sessionStorage.removeItem("admin_verified");
        sessionStorage.removeItem("admin_verified_at");
        sessionStorage.removeItem("admin_user_id");
        sessionStorage.removeItem("admin_session_token");
        sessionStorage.removeItem("admin_device_fingerprint");
      } catch {
        // Storage may be unavailable in private browsing; ignore cleanup errors.
      }
    };

    const clearCorruptedSession = async () => {
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch {
        // Ignore cleanup errors; we still reset local state below
      }

      clearLocalAuthStorage();

      if (isMounted) {
        setSession(null);
        setUser(null);
      }
    };

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        if (!isMounted) return;

        if (event === "SIGNED_OUT") {
          setSession(null);
          setUser(null);
          return;
        }

        // Update state synchronously — never await inside this callback
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
      }
    );

    // THEN perform the initial session check (controls loading)
    let initialized = false;
    let safetyTimer: ReturnType<typeof setTimeout>;

    const initializeAuth = async () => {
      try {
        const { data: { session: existingSession }, error } = await withTimeout(
          supabase.auth.getSession(),
          4500,
          "Auth session check timed out"
        );
        if (!isMounted) return;

        if (error) {
          console.error("Error getting session:", error);

          const message = error.message.toLowerCase();
          if (message.includes("refresh token") || message.includes("invalid refresh token")) {
            await clearCorruptedSession();
          }
          return;
        }

        setSession(existingSession);
        setUser(existingSession?.user ?? null);
      } catch (err) {
        console.error("Unexpected auth init error:", err);
        const message = err instanceof Error ? err.message.toLowerCase() : "";
        if (isTimeoutError(err) || message.includes("failed to fetch") || message.includes("refresh token")) {
          await clearCorruptedSession();
        }
      } finally {
        initialized = true;
        clearTimeout(safetyTimer);
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    // Safety timeout: never leave the app stuck on a loading screen if
    // the auth token refresh hangs due to a network failure. A hung refresh
    // means the stored session is unusable, so clear it locally — otherwise
    // the client keeps retrying a dead refresh token and every signed-in
    // screen (admin PIN included) stays locked out.
    safetyTimer = setTimeout(async () => {
      if (!isMounted || initialized) return;
      console.warn("Auth init timed out — clearing local session");
      await clearCorruptedSession();
      if (isMounted) setLoading(false);
    }, 6000);




    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      // Clear local state first for immediate UI feedback
      setSession(null);
      setUser(null);
      try {
        sessionStorage.removeItem("admin_verified");
        sessionStorage.removeItem("admin_verified_at");
        sessionStorage.removeItem("admin_user_id");
        sessionStorage.removeItem("admin_session_token");
        sessionStorage.removeItem("admin_device_fingerprint");
      } catch {
        // Ignore storage cleanup errors.
      }

      const { error } = await supabase.auth.signOut({ scope: "local" });

      // Ignore "session_not_found" — user is already signed out
      if (error && !error.message.includes("session_not_found")) {
        console.error("Sign out error:", error);
      }
    } catch (error) {
      console.error("Unexpected sign out error:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
