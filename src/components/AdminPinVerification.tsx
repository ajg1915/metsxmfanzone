import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, RefreshCw, Shield, Lock, Key } from "lucide-react";
import { withTimeout } from "@/utils/asyncTimeout";

interface AdminPinVerificationProps {
  userId: string;
  onVerified: () => void;
  onCancel: () => void;
}

export function AdminPinVerification({ userId, onVerified, onCancel }: AdminPinVerificationProps) {
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [isSetupMode, setIsSetupMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<Date | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [pinCheckError, setPinCheckError] = useState(false);

  const { toast } = useToast();

  const MAX_ATTEMPTS = 5;
  const LOCKOUT_MINUTES = 15;

  useEffect(() => {
    checkExistingPin();
  }, [userId]);

  useEffect(() => {
    // Check lockout from sessionStorage
    const lockout = sessionStorage.getItem("admin_lockout");
    if (lockout) {
      const lockoutTime = new Date(lockout);
      if (lockoutTime > new Date()) {
        setLockoutUntil(lockoutTime);
      } else {
        sessionStorage.removeItem("admin_lockout");
        sessionStorage.removeItem("admin_attempts");
      }
    }
    const storedAttempts = sessionStorage.getItem("admin_attempts");
    if (storedAttempts) {
      setAttempts(parseInt(storedAttempts, 10));
    }
  }, []);

  const checkExistingPin = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setSignedOut(true);
        setLoading(false);
        return;
      }
      setSignedOut(false);

      const response = await withTimeout(
        supabase.functions.invoke('admin-pin-verify', {
          body: { action: 'check' }
        }),
        7000,
        "Admin PIN check timed out"
      );

      if (response.error) {
        console.error("Error checking PIN:", response.error);
        const { data } = await withTimeout(
          supabase
            .from("admin_verification_codes")
            .select("id")
            .eq("user_id", userId)
            .maybeSingle(),
          5000,
          "Fallback PIN check timed out"
        );
        setIsSetupMode(!data);
      } else {
        setIsSetupMode(!response.data.hasPin);
      }
      setPinCheckError(false);
    } catch (err) {
      console.error("Error:", err);
      setPinCheckError(true);
    } finally {
      setLoading(false);
    }
  };

  // Escape hatch: wipes the local lockout counters and the (possibly broken)
  // Supabase session so a stuck admin can sign in cleanly again.
  const handleResetSession = async () => {
    sessionStorage.removeItem("admin_attempts");
    sessionStorage.removeItem("admin_lockout");
    sessionStorage.removeItem("admin_verified");
    sessionStorage.removeItem("admin_verified_at");
    setAttempts(0);
    setLockoutUntil(null);
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch { /* already signed out */ }
    window.location.href = "/auth?mode=login";
  };


  const handleSetupPin = async () => {
    if (pin.length < 4) {
      toast({
        title: "PIN too short",
        description: "PIN must be at least 4 digits",
        variant: "destructive",
      });
      return;
    }

    if (pin !== confirmPin) {
      toast({
        title: "PINs don't match",
        description: "Please make sure both PINs match",
        variant: "destructive",
      });
      return;
    }

    setVerifying(true);
    try {
      const response = await withTimeout(
        supabase.functions.invoke('admin-pin-verify', {
          body: { action: 'setup', pin }
        }),
        10000,
        "Admin PIN setup timed out"
      );

      if (response.error) throw response.error;
      if (response.data.error) throw new Error(response.data.error);

      toast({
        title: "PIN Created",
        description: "Your admin verification PIN has been set up securely",
      });

      // Store verification in session
      sessionStorage.setItem("admin_verified", "true");
      sessionStorage.setItem("admin_verified_at", new Date().toISOString());
      onVerified();
    } catch (err) {
      console.error("Error setting up PIN:", err);
      toast({
        title: "Setup Failed",
        description: "Failed to set up PIN. Please try again.",
        variant: "destructive",
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleVerifyPin = async () => {
    if (lockoutUntil && lockoutUntil > new Date()) {
      const remaining = Math.ceil((lockoutUntil.getTime() - Date.now()) / 60000);
      toast({
        title: "Account Locked",
        description: `Too many failed attempts. Try again in ${remaining} minutes.`,
        variant: "destructive",
      });
      return;
    }

    setVerifying(true);
    try {
      const response = await withTimeout(
        supabase.functions.invoke('admin-pin-verify', {
          body: { action: 'verify', pin }
        }),
        10000,
        "Admin PIN verification timed out"
      );

      if (response.error) throw response.error;

      if (response.data.valid) {
        // Success - clear attempts and verify
        sessionStorage.removeItem("admin_attempts");
        sessionStorage.removeItem("admin_lockout");
        sessionStorage.setItem("admin_verified", "true");
        sessionStorage.setItem("admin_verified_at", new Date().toISOString());
        
        toast({
          title: "Verified",
          description: "Admin access granted",
        });
        onVerified();
      } else {
        // Failed attempt
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        sessionStorage.setItem("admin_attempts", newAttempts.toString());

        if (newAttempts >= MAX_ATTEMPTS) {
          const lockout = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
          setLockoutUntil(lockout);
          sessionStorage.setItem("admin_lockout", lockout.toISOString());
          
          toast({
            title: "Account Locked",
            description: `Too many failed attempts. Locked for ${LOCKOUT_MINUTES} minutes.`,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Incorrect PIN",
            description: `${MAX_ATTEMPTS - newAttempts} attempts remaining`,
            variant: "destructive",
          });
        }
        setPin("");
      }
    } catch (err) {
      console.error("Error verifying PIN:", err);
      toast({
        title: "Verification Failed",
        description: "An error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleResetPin = async () => {
    setResetting(true);
    try {
      // Delete the existing PIN
      const { error } = await supabase
        .from("admin_verification_codes")
        .delete()
        .eq("user_id", userId);

      if (error) throw error;

      // Clear lockout state
      sessionStorage.removeItem("admin_attempts");
      sessionStorage.removeItem("admin_lockout");
      setAttempts(0);
      setLockoutUntil(null);

      // Switch to setup mode
      setIsSetupMode(true);
      setShowResetConfirm(false);
      setPin("");
      setConfirmPin("");

      toast({
        title: "PIN Reset",
        description: "Please set up a new PIN to continue.",
      });
    } catch (err) {
      console.error("Error resetting PIN:", err);
      toast({
        title: "Reset Failed",
        description: "Failed to reset PIN. Please try again.",
        variant: "destructive",
      });
    } finally {
      setResetting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md bg-card/90 backdrop-blur-xl">
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <RefreshCw className="h-8 w-8 animate-spin text-primary" />
            <div>
              <p className="text-sm font-medium text-foreground">Loading secure PIN</p>
              <p className="text-xs text-muted-foreground">Checking your admin session...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (pinCheckError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle className="text-xl">PIN Check Failed</CardTitle>
            <CardDescription>
              The secure PIN check did not finish. Refresh the session or sign in again to continue.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full" onClick={() => { setLoading(true); setPinCheckError(false); checkExistingPin(); }}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
            <Button variant="outline" className="w-full" onClick={handleResetSession}>
              Clear Session & Sign In Again
            </Button>
            <Button variant="ghost" className="w-full" onClick={onCancel}>
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (signedOut) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <Lock className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle className="text-xl">Session Expired</CardTitle>
            <CardDescription>
              Your login session is no longer valid, so the PIN screen can't verify you. Sign in
              again to continue to the admin panel.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full" onClick={handleResetSession}>
              Sign In Again
            </Button>
            <Button variant="outline" className="w-full" onClick={onCancel}>
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isLockedOut = lockoutUntil && lockoutUntil > new Date();
  const remainingLockoutMinutes = lockoutUntil
    ? Math.ceil((lockoutUntil.getTime() - Date.now()) / 60000)
    : 0;


  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-xl">
            {isSetupMode ? "Set Up Admin PIN" : showResetConfirm ? "Reset PIN" : "Admin Verification"}
          </CardTitle>
          <CardDescription>
            {isSetupMode 
              ? "Create a secure PIN that only you know to access admin features"
              : showResetConfirm
              ? "Are you sure you want to reset your PIN?"
              : "Enter your secret PIN to access the admin panel"
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {showResetConfirm ? (
            <div className="space-y-4">
              <div className="text-center py-4">
                <Key className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground">
                  This will delete your current PIN and allow you to set up a new one.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowResetConfirm(false)}
                  className="flex-1"
                  disabled={resetting}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleResetPin}
                  className="flex-1"
                  disabled={resetting}
                >
                  {resetting ? "Resetting..." : "Reset PIN"}
                </Button>
              </div>
            </div>
          ) : isLockedOut ? (
            <div className="text-center py-8">
              <Lock className="h-12 w-12 mx-auto text-destructive mb-4" />
              <p className="text-destructive font-medium">Account Temporarily Locked</p>
              <p className="text-sm text-muted-foreground mt-2">
                Too many failed attempts. Please wait{" "}
                {remainingLockoutMinutes} minutes.
              </p>
              <Button
                variant="link"
                onClick={() => setShowResetConfirm(true)}
                className="mt-4 text-primary"
              >
                Forgot PIN? Reset it
              </Button>
              <Button
                variant="outline"
                onClick={handleResetSession}
                className="w-full mt-2"
              >
                Clear Lockout & Sign In Again
              </Button>
            </div>

          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="pin" className="flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  {isSetupMode ? "Create PIN (4–8 digits)" : "Enter PIN"}
                </Label>
                <Input
                  id="pin"
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="••••••"
                  className="text-center text-lg tracking-widest"
                  maxLength={8}
                  autoComplete="off"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !isSetupMode) {
                      handleVerifyPin();
                    }
                  }}
                />
              </div>

              {isSetupMode && (
                <div className="space-y-2">
                  <Label htmlFor="confirmPin">Confirm PIN</Label>
                  <Input
                    id="confirmPin"
                    type="password"
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value)}
                    placeholder="••••••"
                    className="text-center text-lg tracking-widest"
                  maxLength={8}
                    autoComplete="off"
                  />
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={onCancel}
                  className="flex-1"
                  disabled={verifying}
                >
                  Cancel
                </Button>
                <Button
                  onClick={isSetupMode ? handleSetupPin : handleVerifyPin}
                  className="flex-1"
                  disabled={verifying || pin.length < 4}
                >
                  {verifying ? "Verifying..." : isSetupMode ? "Set PIN" : "Verify"}
                </Button>
              </div>

              {!isSetupMode && (
                <div className="text-center">
                  {attempts > 0 && (
                    <p className="text-xs text-muted-foreground mb-2">
                      {MAX_ATTEMPTS - attempts} attempts remaining before lockout
                    </p>
                  )}
                  <Button
                    variant="link"
                    onClick={() => setShowResetConfirm(true)}
                    className="text-xs text-muted-foreground hover:text-primary"
                  >
                    Forgot PIN?
                  </Button>
                </div>
              )}
            </>
          )}

          <p className="text-xs text-center text-muted-foreground pt-4 border-t">
            PIN verification is performed securely on the server.
            {isSetupMode && " Remember your PIN carefully."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
