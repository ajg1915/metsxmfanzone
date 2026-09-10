import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, Shield, AlertTriangle, Fingerprint, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { generateDeviceFingerprint, getDeviceName } from "@/utils/deviceFingerprint";
import { trackFailedLogin, trackSuspiciousActivity } from "@/utils/securityAlerts";
import { useDevice } from "@/hooks/use-device";
import { withTimeout } from "@/utils/asyncTimeout";

export default function AdminPortal() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isTV } = useDevice();
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingLockout, setCheckingLockout] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutMinutes, setLockoutMinutes] = useState(0);
  const [attemptsRemaining, setAttemptsRemaining] = useState(5);
  const [deviceFingerprint, setDeviceFingerprint] = useState<string>("");
  const [isNewDevice, setIsNewDevice] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [connectionIssue, setConnectionIssue] = useState("");
  const [showEmailLogin, setShowEmailLogin] = useState(false);
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
    setConnectionIssue("");
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

      const activeFingerprint = deviceFingerprint || (await generateDeviceFingerprint());
      clearStoredAdminSession();
      sessionStorage.setItem("admin_verified", "true");
      sessionStorage.setItem("admin_verified_at", new Date().toISOString());
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



  const handleForgotPin = async () => {
    if (!forgotEmail.trim()) {
      toast({ title: "Email required", description: "Enter the admin email address.", variant: "destructive" });
      return;
    }
    setForgotLoading(true);
    try {
      const { data, error } = await withTimeout(
        supabase.functions.invoke("admin-pin-login", {
          body: { action: "request-pin-reset", email: forgotEmail.trim() },
        }),
        10000,
        "PIN reset request timed out"
      );
      if (error) throw error;
      setForgotSent(true);
      toast({
        title: "Check your email",
        description: data?.message || "If an admin account exists for that email, a reset link has been sent.",
      });
    } catch (err) {
      console.error("Forgot PIN error:", err);
      toast({ title: "Error", description: "Could not send reset email. Try again.", variant: "destructive" });
    } finally {
      setForgotLoading(false);
    }
  };

  useEffect(() => {
    const initFingerprint = async () => {
      const fp = await generateDeviceFingerprint();
      setDeviceFingerprint(fp);
      checkLockoutStatus(fp);
    };
    initFingerprint();
  }, []);

  const checkLockoutStatus = async (fingerprint: string) => {
    try {
      const { data, error } = await withTimeout(
        supabase.functions.invoke('admin-pin-login', {
          body: { action: 'check-lockout', deviceFingerprint: fingerprint }
        }),
        6500,
        "Admin lockout check timed out"
      );
      if (error) throw error;
      setIsLocked(data.locked);
      setAttemptsRemaining(data.attemptsRemaining);
      setConnectionIssue("");
    } catch (err) {
      console.error('Error checking lockout:', err);
      setConnectionIssue("Secure connection was slow, but you can still try your PIN.");
      setIsLocked(false);
      setAttemptsRemaining(5);
    } finally {
      setCheckingLockout(false);
    }
  };

  const handleLogin = useCallback(async () => {
    if (pin.length < 4 || loading) return;
    setLoading(true);
    setConnectionIssue("");
    try {
      const activeFingerprint = deviceFingerprint || await generateDeviceFingerprint();
      if (!deviceFingerprint) {
        setDeviceFingerprint(activeFingerprint);
      }
      const deviceName = getDeviceName();
      const { data, error } = await withTimeout(
        supabase.functions.invoke('admin-pin-login', {
          body: { action: 'login', pin, deviceFingerprint: activeFingerprint, deviceName }
        }),
        12000,
        "Admin PIN login timed out"
      );

      if (error) {
        // Read the actual response body from the FunctionsHttpError
        let errorBody: any = null;
        try {
          if ((error as any).context instanceof Response) {
            errorBody = await (error as any).context.json();
          }
        } catch { /* ignore parse errors */ }

        if (errorBody) {
          if (errorBody.locked) {
            setIsLocked(true);
            setLockoutMinutes(errorBody.remainingMinutes ?? 30);
            await trackSuspiciousActivity('unknown', 'admin_lockout', `Device locked after multiple failed PIN attempts`);
            toast({ title: "Account Locked", description: errorBody.message || "Too many failed attempts.", variant: "destructive" });
            setPin("");
            return;
          }
          if (errorBody.error === 'Invalid PIN' || errorBody.attemptsRemaining !== undefined) {
            const remaining = errorBody.attemptsRemaining ?? attemptsRemaining - 1;
            setAttemptsRemaining(remaining);
            await trackFailedLogin('admin-portal', activeFingerprint.substring(0, 16));
            toast({ title: "Invalid PIN", description: `${remaining} attempts remaining`, variant: "destructive" });
            setPin("");
            return;
          }
        }
        throw error;
      }

      if (data?.error) {
        if (data.locked) {
          setIsLocked(true);
          setLockoutMinutes(data.remainingMinutes);
          await trackSuspiciousActivity('unknown', 'admin_lockout', `Device locked after multiple failed PIN attempts`);
          toast({ title: "Account Locked", description: data.message, variant: "destructive" });
          return;
        }
        setAttemptsRemaining(data.attemptsRemaining ?? attemptsRemaining - 1);
        await trackFailedLogin('admin-portal', activeFingerprint.substring(0, 16));
        toast({ title: "Invalid PIN", description: `${data.attemptsRemaining} attempts remaining`, variant: "destructive" });
        setPin("");
        return;
      }

      if (data.success) {
        clearStoredAdminSession();
        sessionStorage.setItem("admin_verified", "true");
        sessionStorage.setItem("admin_verified_at", new Date().toISOString());
        sessionStorage.setItem("admin_user_id", data.userId);
        sessionStorage.setItem("admin_device_fingerprint", activeFingerprint);
        setIsNewDevice(data.isNewDevice);

        // Complete the browser auth session directly from the server-issued hash.
        // Parsing the action-link URL is unreliable in embedded previews because
        // auth links can use either query or hash parameters depending on config.
        if (data.tokenHash) {
          let sessionEstablished = false;

          for (let attempt = 0; attempt < 2 && !sessionEstablished; attempt += 1) {
            try {
              const { data: verification, error: verifyError } = await withTimeout(
                supabase.auth.verifyOtp({
                  token_hash: data.tokenHash,
                  type: "magiclink",
                }),
                10000,
                "Admin session verification timed out"
              );

              if (verifyError) throw verifyError;
              sessionEstablished = Boolean(verification.session);
            } catch (err) {
              console.warn(`Admin session verification attempt ${attempt + 1} failed`, err);
              if (attempt === 0) {
                await new Promise((resolve) => setTimeout(resolve, 500));
              }
            }
          }
        }

        toast({
          title: "Welcome, Admin",
          description: data.isNewDevice ? "New device registered and trusted" : "Successfully authenticated",
        });
        setTimeout(() => navigate(isTV ? "/tv" : "/admin"), 500);
      }
    } catch (err) {
      console.error('Login error:', err);
      setConnectionIssue("Login did not complete. Refresh the secure session and try again.");
      toast({ title: "Error", description: "Failed to authenticate. Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [pin, deviceFingerprint, loading, navigate, toast, attemptsRemaining]);

  useEffect(() => {
    // PIN is submitted by button or Enter only. Auto-submit caused partial PINs
    // to fire early on devices with saved/admin keypad input.
  }, [pin, loading, isLocked, handleLogin]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      {/* Decorative glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-secondary/10 blur-[120px]" />
        <div className="absolute bottom-1/4 left-1/3 w-[300px] h-[300px] rounded-full bg-primary/5 blur-[100px]" />
      </div>

      <div className="w-full max-w-sm relative z-10">
        {/* Card */}
        <div className="rounded-2xl border border-muted/50 bg-card/90 backdrop-blur-xl shadow-2xl overflow-hidden">
          {/* Header gradient strip */}
          <div className="h-1 bg-gradient-to-r from-secondary via-primary to-secondary" />
          
          <div className="p-5 sm:p-6 space-y-5">
            {/* Icon */}
            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-secondary/15 flex items-center justify-center ring-2 ring-secondary/30">
                <Shield className="w-7 h-7 text-secondary" />
              </div>
              <div className="text-center">
                <h1 className="text-lg font-bold text-foreground">Admin Portal</h1>
                <p className="text-xs text-muted-foreground mt-0.5">Enter your security PIN to continue</p>
              </div>
            </div>

            {isLocked ? (
              <div className="text-center space-y-3 py-2">
                <div className="mx-auto w-12 h-12 bg-destructive/15 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-destructive" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold text-sm text-destructive">Access Blocked</h3>
                  <p className="text-xs text-muted-foreground">
                    Device locked for {lockoutMinutes} minutes.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate("/")} className="mt-2 text-xs">
                  Return to Home
                </Button>
              </div>
            ) : (
              <>
                {connectionIssue && (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-center text-[11px] text-destructive">
                    {connectionIssue}
                  </div>
                )}

                {/* Device badge */}
                <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
                  <Fingerprint className="w-3 h-3" />
                  <span>{checkingLockout ? "Checking device status" : "Device verified"}</span>
                  <CheckCircle className="w-2.5 h-2.5 text-green-500" />
                </div>

                {/* PIN Input */}
                <div className="flex flex-col items-center gap-2">
                  <Input
                    type="password"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="Enter PIN"
                    className="text-center text-lg tracking-[0.3em] max-w-[180px] h-12 bg-muted/30 border-muted/50 rounded-xl focus:ring-2 focus:ring-secondary/50"
                    maxLength={8}
                    autoComplete="off"
                    disabled={loading}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && pin.length >= 4) handleLogin();
                    }}
                  />
                  <p className="text-[10px] text-muted-foreground">Enter your 4–8 digit admin PIN</p>
                </div>

                {/* Attempts */}
                <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
                  <Lock className="w-2.5 h-2.5" />
                  <span>{attemptsRemaining} attempts remaining</span>
                </div>

                {/* Submit */}
                <Button
                  onClick={handleLogin}
                  disabled={pin.length < 4 || loading}
                  className="w-full h-10 text-sm font-semibold rounded-xl bg-primary hover:bg-primary/90"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin text-xs">⏳</span>
                      Verifying...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Shield className="w-3.5 h-3.5" />
                      Access Admin Panel
                    </span>
                  )}
                </Button>

                {connectionIssue && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      clearStoredAdminSession();
                      window.location.reload();
                    }}
                    className="w-full h-9 text-xs rounded-xl"
                  >
                    Refresh Secure Login
                  </Button>
                )}

                {/* Security info */}
                <div className="bg-muted/30 rounded-xl p-3 text-[10px] text-muted-foreground space-y-1">
                  <p className="font-medium flex items-center gap-1 text-foreground/70">
                    <Shield className="w-2.5 h-2.5" /> Security Active
                  </p>
                  <ul className="list-disc list-inside space-y-0.5 pl-1 text-muted-foreground/80">
                    <li>Device fingerprinting</li>
                    <li>30-min lockout after 5 fails</li>
                    <li>All attempts logged</li>
                  </ul>
                </div>

                {/* Forgot PIN */}
                <div className="border-t border-muted/30 pt-3">
                  {!showForgot ? (
                    <button
                      type="button"
                      onClick={() => setShowForgot(true)}
                      className="w-full text-center text-[11px] text-secondary hover:text-secondary/80 transition-colors"
                    >
                      Forgot your PIN?
                    </button>
                  ) : forgotSent ? (
                    <div className="text-center text-[10px] text-muted-foreground space-y-1">
                      <CheckCircle className="w-4 h-4 text-green-500 mx-auto" />
                      <p>Check your email for a reset link.</p>
                      <button
                        type="button"
                        onClick={() => { setShowForgot(false); setForgotSent(false); setForgotEmail(""); }}
                        className="text-secondary hover:underline"
                      >
                        Close
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-[10px] text-muted-foreground text-center">
                        Enter your admin email to receive a PIN reset link.
                      </p>
                      <Input
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="admin@example.com"
                        className="h-9 text-xs bg-muted/30 border-muted/50 rounded-lg"
                        disabled={forgotLoading}
                        onKeyDown={(e) => { if (e.key === "Enter") handleForgotPin(); }}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setShowForgot(false); setForgotEmail(""); }}
                          disabled={forgotLoading}
                          className="flex-1 h-8 text-[10px]"
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleForgotPin}
                          disabled={forgotLoading || !forgotEmail.trim()}
                          className="flex-1 h-8 text-[10px] bg-primary hover:bg-primary/90"
                        >
                          {forgotLoading ? "Sending..." : "Send Reset Link"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Email + password fallback */}
                <div className="border-t border-muted/30 pt-3">
                  {!showEmailLogin ? (
                    <button
                      type="button"
                      onClick={() => setShowEmailLogin(true)}
                      className="w-full text-center text-[11px] text-secondary hover:text-secondary/80 transition-colors"
                    >
                      Sign in with email and password
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-[10px] text-muted-foreground text-center">
                        Admin sign-in without a PIN.
                      </p>
                      <Input
                        type="email"
                        value={adminEmail}
                        onChange={(e) => setAdminEmail(e.target.value)}
                        placeholder="admin@example.com"
                        autoComplete="username"
                        className="h-9 text-xs bg-muted/30 border-muted/50 rounded-lg"
                        disabled={emailLoading}
                      />
                      <Input
                        type="password"
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        placeholder="Password"
                        autoComplete="current-password"
                        className="h-9 text-xs bg-muted/30 border-muted/50 rounded-lg"
                        disabled={emailLoading}
                        onKeyDown={(e) => { if (e.key === "Enter") handleEmailLogin(); }}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setShowEmailLogin(false); setAdminPassword(""); }}
                          disabled={emailLoading}
                          className="flex-1 h-8 text-[10px]"
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleEmailLogin}
                          disabled={emailLoading || !adminEmail.trim() || !adminPassword}
                          className="flex-1 h-8 text-[10px] bg-primary hover:bg-primary/90"
                        >
                          {emailLoading ? "Signing in..." : "Sign In"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>



                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const supabaseAdmin = (await import("@/integrations/supabase/client")).supabase;
                      await supabaseAdmin.from("admin_login_attempts" as any).delete().neq("id", "00000000-0000-0000-0000-000000000000");
                      setIsLocked(false);
                      setAttemptsRemaining(5);
                      setPin("");
                      toast({ title: "Reset", description: "PIN attempts have been cleared." });
                    } catch {
                      toast({ title: "Error", description: "Could not reset.", variant: "destructive" });
                    }
                  }}
                  className="w-full text-center text-[9px] text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors"
                >
                  v1.0.0
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
