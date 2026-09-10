import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { generateDeviceFingerprint } from "@/utils/deviceFingerprint";
import { useDevice } from "@/hooks/use-device";
import { withTimeout } from "@/utils/asyncTimeout";

export default function AdminPortal() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isTV } = useDevice();
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);

  const clearStoredAdminSession = () => {
    sessionStorage.removeItem("admin_verified");
    sessionStorage.removeItem("admin_verified_at");
    sessionStorage.removeItem("admin_user_id");
    sessionStorage.removeItem("admin_session_token");
    sessionStorage.removeItem("admin_device_fingerprint");
  };

  const handleEmailLogin = async () => {
    if (!adminEmail.trim() || !adminPassword || emailLoading) return;
    setEmailLoading(true);
    try {
      const { data: signInData, error: signInError } = await withTimeout(
        supabase.auth.signInWithPassword({
          email: adminEmail.trim(),
          password: adminPassword,
        }),
        12000,
        "Admin sign-in timed out"
      );

      if (signInError || !signInData?.user) {
        toast({
          title: "Sign-in failed",
          description: "Check your email and password and try again.",
          variant: "destructive",
        });
        return;
      }

      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", signInData.user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (!roleRow) {
        await supabase.auth.signOut({ scope: "local" });
        toast({
          title: "Access denied",
          description: "This account does not have admin access.",
          variant: "destructive",
        });
        return;
      }

      const activeFingerprint = await generateDeviceFingerprint();
      clearStoredAdminSession();
      sessionStorage.setItem("admin_verified", "true");
      sessionStorage.setItem("admin_verified_at", new Date().toISOString());
      sessionStorage.setItem("admin_user_id", signInData.user.id);
      sessionStorage.setItem("admin_device_fingerprint", activeFingerprint);

      toast({ title: "Welcome, Admin", description: "Successfully authenticated" });
      setAdminPassword("");
      setTimeout(() => navigate(isTV ? "/tv" : "/admin"), 400);
    } catch (err) {
      console.error("Admin email login error:", err);
      toast({ title: "Error", description: "Could not sign in. Please try again.", variant: "destructive" });
    } finally {
      setEmailLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-secondary/10 blur-[120px]" />
        <div className="absolute bottom-1/4 left-1/3 w-[300px] h-[300px] rounded-full bg-primary/5 blur-[100px]" />
      </div>

      <div className="w-full max-w-sm relative z-10">
        <div className="rounded-2xl border border-muted/50 bg-card/90 backdrop-blur-xl shadow-2xl overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-secondary via-primary to-secondary" />

          <div className="p-5 sm:p-6 space-y-5">
            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-secondary/15 flex items-center justify-center ring-2 ring-secondary/30">
                <Shield className="w-7 h-7 text-secondary" />
              </div>
              <div className="text-center">
                <h1 className="text-lg font-bold text-foreground">Admin Portal</h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Sign in with your admin email and password
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <Input
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="Admin email"
                autoComplete="email"
                className="h-11 rounded-xl bg-muted/30 border-muted/50"
                disabled={emailLoading}
              />
              <Input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Password"
                autoComplete="current-password"
                className="h-11 rounded-xl bg-muted/30 border-muted/50"
                disabled={emailLoading}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleEmailLogin();
                }}
              />
              <Button
                onClick={handleEmailLogin}
                disabled={!adminEmail.trim() || !adminPassword || emailLoading}
                className="w-full h-10 text-sm font-semibold rounded-xl bg-primary hover:bg-primary/90"
              >
                {emailLoading ? (
                  "Signing in..."
                ) : (
                  <span className="flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5" />
                    Access Admin Panel
                  </span>
                )}
              </Button>
            </div>

            <div className="bg-muted/30 rounded-xl p-3 text-[10px] text-muted-foreground space-y-1">
              <p className="font-medium flex items-center gap-1 text-foreground/70">
                <Lock className="w-2.5 h-2.5" /> Security Active
              </p>
              <ul className="list-disc list-inside space-y-0.5 pl-1 text-muted-foreground/80">
                <li>Admin role verified on every sign-in</li>
                <li>Device fingerprint recorded</li>
              </ul>
            </div>

            <button
              type="button"
              onClick={() => navigate("/")}
              className="w-full text-center text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Return to Home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
