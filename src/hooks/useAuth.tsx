import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

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

    const clearCorruptedSession = async () => {
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch {
        // Ignore cleanup errors; we still reset local state below
      }

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
    const initializeAuth = async () => {
      try {
        const { data: { session: existingSession }, error } = await supabase.auth.getSession();
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
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      // Clear local state first for immediate UI feedback
      setSession(null);
      setUser(null);

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
