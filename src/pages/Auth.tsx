import { useCallback, useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, Loader2, LockKeyhole, Mail, RefreshCw, ShieldCheck, UserRound } from "lucide-react";
import { z } from "zod";
import AuthBackground from "@/components/AuthBackground";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { withTimeout } from "@/utils/asyncTimeout";
import { isStaleBuildAuthError, recoverFromStaleBuild } from "@/utils/staleBuildRecovery";
import { trackFailedLogin } from "@/utils/securityAlerts";
import authLogo from "@/assets/metsxmfanzone-logo-auth.png";

const phoneRegex = /^(\+1)?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/;
const SIGNUP_DRAFT_KEY = "metsxm_signup_draft";
const REMEMBER_ME_KEY = "metsxm_remember_user";
const REMEMBER_ME_EXPIRY_HOURS = 720;

const disposableEmailDomains = new Set([
  "tempmail.com", "temp-mail.org", "guerrillamail.com", "mailinator.com", "maildrop.cc",
  "10minutemail.com", "throwaway.email", "fakeinbox.com", "trashmail.com", "yopmail.com",
]);

const emailTypos: Record<string, string> = {
  "gmial.com": "gmail.com", "gmal.com": "gmail.com", "gmai.com": "gmail.com",
  "gmail.co": "gmail.com", "gamil.com": "gmail.com", "hotmal.com": "hotmail.com",
  "outloo.com": "outlook.com", "outlok.com": "outlook.com", "yaho.com": "yahoo.com",
  "iclod.com": "icloud.com",
};

const accountSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(100),
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(6, "Use at least 6 characters"),
});

const contactSchema = z.object({
  phoneNumber: z.string().trim().refine((value) => phoneRegex.test(value), "Enter a valid phone number"),
  agreeToTerms: z.literal(true, { errorMap: () => ({ message: "Agree to the Terms and Privacy Policy to continue" }) }),
});

