import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield, KeyRound, CheckCircle, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function AdminPinReset() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const verifyRecoverySession = async () => {
      // Supabase puts the recovery tokens in the URL hash
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          setAuthorized(false);
          setChecking(false);
          return;
        }

        // Confirm this user is actually an admin
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .eq("role", "admin")
          .maybeSingle();

        if (!roleData) {
          setAuthorized(false);
          setChecking(false);
          return;
        }

        setUserId(session.user.id);
        setAuthorized(true);
      } catch (err) {
        console.error("Recovery verification failed:", err);
        setAuthorized(false);
      } finally {
        setChecking(false);
      }
    };

    // Give Supabase a moment to parse the recovery tokens from the URL hash
    const timer = setTimeout(verifyRecoverySession, 400);
    return () => clearTimeout(timer);
  }, []);

  const handleResetPin = async () => {
    if (!userId) return;
    if (newPin.length < 6) {
      toast({ title: "PIN too short", description: "Use at least 6 characters.", variant: "destructive" });
      return;
    }
    if (newPin !== confirmPin) {
      toast({ title: "PINs don't match", description: "Please re-enter and confirm.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-pin-login", {
        body: { action: "setup-pin", userId, newPin: newPin },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || "Failed to update PIN");
      }

      // Sign out the recovery session — admin must use the new PIN
      await supabase.auth.signOut({ scope: "local" });
      setDone(true);
      toast({ title: "PIN updated", description: "Your admin PIN was reset successfully." });
      setTimeout(() => navigate("/admin-portal"), 2000);
    } catch (err: any) {
      toast({
        title: "Error",
        description: err?.message || "Could not update PIN. Try requesting a new reset link.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-secondary/10 blur-[120px]" />
      </div>

      <div className="w-full max-w-sm relative z-10">
        <div className="rounded-2xl border border-muted/50 bg-card/90 backdrop-blur-xl shadow-2xl overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-secondary via-primary to-secondary" />
          <div className="p-6 space-y-5">
            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-secondary/15 flex items-center justify-center ring-2 ring-secondary/30">
                <KeyRound className="w-7 h-7 text-secondary" />
              </div>
              <div className="text-center">
                <h1 className="text-lg font-bold text-foreground">Reset Admin PIN</h1>
                <p className="text-xs text-muted-foreground mt-0.5">Choose a new security PIN</p>
              </div>
            </div>

            {checking ? (
              <div className="text-center py-4 text-xs text-muted-foreground animate-pulse">
                Verifying recovery link...
              </div>
            ) : !authorized ? (
              <div className="text-center space-y-3 py-2">
                <div className="mx-auto w-12 h-12 bg-destructive/15 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-destructive" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold text-sm text-destructive">Invalid or Expired Link</h3>
                  <p className="text-xs text-muted-foreground">
                    Request a new password reset link from the admin portal.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate("/admin-portal")} className="text-xs">
                  Back to Admin Portal
                </Button>
              </div>
            ) : done ? (
              <div className="text-center space-y-3 py-2">
                <div className="mx-auto w-12 h-12 bg-green-500/15 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-500" />
                </div>
                <p className="text-xs text-muted-foreground">PIN updated. Redirecting to login...</p>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] text-muted-foreground">New PIN (min 6 chars)</label>
                    <Input
                      type="password"
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value)}
                      placeholder="Enter new PIN"
                      className="h-11 mt-1 bg-muted/30 border-muted/50 rounded-xl text-center tracking-[0.2em]"
                      maxLength={20}
                      autoComplete="new-password"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground">Confirm PIN</label>
                    <Input
                      type="password"
                      value={confirmPin}
                      onChange={(e) => setConfirmPin(e.target.value)}
                      placeholder="Re-enter PIN"
                      className="h-11 mt-1 bg-muted/30 border-muted/50 rounded-xl text-center tracking-[0.2em]"
                      maxLength={20}
                      autoComplete="new-password"
                      onKeyDown={(e) => { if (e.key === "Enter") handleResetPin(); }}
                    />
                  </div>
                </div>

                <Button
                  onClick={handleResetPin}
                  disabled={loading || newPin.length < 6 || confirmPin.length < 6}
                  className="w-full h-10 rounded-xl bg-primary hover:bg-primary/90 text-sm font-semibold"
                >
                  {loading ? "Updating..." : (
                    <span className="flex items-center gap-2">
                      <Shield className="w-3.5 h-3.5" />
                      Update PIN
                    </span>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
