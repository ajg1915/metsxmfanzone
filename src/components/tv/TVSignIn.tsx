import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { setTVModePreference } from "@/hooks/use-device";
import metsLogo from "@/assets/metsxmfanzone-logo.png";

// Big-screen sign-in for paid members. Arrow keys move between the fields and
// buttons (useTVFocusNav), and the TV's own on-screen keyboard opens when a
// field is selected with OK.
const credentials = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(6),
});

export function TVSignIn() {
  const navigate = useNavigate();
  const emailRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    emailRef.current?.focus({ preventScroll: true });
  }, []);

  const signIn = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const parsed = credentials.safeParse({ email, password });
    if (!parsed.success) {
      setError("Enter your email and password.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: String(parsed.data.email),
        password: String(parsed.data.password),
      });
      if (authError) {
        setError("The email or password is incorrect.");
        return;
      }
      if (!data.user?.email_confirmed_at && !data.user?.confirmed_at) {
        await supabase.auth.signOut();
        setError("Confirm your email first, then sign in again.");
        return;
      }
      void supabase.functions.invoke("member-auth-activity", { body: { eventType: "login" } });
      // useAuth picks up the new session and the TV home screen replaces this one.
    } catch {
      setError("Could not sign in. Check the connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const exitTV = () => {
    setTVModePreference(false);
    navigate("/");
    window.location.reload();
  };

  const field =
    "w-full rounded-2xl bg-[#17263f] border-2 border-transparent px-5 py-3 text-[1.4rem] text-white placeholder:text-[#9fb0c9] focus:border-white focus:outline-none";

  return (
    <div className="h-screen w-screen overflow-y-auto bg-[#07101f] text-[#f2f5fa]">
      <div className="mx-auto flex min-h-full w-full max-w-[44rem] flex-col justify-center px-8 py-6">
        <div className="flex items-center gap-5 mb-5">
          <img src={metsLogo} alt="MetsXMFanZone" className="h-14 w-auto" />
          <div>
            <p className="text-[1.1rem] font-bold tracking-widest uppercase text-[#ff5910]">TV Mode</p>
            <h1 className="text-[2rem] font-bold leading-tight">Sign in to watch</h1>
          </div>
        </div>

        <form onSubmit={signIn} className="space-y-3">
          <label className="block">
            <span className="block mb-1 text-[1.05rem] text-[#9fb0c9]">Email</span>
            <input
              ref={emailRef}
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={field}
            />
          </label>
          <label className="block">
            <span className="block mb-1 text-[1.05rem] text-[#9fb0c9]">Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              className={field}
            />
          </label>

          {error && (
            <p role="alert" className="text-[1.2rem] text-[#ff8a8a]">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-white text-[#07101f] font-bold text-[1.3rem] py-3 disabled:opacity-60"
          >
            {busy ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="mt-4 text-[1rem] text-[#9fb0c9]">
          TV Mode is for paid members. Use the same email and password as metsxmfanzone.com.
          No account yet? Join on your phone or computer at metsxmfanzone.com/pricing.
        </p>

        <button
          type="button"
          onClick={exitTV}
          className="mt-4 self-start rounded-full bg-[#17263f] text-[#f2f5fa] font-medium text-[1.05rem] px-6 py-2"
        >
          Leave TV Mode
        </button>
      </div>
    </div>
  );
}
