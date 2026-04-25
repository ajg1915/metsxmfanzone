import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

type Status = "loading" | "valid" | "already" | "invalid" | "submitting" | "success" | "error";

const Unsubscribe = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [status, setStatus] = useState<Status>("loading");
  const [email, setEmail] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      setErrorMsg("No unsubscribe token provided.");
      return;
    }
    (async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          { headers: { apikey: SUPABASE_ANON_KEY } }
        );
        const data = await res.json();
        if (!res.ok) {
          setStatus("invalid");
          setErrorMsg(data?.error || "Invalid or expired link.");
          return;
        }
        if (data.alreadyUnsubscribed) {
          setStatus("already");
          setEmail(data.email || "");
        } else {
          setStatus("valid");
          setEmail(data.email || "");
        }
      } catch (e) {
        setStatus("invalid");
        setErrorMsg("Could not validate this link.");
      }
    })();
  }, [token]);

  const handleConfirm = async () => {
    setStatus("submitting");
    try {
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ token }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        setErrorMsg(data?.error || "Could not unsubscribe.");
        return;
      }
      setStatus("success");
    } catch (e) {
      setStatus("error");
      setErrorMsg("Network error. Please try again.");
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card text-card-foreground p-8 shadow-lg">
        <h1 className="text-2xl font-bold mb-4 text-center">Email Unsubscribe</h1>

        {status === "loading" && (
          <div className="flex flex-col items-center gap-3 py-6 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p>Validating your link…</p>
          </div>
        )}

        {status === "valid" && (
          <div className="text-center space-y-4">
            <p className="text-muted-foreground">
              You're about to unsubscribe{email ? ` ${email}` : ""} from MetsXMFanZone app emails.
            </p>
            <Button onClick={handleConfirm} className="w-full">Confirm Unsubscribe</Button>
          </div>
        )}

        {status === "submitting" && (
          <div className="flex flex-col items-center gap-3 py-6 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p>Unsubscribing…</p>
          </div>
        )}

        {status === "success" && (
          <div className="text-center space-y-3">
            <CheckCircle2 className="h-10 w-10 text-primary mx-auto" />
            <p className="font-medium">You've been unsubscribed.</p>
            {email && <p className="text-sm text-muted-foreground">{email} won't receive these emails anymore.</p>}
          </div>
        )}

        {status === "already" && (
          <div className="text-center space-y-3">
            <CheckCircle2 className="h-10 w-10 text-primary mx-auto" />
            <p className="font-medium">You're already unsubscribed.</p>
            {email && <p className="text-sm text-muted-foreground">{email}</p>}
          </div>
        )}

        {(status === "invalid" || status === "error") && (
          <div className="text-center space-y-3">
            <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
            <p className="font-medium">{status === "invalid" ? "Invalid link" : "Something went wrong"}</p>
            <p className="text-sm text-muted-foreground">{errorMsg}</p>
          </div>
        )}
      </div>
    </main>
  );
};

export default Unsubscribe;
