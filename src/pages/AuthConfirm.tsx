import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

/**
 * Landing page for links in account emails (signup, password reset, magic link,
 * invite, email change). The email links here on metsxmfanzone.com instead of
 * the raw Supabase URL, which keeps the links on our own domain (better
 * deliverability, and no unfamiliar address in the button).
 *
 * Link format (set in the Supabase email templates):
 *   /auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next={{ .RedirectTo }}
 * `next` is always the LAST parameter because RedirectTo is not URL-encoded.
 */

const VALID_TYPES: EmailOtpType[] = ["signup", "email", "recovery", "magiclink", "invite", "email_change"];
const ALLOWED_HOSTS = new Set(["metsxmfanzone.com", "www.metsxmfanzone.com"]);

const DEFAULT_NEXT: Record<string, string> = {
  recovery: "/auth?mode=reset",
  invite: "/auth?mode=reset",
  signup: "/",
  email: "/",
  magiclink: "/",
  email_change: "/",
};

/** Only allow redirects back into our own site. */
function safeNext(raw: string | null, type: string): string {
  const fallback = DEFAULT_NEXT[type] ?? "/";
  if (!raw) return fallback;
  try {
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin && !ALLOWED_HOSTS.has(url.hostname)) return fallback;
    const path = `${url.pathname}${url.search}${url.hash}`;
    // Supabase's default redirect (the bare site URL) — use our per-type default instead.
    return path === "/" ? fallback : path;
  } catch {
    return fallback;
  }
}

export default function AuthConfirm() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const search = window.location.search;
    const params = new URLSearchParams(search);
    const tokenHash = params.get("token_hash");
    const type = (params.get("type") || "") as EmailOtpType;
    // Everything after "next=" (it may contain its own "?"/"=" since it's unencoded).
    const nextIdx = search.indexOf("next=");
    let rawNext = nextIdx >= 0 ? search.slice(nextIdx + 5) : null;
    try { if (rawNext) rawNext = decodeURIComponent(rawNext); } catch { /* keep raw */ }

    if (!tokenHash || !VALID_TYPES.includes(type)) {
      setError("This link is incomplete. Please request a new email.");
      return;
    }

    supabase.auth
      .verifyOtp({ token_hash: tokenHash, type })
      .then(({ error: verifyError }) => {
        if (verifyError) {
          setError(
            /expired|invalid/i.test(verifyError.message)
              ? "This link has expired or was already used. Please request a new one."
              : verifyError.message,
          );
          return;
        }
        navigate(safeNext(rawNext, type), { replace: true });
      });
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-sm w-full text-center space-y-4">
        {error ? (
          <>
            <h1 className="text-lg font-semibold">We couldn't confirm that link</h1>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Link to="/auth?mode=login" className="inline-block text-sm text-primary underline">
              Back to sign in
            </Link>
          </>
        ) : (
          <>
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
            <p className="text-sm text-muted-foreground">Confirming…</p>
          </>
        )}
      </div>
    </div>
  );
}