const Auth = () => {
  const { user, loading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const mode = searchParams.get("mode") || "login";
  const isSignup = mode === "signup";
  const isRecovery = mode === "reset";

  const [forgotPassword, setForgotPassword] = useState(false);
  const [signupStep, setSignupStep] = useState(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [smsOptIn, setSmsOptIn] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [loginAgreeToTerms, setLoginAgreeToTerms] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actionTakingTooLong, setActionTakingTooLong] = useState(false);
  const [honeypot, setHoneypot] = useState("");

  useEffect(() => {
    if (!isSignup) return;
    try {
      const draft = JSON.parse(localStorage.getItem(SIGNUP_DRAFT_KEY) || "null");
      if (!draft) return;
      setFullName(typeof draft.fullName === "string" ? draft.fullName : "");
      setEmail(typeof draft.email === "string" ? draft.email : "");
      setPhoneNumber(typeof draft.phoneNumber === "string" ? draft.phoneNumber : "");
      setSmsOptIn(draft.smsOptIn === true);
      setAgreeToTerms(draft.agreeToTerms === true);
      setSignupStep(draft.signupStep === 2 ? 2 : 1);
    } catch {
      localStorage.removeItem(SIGNUP_DRAFT_KEY);
    }
  }, [isSignup]);

  useEffect(() => {
    if (!isSignup) return;
    localStorage.setItem(SIGNUP_DRAFT_KEY, JSON.stringify({ fullName, email, phoneNumber, smsOptIn, agreeToTerms, signupStep }));
  }, [agreeToTerms, email, fullName, isSignup, phoneNumber, signupStep, smsOptIn]);

  useEffect(() => {
    if (isSignup || isRecovery) return;
    try {
      const remembered = JSON.parse(localStorage.getItem(REMEMBER_ME_KEY) || "null");
      if (remembered?.email && remembered?.expiresAt > Date.now()) {
        setEmail(remembered.email);
        setRememberMe(true);
      } else if (remembered) {
        localStorage.removeItem(REMEMBER_ME_KEY);
      }
    } catch {
      localStorage.removeItem(REMEMBER_ME_KEY);
    }
  }, [isRecovery, isSignup]);

  useEffect(() => {
    if (!loading && !authLoading) {
      setActionTakingTooLong(false);
      return;
    }
    const timer = window.setTimeout(() => setActionTakingTooLong(true), 9000);
    return () => window.clearTimeout(timer);
  }, [authLoading, loading]);

  useEffect(() => {
    if (authLoading || !user || isRecovery) return;
    const redirectSignedInMember = async () => {
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      if (roles?.some((entry) => entry.role === "admin")) {
        navigate("/admin", { replace: true });
        return;
      }
      if (roles?.some((entry) => entry.role === "writer")) {
        navigate("/writer", { replace: true });
        return;
      }
      const { data: subscriptions } = await supabase.rpc("get_user_subscription_safe", { p_user_id: user.id });
      const hasPlan = subscriptions?.some((subscription) =>
        subscription.status === "active" && ["free", "trial", "weekly", "premium", "annual"].includes(subscription.plan_type)
      );
      navigate(hasPlan ? "/dashboard" : "/pricing?required=true", { replace: true });
    };
    void redirectSignedInMember();
  }, [authLoading, isRecovery, navigate, user]);

  const clearStuckLoginState = useCallback(async () => {
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith("sb-") || key === "supabase.auth.token") localStorage.removeItem(key);
    });
    await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    setLoading(false);
    navigate("/auth?mode=login", { replace: true });
  }, [navigate]);

  const validateEmail = (value: string) => {
    const normalized = value.trim().toLowerCase();
    const domain = normalized.split("@")[1];
    if (!domain || disposableEmailDomains.has(domain)) throw new Error("Use a permanent email address");
    if (emailTypos[domain]) throw new Error(`Check your email address. Did you mean @${emailTypos[domain]}?`);
    return normalized;
  };

  const continueSignup = () => {
    try {
      const account = accountSchema.parse({ fullName, email, password });
      validateEmail(account.email);
      setSignupStep(2);
    } catch (error) {
      const message = error instanceof z.ZodError ? error.errors[0]?.message : error instanceof Error ? error.message : "Check your details";
      toast({ title: "Check your details", description: message, variant: "destructive" });
    }
  };

  const handleSignup = async (event: React.FormEvent) => {
    event.preventDefault();
    if (honeypot) return;
    try {
      const account = accountSchema.parse({ fullName, email, password });
      const contact = contactSchema.parse({ phoneNumber, agreeToTerms: agreeToTerms as true });
      const normalizedEmail = validateEmail(account.email);
      setLoading(true);
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password: account.password,
        options: {
          emailRedirectTo: `${window.location.origin}/confirm-account`,
          data: {
            full_name: account.fullName.trim(),
            phone_number: contact.phoneNumber.trim(),
            sms_notifications_enabled: smsOptIn,
            preferred_payment_method: "paypal",
          },
        },
      });
      if (error) throw error;
      if (!data.user) throw new Error("Account could not be created");

      await supabase.functions.invoke("send-email-confirmation", {
        body: { email: normalizedEmail, name: account.fullName.trim(), userId: data.user.id },
      }).catch(() => undefined);

      localStorage.removeItem(SIGNUP_DRAFT_KEY);
      localStorage.setItem("pending_membership_selection", "true");
      toast({ title: "Account created", description: "Confirm your email, then choose your membership." });
      navigate(`/confirm-account?email=${encodeURIComponent(normalizedEmail)}`);
    } catch (error) {
      const message = error instanceof z.ZodError
        ? error.errors[0]?.message
        : error instanceof Error && error.message.toLowerCase().includes("already registered")
          ? "This email already has an account. Sign in instead."
          : error instanceof Error ? error.message : "Please try again.";
      toast({ title: "Account could not be created", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (honeypot) return;
    if (!loginAgreeToTerms) {
      toast({ title: "Agreement required", description: "Please agree to the Terms and Privacy Policy to sign in.", variant: "destructive" });
      return;
    }
    try {
      const validated = { email: z.string().email().parse(email), password: z.string().min(6).parse(password) };
      setLoading(true);
      const signIn = () => withTimeout(supabase.auth.signInWithPassword(validated), 12000, "Email login timed out");
      let { data, error } = await signIn();
      if (error?.message.toLowerCase().includes("refresh token")) {
        await supabase.auth.signOut({ scope: "local" });
        ({ data, error } = await signIn());
      }
      if (error) {
        trackFailedLogin(validated.email);
        if (isStaleBuildAuthError(error.message)) {
          toast({ title: "Updating app", description: "Refreshing the latest version. Sign in again in a moment." });
          await recoverFromStaleBuild();
          return;
        }
        throw new Error("The email or password is incorrect.");
      }
      if (!data.user?.email_confirmed_at && !data.user?.confirmed_at) {
        await supabase.auth.signOut();
        navigate(`/confirm-account?email=${encodeURIComponent(validated.email.toLowerCase())}`);
        return;
      }
      if (rememberMe) {
        localStorage.setItem(REMEMBER_ME_KEY, JSON.stringify({ email: validated.email, expiresAt: Date.now() + REMEMBER_ME_EXPIRY_HOURS * 60 * 60 * 1000 }));
      } else {
        localStorage.removeItem(REMEMBER_ME_KEY);
      }
      void supabase.functions.invoke("member-auth-activity", { body: { eventType: "login" } });
      toast({ title: "Welcome back", description: "You are signed in." });
    } catch (error) {
      const message = error instanceof z.ZodError ? "Enter a valid email and password." : error instanceof Error ? error.message : "Please try again.";
      toast({ title: "Sign in failed", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const normalizedEmail = z.string().email("Enter a valid email address").parse(email.trim());
      setLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, { redirectTo: `${window.location.origin}/auth?mode=reset` });
      if (error) throw error;
      toast({ title: "Check your email", description: "We sent your password reset link." });
    } catch {
      toast({ title: "Reset link could not be sent", description: "Check the email address and try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 6 || password !== confirmPassword) {
      toast({ title: "Check your password", description: password.length < 6 ? "Use at least 6 characters." : "The passwords do not match.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast({ title: "Password could not be updated", description: "Request a new reset link and try again.", variant: "destructive" });
      return;
    }
    await supabase.auth.signOut();
    toast({ title: "Password updated", description: "Sign in with your new password." });
    navigate("/auth?mode=login", { replace: true });
  };

  const title = isRecovery ? "Set a new password" : forgotPassword ? "Reset your password" : isSignup ? "Create your account" : "Welcome back";
  const subtitle = isRecovery
    ? "Choose a secure password for your account."
    : forgotPassword ? "We’ll send a secure reset link to your email."
      : isSignup ? "Create your account first. You’ll choose Free, Weekly, Monthly, or Yearly after confirmation."
        : "Sign in to reach your Member Center.";

  return (
    <div className="relative min-h-screen overflow-y-auto bg-background px-3 py-4 sm:px-6 sm:py-8 lg:flex lg:items-center">
      <Helmet>
        <title>{isSignup ? "Create Account" : "Member Sign In"} — MetsXMFanZone</title>
        <meta name="description" content="Create or access your MetsXMFanZone member account." />
        <meta name="robots" content="noindex,follow" />
        <link rel="canonical" href="https://metsxmfanzone.com/auth" />
      </Helmet>
      <AuthBackground />

      <main className="relative z-10 mx-auto grid w-full max-w-5xl overflow-hidden rounded-lg border border-border/50 bg-card/95 shadow-2xl backdrop-blur-xl lg:grid-cols-[0.9fr_1.1fr]">
        <section className="hidden border-r border-border/40 bg-secondary/20 p-8 lg:flex lg:flex-col lg:justify-between">
          <div>
            <img src={authLogo} alt="MetsXMFanZone" className="h-20 w-auto object-contain" />
            <p className="mt-6 text-xs font-semibold uppercase text-primary">Member access</p>
            <h1 className="mt-2 text-4xl leading-tight text-foreground">Your Mets home, on every screen.</h1>
            <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">One account keeps your news, community, membership, and streaming access together.</p>
          </div>
          <div className="space-y-3 text-sm">
            {["Free membership available", "Secure PayPal billing for paid plans", "Cancel from your Member Center"].map((item) => (
              <div key={item} className="flex items-center gap-3 border-t border-border/30 pt-3">
                <CheckCircle2 className="h-4 w-4 text-primary" /><span>{item}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="min-w-0 p-4 sm:p-7 lg:p-9">
          <div className="mx-auto max-w-md">
            <div className="mb-5 flex items-center justify-between gap-3 lg:hidden">
              <img src={authLogo} alt="MetsXMFanZone" className="h-12 w-auto object-contain" />
              <span className="text-xs font-semibold text-primary">Member Access</span>
            </div>

            <header className="mb-5">
              <p className="text-xs font-semibold uppercase text-primary">{isSignup ? `Registration · ${signupStep} of 2` : "Secure account access"}</p>
              <h2 className="mt-1 text-3xl text-foreground">{title}</h2>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">{subtitle}</p>
            </header>

            {isSignup && (
              <div className="mb-5 grid grid-cols-2 gap-2" aria-label={`Registration step ${signupStep} of 2`}>
                {["Account", "Contact"].map((label, index) => (
                  <div key={label}>
                    <div className={`h-1 rounded-full ${signupStep >= index + 1 ? "bg-primary" : "bg-muted"}`} />
                    <p className={`mt-1 text-center text-[11px] ${signupStep === index + 1 ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{label}</p>
                  </div>
                ))}
              </div>
            )}

            {actionTakingTooLong && (
              <div className="mb-4 flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
                <div className="flex-1"><p className="font-semibold">This is taking longer than expected.</p><Button type="button" variant="link" className="h-auto p-0 text-xs" onClick={clearStuckLoginState}><RefreshCw className="h-3 w-3" />Reset sign-in</Button></div>
              </div>
            )}

            <form onSubmit={isRecovery ? handleUpdatePassword : forgotPassword ? handleForgotPassword : isSignup ? handleSignup : handleLogin} className="space-y-4">
              <div className="pointer-events-none absolute -left-[9999px]" aria-hidden="true"><Input tabIndex={-1} autoComplete="off" value={honeypot} onChange={(event) => setHoneypot(event.target.value)} /></div>

              {isSignup && signupStep === 1 && (
                <>
                  <div className="space-y-1.5"><Label htmlFor="fullName">Full name</Label><div className="relative"><UserRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input id="fullName" value={fullName} onChange={(event) => setFullName(event.target.value)} className="h-11 pl-10" autoComplete="name" /></div></div>
                  <div className="space-y-1.5"><Label htmlFor="signupEmail">Email</Label><div className="relative"><Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input id="signupEmail" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="h-11 pl-10" autoComplete="email" /></div></div>
                  <div className="space-y-1.5"><Label htmlFor="signupPassword">Password</Label><div className="relative"><LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input id="signupPassword" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} className="h-11 px-10" autoComplete="new-password" /><Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 h-9 w-9 -translate-y-1/2" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff /> : <Eye />}</Button></div><p className="text-[11px] text-muted-foreground">At least 6 characters. Your password is never saved in the form draft.</p></div>
                </>
              )}

              {isSignup && signupStep === 2 && (
                <>
                  <div className="space-y-1.5"><Label htmlFor="phoneNumber">Phone number</Label><Input id="phoneNumber" type="tel" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} placeholder="555-123-4567" className="h-11" autoComplete="tel" /></div>
                  <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border/40 bg-muted/20 p-3"><Checkbox checked={smsOptIn} onCheckedChange={(value) => setSmsOptIn(value === true)} /><span><span className="block text-sm font-semibold">Text alerts</span><span className="block text-xs text-muted-foreground">Optional news and live-stream notifications. Message rates may apply.</span></span></label>
                  <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border/40 bg-muted/20 p-3"><Checkbox checked={agreeToTerms} onCheckedChange={(value) => setAgreeToTerms(value === true)} /><span className="text-xs leading-5 text-muted-foreground">I agree to the <Link to="/terms" target="_blank" className="text-primary hover:underline">Terms</Link> and <Link to="/privacy" target="_blank" className="text-primary hover:underline">Privacy Policy</Link>.</span></label>
                  <div className="flex items-start gap-2 rounded-md bg-secondary/20 p-3 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4 shrink-0 text-primary" /><span>No payment is required now. Choose Free, Weekly, Monthly, or Yearly after confirming your email.</span></div>
                </>
              )}

              {!isSignup && !isRecovery && (
                <div className="space-y-1.5"><Label htmlFor="email">Email</Label><div className="relative"><Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="h-11 pl-10" autoComplete="email" /></div></div>
              )}

              {!isSignup && !forgotPassword && !isRecovery && (
                <div className="space-y-1.5"><div className="flex items-center justify-between"><Label htmlFor="password">Password</Label><Button type="button" variant="link" className="h-auto p-0 text-xs" onClick={() => setForgotPassword(true)}>Forgot password?</Button></div><div className="relative"><LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} className="h-11 px-10" autoComplete="current-password" /><Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 h-9 w-9 -translate-y-1/2" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff /> : <Eye />}</Button></div></div>
              )}

              {isRecovery && (
                <><div className="space-y-1.5"><Label htmlFor="newPassword">New password</Label><Input id="newPassword" type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-11" autoComplete="new-password" /></div><div className="space-y-1.5"><Label htmlFor="confirmPassword">Confirm password</Label><Input id="confirmPassword" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="h-11" autoComplete="new-password" /></div></>
              )}

              {!isSignup && !forgotPassword && !isRecovery && (
                <>
                  <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border/40 bg-muted/20 p-3"><Checkbox checked={loginAgreeToTerms} onCheckedChange={(value) => setLoginAgreeToTerms(value === true)} aria-label="Agree to the Terms and Privacy Policy" /><span className="text-xs leading-5 text-muted-foreground">I agree to the <Link to="/terms" target="_blank" className="text-primary hover:underline">Terms</Link> and <Link to="/privacy" target="_blank" className="text-primary hover:underline">Privacy Policy</Link>. <span className="text-destructive">*</span></span></label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground"><Checkbox checked={rememberMe} onCheckedChange={(value) => setRememberMe(value === true)} />Remember this email for 30 days</label>
                </>
              )}

              {isSignup && signupStep === 1 ? (
                <Button type="button" className="h-11 w-full" onClick={continueSignup}>Continue <ArrowRight /></Button>
              ) : isSignup ? (
                <div className="grid grid-cols-2 gap-2"><Button type="button" variant="outline" className="h-11" onClick={() => setSignupStep(1)}><ArrowLeft />Back</Button><Button type="submit" className="h-11" disabled={loading || !agreeToTerms}>{loading ? <Loader2 className="animate-spin" /> : "Create account"}</Button></div>
              ) : (
                <Button type="submit" className="h-11 w-full" disabled={loading || (!isRecovery && !forgotPassword && !loginAgreeToTerms)}>{loading ? <Loader2 className="animate-spin" /> : isRecovery ? "Update password" : forgotPassword ? "Send reset link" : "Sign in"}</Button>
              )}
            </form>

            <div className="mt-5 border-t border-border/30 pt-4 text-center text-sm">
              {forgotPassword ? <Button variant="link" onClick={() => setForgotPassword(false)}>Back to sign in</Button> : !isRecovery && <Button variant="link" asChild><Link to={isSignup ? "/auth?mode=login" : "/auth?mode=signup"}>{isSignup ? "Already have an account? Sign in" : "New member? Create an account"}</Link></Button>}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Auth;
