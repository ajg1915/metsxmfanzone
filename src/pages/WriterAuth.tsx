import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { invokeEmailFunction } from "@/lib/emailFallback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { Shield, ArrowLeft, PenLine, KeyRound } from "lucide-react";
import AuthBackground from "@/components/AuthBackground";
import authLogo from "@/assets/metsxmfanzone-logo-auth.png";

const newPasswordSchema = z
  .object({
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string().min(6, "Password must be at least 6 characters"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const MIN_FORM_FILL_TIME_MS = 3000;

const detectBot = (): { isBot: boolean; reason?: string } => {
  const navigatorAny = navigator as any;

  if (navigatorAny.webdriver) {
    return { isBot: true, reason: "Automated browser detected" };
  }

  if (!window.requestAnimationFrame || !window.cancelAnimationFrame) {
    return { isBot: true, reason: "Missing browser features" };
  }

  if (window.hasOwnProperty("_phantom") || window.hasOwnProperty("callPhantom")) {
    return { isBot: true, reason: "Headless browser detected" };
  }

  if (window.screen.width === 0 || window.screen.height === 0) {
    return { isBot: true, reason: "Invalid screen dimensions" };
  }

  const languages = navigator.languages;
  if (!languages || languages.length === 0) {
    return { isBot: true, reason: "Missing language settings" };
  }

  return { isBot: false };
};

const getIsPasswordRecoveryMode = () => {
  if (typeof window === "undefined") return false;

  // Support both query-string and hash-based recovery flows
  const searchParams = new URLSearchParams(window.location.search);
  if (searchParams.get("mode") === "reset" || searchParams.get("type") === "recovery") {
    return true;
  }

  const hash = window.location.hash?.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  const hashParams = new URLSearchParams(hash);
  return hashParams.get("type") === "recovery";
};

const WriterAuth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Password reset mode (initialize immediately to avoid redirect "bounce")
  const [isResettingPassword, setIsResettingPassword] = useState(() => getIsPasswordRecoveryMode());

  // 2FA states
  const [show2FA, setShow2FA] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [generatedOtp, setGeneratedOtp] = useState("");
  const [otpExpiry, setOtpExpiry] = useState<Date | null>(null);
  const [pendingUserData, setPendingUserData] = useState<{ userId: string } | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Forgot password states
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [forgotPasswordSent, setForgotPasswordSent] = useState(false);

  // Bot detection states
  const [honeypot, setHoneypot] = useState("");
  const [formLoadTime] = useState(() => Date.now());

  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Don't auto-redirect on existing session - 2FA is mandatory for every login
    // Users must enter credentials + OTP each time
    if (!isResettingPassword) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session && !show2FA) {
          // Sign out existing session to force fresh login with 2FA
          supabase.auth.signOut();
        }
      });
    }
  }, [isResettingPassword]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const checkWriterRole = async (userId: string) => {
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    
    const userRoles = roles?.map(r => r.role) || [];
    
    if (userRoles.includes("writer") || userRoles.includes("admin")) {
      navigate("/writer");
    } else {
      toast({
        title: "Access Denied",
        description: "You don't have writer access. Please contact an administrator.",
        variant: "destructive",
      });
      await supabase.auth.signOut();
    }
  };

  const generateOtp = () => {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 5 * 60 * 1000);
    return { otp, expiry };
  };

  const sendOtpEmail = async (userEmail: string, otp: string) => {
    try {
      // Falls back to /api/send-email on Vercel if the edge function fails.
      const data = await invokeEmailFunction<{ success?: boolean } | undefined>(
        "send-otp-email",
        { to: userEmail, otp },
        {
          to: userEmail,
          subject: "Your MetsXMFanZone verification code",
          html: `<div style="background:#0a0a0a;padding:32px;font-family:Arial,Helvetica,sans-serif;color:#d1d5db;">
            <h1 style="color:#ffffff;font-size:20px;margin:0 0 16px;">Your verification code</h1>
            <p style="margin:0 0 16px;">Use this code to finish signing in. It expires in 5 minutes.</p>
            <p style="font-size:32px;letter-spacing:8px;color:#FF5910;font-weight:700;margin:0 0 16px;">${otp}</p>
            <p style="font-size:12px;color:#8b93a1;margin:0;">If you did not request this, you can ignore this email.</p>
          </div>`,
          text: `Your MetsXMFanZone verification code is ${otp}. It expires in 5 minutes.`,
        },
      );

      if (data && data.success === false) {
        console.error("OTP email function returned failure");
        return false;
      }

      return true;
    } catch (err) {
      console.error("Error sending OTP:", err);
      return false;
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (honeypot) {
      toast({
        title: "Login failed",
        description: "Unable to process your request. Please try again.",
        variant: "destructive",
      });
      return;
    }
    
    const fillTime = Date.now() - formLoadTime;
    if (fillTime < MIN_FORM_FILL_TIME_MS) {
      toast({
        title: "Please slow down",
        description: "Please take your time filling out the form.",
        variant: "destructive",
      });
      return;
    }
    
    const botCheck = detectBot();
    if (botCheck.isBot) {
      toast({
        title: "Login failed",
        description: "Unable to verify your browser. Please try a different browser.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      const validated = loginSchema.parse({ email, password });
      setLoading(true);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: validated.email,
        password: validated.password,
      });

      if (error) {
        toast({
          title: "Login failed",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      if (data.user) {
        // Check if user has writer role before proceeding
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", data.user.id);
        
        const userRoles = roles?.map(r => r.role) || [];
        
        if (!userRoles.includes("writer") && !userRoles.includes("admin")) {
          await supabase.auth.signOut();
          toast({
            title: "Access Denied",
            description: "This portal is only for writers. Please use the main sign-in page.",
            variant: "destructive",
          });
          return;
        }

        // Generate and send OTP for 2FA
        const { otp, expiry } = generateOtp();
        setGeneratedOtp(otp);
        setOtpExpiry(expiry);
        setPendingUserData({ userId: data.user.id });

        const emailSent = await sendOtpEmail(validated.email, otp);
        
        if (emailSent) {
          setShow2FA(true);
          setResendCooldown(60);
          toast({
            title: "Verification code sent",
            description: "Please check your email for the 6-digit code.",
          });
        } else {
          // If email fails, sign out and show error - 2FA is mandatory
          await supabase.auth.signOut();
          toast({
            title: "Verification Failed",
            description: "Could not send verification code. Please try again.",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation error",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Login failed",
          description: "An unexpected error occurred. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6) {
      toast({
        title: "Invalid code",
        description: "Please enter the 6-digit code.",
        variant: "destructive",
      });
      return;
    }

    if (otpExpiry && new Date() > otpExpiry) {
      toast({
        title: "Code expired",
        description: "Your verification code has expired. Please request a new one.",
        variant: "destructive",
      });
      return;
    }

    if (otpCode !== generatedOtp) {
      toast({
        title: "Incorrect code",
        description: "The code you entered is incorrect. Please try again.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      toast({
        title: "Welcome to Writer Portal!",
        description: "Successfully verified. Redirecting...",
      });
      navigate("/writer");
    } catch (error) {
      console.error("Verification error:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    
    const { otp, expiry } = generateOtp();
    setGeneratedOtp(otp);
    setOtpExpiry(expiry);
    setOtpCode("");
    
    const emailSent = await sendOtpEmail(email, otp);
    
    if (emailSent) {
      setResendCooldown(60);
      toast({
        title: "Code resent",
        description: "A new verification code has been sent to your email.",
      });
    } else {
      toast({
        title: "Failed to resend",
        description: "Could not send verification code. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleBack2FA = async () => {
    // Sign out user - 2FA is mandatory, can't go back without completing it
    await supabase.auth.signOut();
    setShow2FA(false);
    setOtpCode("");
    setGeneratedOtp("");
    setOtpExpiry(null);
    setPendingUserData(null);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!forgotPasswordEmail) {
      toast({
        title: "Email required",
        description: "Please enter your email address.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotPasswordEmail, {
        redirectTo: `${window.location.origin}/writer-auth?mode=reset`,
      });

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      setForgotPasswordSent(true);
      toast({
        title: "Check your email",
        description: "Password reset instructions have been sent to your email.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBackFromForgotPassword = () => {
    setShowForgotPassword(false);
    setForgotPasswordEmail("");
    setForgotPasswordSent(false);
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const validated = newPasswordSchema.parse({ password, confirmPassword });
      setLoading(true);

      const { error } = await supabase.auth.updateUser({
        password: validated.password,
      });

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Password updated!",
        description: "Your password has been successfully reset. You can now login.",
      });
      
      setIsResettingPassword(false);
      setPassword("");
      setConfirmPassword("");
      // Clear the hash from URL
      window.history.replaceState(null, '', window.location.pathname);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation error",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "An unexpected error occurred. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // Password Reset Screen (when coming from email link)
  if (isResettingPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative">
        <AuthBackground />
        <Card className="w-full max-w-md bg-card/80 backdrop-blur-xl border-border/50 shadow-2xl">
          <CardHeader className="space-y-1">
            <div className="flex flex-col items-center gap-3 mb-4">
              <img 
                src={authLogo} 
                alt="MetsXMFanZone" 
                className="h-16 sm:h-20 w-auto object-contain"
              />
              <div className="flex items-center gap-2">
                <PenLine className="h-5 w-5 text-[#FF5910]" />
                <span className="text-lg font-bold text-[#FF5910]">Writer Portal</span>
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 mb-2">
              <KeyRound className="h-5 w-5 text-primary" />
              <CardTitle className="text-xl font-bold">Set New Password</CardTitle>
            </div>
            <CardDescription className="text-center">
              Enter your new password below
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Updating..." : "Update Password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Forgot Password Screen
  if (showForgotPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative">
        <AuthBackground />
        <Card className="w-full max-w-md bg-card/80 backdrop-blur-xl border-border/50 shadow-2xl">
          <CardHeader className="space-y-1">
            <div className="flex flex-col items-center gap-3 mb-4">
              <img 
                src={authLogo} 
                alt="MetsXMFanZone" 
                className="h-16 sm:h-20 w-auto object-contain"
              />
              <div className="flex items-center gap-2">
                <PenLine className="h-5 w-5 text-[#FF5910]" />
                <span className="text-lg font-bold text-[#FF5910]">Writer Portal</span>
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 mb-2">
              <KeyRound className="h-5 w-5 text-primary" />
              <CardTitle className="text-xl font-bold">Reset Password</CardTitle>
            </div>
            <CardDescription className="text-center">
              {forgotPasswordSent 
                ? "Check your email for reset instructions" 
                : "Enter your email to receive password reset instructions"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {forgotPasswordSent ? (
              <div className="text-center space-y-4">
                <div className="p-4 bg-primary/10 rounded-lg">
                  <p className="text-sm text-foreground">
                    We've sent password reset instructions to <span className="font-medium">{forgotPasswordEmail}</span>. 
                    Please check your inbox and follow the link to reset your password.
                  </p>
                </div>
                <Button 
                  onClick={handleBackFromForgotPassword} 
                  variant="outline" 
                  className="w-full"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to login
                </Button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="forgot-email">Email</Label>
                  <Input
                    id="forgot-email"
                    type="email"
                    placeholder="writer@mets.com"
                    value={forgotPasswordEmail}
                    onChange={(e) => setForgotPasswordEmail(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Sending..." : "Send Reset Instructions"}
                </Button>

                <button
                  type="button"
                  onClick={handleBackFromForgotPassword}
                  className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mx-auto"
                  disabled={loading}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to login
                </button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // 2FA Verification Screen
  if (show2FA) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative">
        <AuthBackground />
        <Card className="w-full max-w-md bg-card/80 backdrop-blur-xl border-border/50 shadow-2xl">
          <CardHeader className="space-y-1">
            <div className="flex flex-col items-center gap-3 mb-4">
              <img 
                src={authLogo} 
                alt="MetsXMFanZone" 
                className="h-16 sm:h-20 w-auto object-contain"
              />
              <div className="flex items-center gap-2">
                <PenLine className="h-5 w-5 text-[#FF5910]" />
                <span className="text-lg font-bold text-[#FF5910]">Writer Portal</span>
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 mb-2">
              <Shield className="h-5 w-5 text-primary" />
              <CardTitle className="text-xl font-bold">Two-Factor Authentication</CardTitle>
            </div>
            <CardDescription className="text-center">
              Enter the 6-digit code sent to <span className="font-medium text-foreground">{email}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={otpCode}
                onChange={setOtpCode}
                disabled={loading}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>

            <Button 
              onClick={handleVerifyOtp} 
              className="w-full" 
              disabled={loading || otpCode.length !== 6}
            >
              {loading ? "Verifying..." : "Verify Code"}
            </Button>

            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                Didn't receive the code?{" "}
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0 || loading}
                  className="text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
                </button>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <AuthBackground />
      <Card className="w-full max-w-md bg-card/80 backdrop-blur-xl border-border/50 shadow-2xl">
        <CardHeader className="space-y-1">
          <div className="flex flex-col items-center gap-2 sm:gap-3 mb-4">
            <img 
              src={authLogo} 
              alt="MetsXMFanZone" 
              className="h-16 sm:h-20 w-auto object-contain"
            />
            <div className="flex items-center gap-2">
              <PenLine className="h-4 w-4 sm:h-5 sm:w-5 text-[#FF5910]" />
              <span className="text-base sm:text-lg font-bold text-[#FF5910]">Writer Portal</span>
            </div>
          </div>
          <CardTitle className="text-xl sm:text-2xl font-bold text-center">Writer Sign In</CardTitle>
          <CardDescription className="text-center text-sm">
            Access your writer dashboard to create and manage articles
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="writer@mets.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            {/* Honeypot field */}
            <div className="absolute -left-[9999px] -top-[9999px]" aria-hidden="true">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                name="website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="text-sm text-primary hover:underline"
              >
                Forgot password?
              </button>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign In to Writer Portal"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm space-y-3">
            <p className="text-muted-foreground">
              Want to become a writer?{" "}
              <Link to="/writer-register" className="text-primary hover:underline font-medium">
                Apply here
              </Link>
            </p>
            <p className="text-muted-foreground">
              Not a writer?{" "}
              <Link to="/auth" className="text-primary hover:underline">
                Sign in as a fan
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WriterAuth;
