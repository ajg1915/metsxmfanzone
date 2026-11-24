import { useCallback, useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, Loader2, LockKeyhole, Mail, Phone, RefreshCw, ShieldCheck, UserRound } from "lucide-react";
import { z } from "zod";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { withTimeout } from "@/utils/asyncTimeout";
import { isStaleBuildAuthError, recoverFromStaleBuild } from "@/utils/staleBuildRecovery";
import { trackFailedLogin } from "@/utils/securityAlerts";
import { useBackgroundSettings } from "@/hooks/useBackgroundSettings";
import authLogo from "@/assets/metsxmfanzone-logo-auth.png";
import heroStadium from "@/assets/auth-citi-field.jpg";

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
  const { data: modeArtwork } = useBackgroundSettings(isSignup ? "auth_signup" : "auth_login");
  const { data: sharedArtwork } = useBackgroundSettings("auth");
  const authArtwork = modeArtwork ?? sharedArtwork;
  // Admin-chosen artwork (Background settings) wins; otherwise the stadium photo.
  const heroImage = authArtwork?.background_type === "image"
    ? authArtwork.background_value.trim().replace(/^url\((['"]?)(.*)\1\)$/, "$2")
    : heroStadium;

  const [forgotPassword, setForgotPassword] = useState(false);
  const [signupStep, setSignupStep] = useState(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [smsOptIn, setSmsOptIn] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
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
    const emailFromLink = searchParams.get("email");
    if (emailFromLink) {
      setEmail(emailFromLink.trim().toLowerCase());
      return;
    }
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

  // Reset links now point at metsxmfanzone.com/auth?mode=reset&token_hash=…
  // We verify the one-time code here (only when the member actually opens the
  // page), which also stops email link-scanners from using up the link.
  const [verifyingReset, setVerifyingReset] = useState(false);
  useEffect(() => {
    const tokenHash = searchParams.get("token_hash");
    if (!isRecovery || !tokenHash) return;
    let cancelled = false;
    setVerifyingReset(true);
    void supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" }).then(({ error }) => {
      if (cancelled) return;
      setVerifyingReset(false);
      if (error) {
        toast({ title: "This reset link has expired", description: "Request a new link below — only the newest email works.", variant: "destructive" });
        setForgotPassword(true);
        navigate("/auth?mode=login", { replace: true });
        return;
      }
      window.history.replaceState(null, "", "/auth?mode=reset");
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecovery, searchParams]);

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
        subscription.status === "active" && ["weekly", "premium", "annual"].includes(subscription.plan_type)
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
      const metadata = {
        full_name: account.fullName.trim(),
        phone_number: contact.phoneNumber.trim(),
        sms_notifications_enabled: smsOptIn,
        preferred_payment_method: "paypal",
      };

      let userId: string | null = null;
      let registrationError: string | null = null;

      try {
        const { data, error } = await supabase.functions.invoke("register-member", {
          body: {
            email: normalizedEmail,
            password: account.password,
            fullName: account.fullName.trim(),
            phoneNumber: contact.phoneNumber.trim(),
            smsOptIn,
          },
        });
        if (error) {
          const details = typeof (error as { context?: { text?: () => Promise<string> } }).context?.text === "function"
            ? await (error as { context: { text: () => Promise<string> } }).context.text()
            : "";
          try { registrationError = JSON.parse(details)?.error || null; } catch { registrationError = null; }
          if (registrationError) throw new Error(registrationError);
        } else if (data?.userId) {
          userId = data.userId;
        } else if (data?.error) {
          throw new Error(data.error);
        }
      } catch (invokeError) {
        // The registration function may be unreachable (not deployed / network blocked).
        // Only surface a real validation message; otherwise fall back to standard sign-up.
        if (registrationError) throw invokeError;
      }

      if (!userId) {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: normalizedEmail,
          password: account.password,
          options: {
            emailRedirectTo: `${window.location.origin}/confirm-account`,
            data: metadata,
          },
        });
        if (signUpError) throw new Error(signUpError.message);
        userId = signUpData.user?.id ?? null;
        if (!userId) throw new Error("Account could not be created");
      }

      await supabase.functions.invoke("send-email-confirmation", {
        body: { email: normalizedEmail, name: account.fullName.trim(), userId },
      }).catch(() => undefined);


      // Everyone who creates an account joins the weekly newsletter (they can unsubscribe in any email).
      fetch("/api/join-fan-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, name: account.fullName.trim() }),
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
    try {
      const validated = { email: z.string().email().parse(email.trim().toLowerCase()), password: z.string().min(6).parse(password) };
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
        // Hand the login to the device's own password manager (Chrome, Safari, Android, iCloud Keychain).
        // The password is never kept by the site itself.
        try {
          const PC = (window as any).PasswordCredential;
          if (PC && navigator.credentials?.store) {
            await navigator.credentials.store(new PC({ id: validated.email, password: validated.password, name: validated.email }));
          }
        } catch {
          /* the browser's own save prompt still works */
        }
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
      const { error } = await supabase.functions.invoke("send-password-reset", {
        body: { email: normalizedEmail, redirectTo: `${window.location.origin}/auth?mode=reset` },
      });
      if (error) throw error;
      toast({ title: "Check your email", description: "We sent a reset link (check Spam/Promotions too). Only the newest link works, so use the latest email." });
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

  const title = isRecovery ? "New password" : forgotPassword ? "Reset password" : isSignup ? (signupStep === 1 ? "Join the Zone" : "Last step") : "Welcome back";
  const subtitle = isRecovery
    ? "Choose a secure password for your account."
    : forgotPassword ? "We’ll send a secure reset link to your email."
      : isSignup ? (signupStep === 1 ? "Create your free account. You'll choose a plan after confirming your email." : "Add your phone so we can reach you on game day.")
        : "Sign in to your MetsXMFanZone account.";

  const showTabs = !forgotPassword && !isRecovery;
  const perks = ["Live shows & streams", "Watch on phone, computer & TV", "Cancel anytime"];

  return (
    <div className="auth-modern relative min-h-[100dvh] bg-[#050b18] text-white lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <Helmet>
        <title>{isSignup ? "Create Account" : "Member Sign In"} — MetsXMFanZone</title>
        <meta name="description" content="Create or access your MetsXMFanZone member account." />
        <meta name="robots" content="noindex,follow" />
        <link rel="canonical" href="https://metsxmfanzone.com/auth" />
      </Helmet>

      {/* Stadium panel: full height on computers, a short header on phones */}
      <aside className="relative h-[200px] overflow-hidden sm:h-[240px] lg:sticky lg:top-0 lg:h-[100dvh]">
        <img src={heroImage} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover object-[50%_55%] lg:object-[58%_50%]" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#050b18]/25 to-[#050b18] lg:bg-gradient-to-t lg:from-[#050b18] lg:via-[#050b18]/35 lg:to-transparent" />
        <div className="absolute inset-y-0 right-0 hidden w-40 bg-gradient-to-r from-transparent to-[#050b18] lg:block" />
                <Link to="/" className="absolute left-4 top-[max(1rem,env(safe-area-inset-top))] z-10 inline-flex items-center gap-1.5 rounded-full bg-black/35 px-3 py-1.5 text-xs font-semibold text-white/90 backdrop-blur-md hover:bg-black/50 lg:left-8 lg:top-8">
          <ArrowLeft className="h-3.5 w-3.5" /> Home
        </Link>
        <div className="absolute inset-x-0 bottom-0 hidden p-10 xl:p-14 lg:block">
          <img src={authLogo} alt="MetsXMFanZone" className="h-24 w-auto object-contain drop-shadow-[0_8px_24px_rgba(0,0,0,0.5)]" />
          <h1 className="mt-6 max-w-lg font-display text-5xl uppercase leading-[0.95] tracking-wide xl:text-6xl">
            Your Mets home,<br /><span className="text-[#FF5910]">on every screen.</span>
          </h1>
          <p className="mt-4 max-w-md text-base leading-7 text-white/75">News, live shows, the community and streaming, all in one account.</p>
          <div className="mt-6 flex flex-wrap gap-2">
            {perks.map((p) => (
              <span key={p} className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold backdrop-blur-md">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#FF5910]" />{p}
              </span>
            ))}
          </div>
        </div>
      </aside>

      <main className="relative z-10 -mt-16 flex min-w-0 justify-center px-4 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-6 lg:mt-0 lg:items-center lg:py-12">
        <div className="w-full max-w-[440px]">
          <div className="mb-5 flex justify-center lg:hidden">
            <img src={authLogo} alt="MetsXMFanZone" className="h-20 w-auto object-contain drop-shadow-[0_8px_24px_rgba(0,0,0,0.6)]" />
          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] backdrop-blur-xl sm:p-8 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none lg:backdrop-blur-0">
            {showTabs && (
              <div className="mb-6 grid grid-cols-2 rounded-2xl bg-white/[0.06] p-1" role="tablist" aria-label="Account">
                {[["login", "Sign in"], ["signup", "Join"]].map(([m, label]) => {
                  const active = (m === "signup") === isSignup;
                  return (
                    <Link key={m} to={`/auth?mode=${m}`} replace role="tab" aria-selected={active}
                      className={`rounded-xl py-2.5 text-center text-sm font-bold transition-colors ${active ? "bg-white text-[#002D72] shadow" : "text-white/65 hover:text-white"}`}>
                      {label}
                    </Link>
                  );
                })}
              </div>
            )}

            <header className="mb-6">
              {isSignup && <p className="mb-1.5 text-xs font-bold uppercase tracking-[0.14em] text-[#FF5910]">Step {signupStep} of 2 · {signupStep === 1 ? "Your account" : "Almost done"}</p>}
              <h2 className="font-display text-[34px] uppercase leading-none tracking-wide sm:text-4xl">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-white/65">{subtitle}</p>
            </header>

            {isSignup && (
              <div className="mb-6 flex gap-1.5" aria-label={`Registration step ${signupStep} of 2`}>
                {[1, 2].map((n) => <div key={n} className={`h-1.5 flex-1 rounded-full transition-colors ${signupStep >= n ? "bg-[#FF5910]" : "bg-white/10"}`} />)}
              </div>
            )}

            {actionTakingTooLong && (
              <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-400/30 bg-red-500/10 p-3.5 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
                <div className="flex-1"><p className="font-semibold">This is taking longer than expected.</p><button type="button" className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-[#FF8A50] hover:underline" onClick={clearStuckLoginState}><RefreshCw className="h-3 w-3" />Reset sign-in</button></div>
              </div>
            )}

            <form onSubmit={isRecovery ? handleUpdatePassword : forgotPassword ? handleForgotPassword : isSignup ? handleSignup : handleLogin} className="space-y-4">
              <div className="pointer-events-none absolute -left-[9999px]" aria-hidden="true"><input tabIndex={-1} autoComplete="off" value={honeypot} onChange={(event) => setHoneypot(event.target.value)} /></div>

              {isSignup && signupStep === 1 && (
                <>
                  <Field id="fullName" label="Full name" icon={UserRound} value={fullName} onChange={setFullName} autoComplete="name" placeholder="First and last name" />
                  <Field id="signupEmail" label="Email" icon={Mail} type="email" value={email} onChange={setEmail} autoComplete="email" placeholder="you@example.com" inputMode="email" />
                  <Field id="signupPassword" label="Password" icon={LockKeyhole} type={showPassword ? "text" : "password"} value={password} onChange={setPassword} autoComplete="new-password" placeholder="At least 6 characters"
                    trailing={<EyeToggle shown={showPassword} onToggle={() => setShowPassword((v) => !v)} />} />
                </>
              )}

              {isSignup && signupStep === 2 && (
                <>
                  <Field id="phoneNumber" label="Phone number" icon={Phone} type="tel" value={phoneNumber} onChange={setPhoneNumber} autoComplete="tel" placeholder="555-123-4567" inputMode="tel" />
                  <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition-colors hover:bg-white/[0.07]"><Checkbox checked={smsOptIn} onCheckedChange={(value) => setSmsOptIn(value === true)} className="mt-0.5" /><span><span className="block text-sm font-semibold">Text me game-day alerts</span><span className="mt-0.5 block text-xs leading-5 text-white/55">Optional news and live-stream notifications. Message rates may apply.</span></span></label>
                  <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition-colors hover:bg-white/[0.07]"><Checkbox checked={agreeToTerms} onCheckedChange={(value) => setAgreeToTerms(value === true)} className="mt-0.5" /><span className="text-sm leading-5 text-white/75">I agree to the <Link to="/terms" target="_blank" className="font-semibold text-[#FF8A50] hover:underline">Terms</Link> and <Link to="/privacy" target="_blank" className="font-semibold text-[#FF8A50] hover:underline">Privacy Policy</Link>.</span></label>
                  <div className="flex items-start gap-2.5 rounded-2xl bg-[#002D72]/40 p-4 text-xs leading-5 text-white/70"><ShieldCheck className="h-4 w-4 shrink-0 text-[#FF5910]" /><span>Nothing is charged now. You'll pick Weekly, Monthly or Yearly after you confirm your email.</span></div>
                </>
              )}

              {!isSignup && !isRecovery && (
                <Field id="email" name="email" label="Email" icon={Mail} type="email" value={email} onChange={setEmail} autoComplete="username" placeholder="you@example.com" inputMode="email" />
              )}

              {!isSignup && !forgotPassword && !isRecovery && (
                <Field id="password" name="password" label="Password" icon={LockKeyhole} type={showPassword ? "text" : "password"} value={password} onChange={setPassword} autoComplete="current-password" placeholder="Your password"
                  labelAction={<button type="button" className="text-xs font-semibold text-[#FF8A50] hover:underline" onClick={() => setForgotPassword(true)}>Forgot password?</button>}
                  trailing={<EyeToggle shown={showPassword} onToggle={() => setShowPassword((v) => !v)} />} />
              )}

              {isRecovery && (
                <>
                  <Field id="newPassword" label="New password" icon={LockKeyhole} type="password" value={password} onChange={setPassword} autoComplete="new-password" placeholder="At least 6 characters" />
                  <Field id="confirmPassword" label="Confirm password" icon={LockKeyhole} type="password" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" placeholder="Type it again" />
                </>
              )}

              {!isSignup && !forgotPassword && !isRecovery && (
                <label className="flex cursor-pointer items-start gap-3 pt-1 text-sm text-white/75"><Checkbox checked={rememberMe} onCheckedChange={(value) => setRememberMe(value === true)} className="mt-0.5" /><span>Keep me signed in on this device<span className="mt-0.5 block text-[11px] leading-4 text-white/45">Your browser saves it, not us. Skip this on shared devices.</span></span></label>
              )}

              <div className="pt-2">
                {isSignup && signupStep === 1 ? (
                  <PrimaryButton type="button" onClick={continueSignup}>Continue <ArrowRight className="h-5 w-5" /></PrimaryButton>
                ) : isSignup ? (
                  <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2.5">
                    <button type="button" onClick={() => setSignupStep(1)} className="inline-flex h-14 items-center gap-1.5 rounded-2xl border border-white/15 px-5 text-sm font-bold text-white/85 hover:bg-white/5"><ArrowLeft className="h-4 w-4" />Back</button>
                    <PrimaryButton type="submit" disabled={loading || !agreeToTerms}>{loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Create account"}</PrimaryButton>
                  </div>
                ) : (
                  <PrimaryButton type="submit" disabled={loading || verifyingReset}>{loading ? <Loader2 className="h-5 w-5 animate-spin" /> : isRecovery ? "Update password" : forgotPassword ? "Send reset link" : "Sign in"}</PrimaryButton>
                )}
              </div>

              {!isSignup && !forgotPassword && !isRecovery && (
                <p className="text-center text-xs leading-5 text-white/45">By signing in you agree to the <Link to="/terms" target="_blank" className="text-white/70 underline-offset-2 hover:underline">Terms</Link> and <Link to="/privacy" target="_blank" className="text-white/70 underline-offset-2 hover:underline">Privacy Policy</Link>.</p>
              )}
            </form>

            {(forgotPassword || isRecovery) && (
              <div className="mt-6 text-center">
                <Link to="/auth?mode=login" replace onClick={() => setForgotPassword(false)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-white/70 hover:text-white"><ArrowLeft className="h-4 w-4" />Back to sign in</Link>
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] font-semibold uppercase tracking-wider text-white/40 lg:justify-start">
            <span className="inline-flex items-center gap-1.5"><LockKeyhole className="h-3.5 w-3.5" />Secure sign-in</span>
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" />PayPal billing</span>
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" />Cancel anytime</span>
          </div>
        </div>
      </main>
    </div>
  );
};

type FieldProps = {
  id: string; label: string; value: string; onChange: (v: string) => void;
  icon: React.ComponentType<{ className?: string }>; type?: string; name?: string; autoComplete?: string;
  placeholder?: string; inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  trailing?: React.ReactNode; labelAction?: React.ReactNode;
};
function Field({ id, label, value, onChange, icon: Icon, type = "text", name, autoComplete, placeholder, inputMode, trailing, labelAction }: FieldProps) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label htmlFor={id} className="text-[13px] font-semibold text-white/80">{label}</label>
        {labelAction}
      </div>
      <div className="group relative">
        <Icon className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-white/40 transition-colors group-focus-within:text-[#FF5910]" />
        <input id={id} name={name} type={type} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} placeholder={placeholder} inputMode={inputMode}
          className={`h-14 w-full min-w-0 rounded-2xl border border-white/10 bg-white/[0.06] pl-12 ${trailing ? "pr-12" : "pr-4"} text-base text-white outline-none transition placeholder:text-white/30 hover:border-white/20 focus:border-[#FF5910] focus:bg-white/[0.08] focus:ring-4 focus:ring-[#FF5910]/15`} />
        {trailing}
      </div>
    </div>
  );
}

function EyeToggle({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} aria-label={shown ? "Hide password" : "Show password"}
      className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-white/50 hover:bg-white/10 hover:text-white">
      {shown ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
    </button>
  );
}

function PrimaryButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...props}
      className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#FF5910] to-[#ff7a33] text-base font-extrabold text-white shadow-[0_12px_30px_-8px_rgba(255,89,16,0.65)] transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none">
      {children}
    </button>
  );
}


export default Auth;
