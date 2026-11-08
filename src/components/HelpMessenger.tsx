import { useState } from "react";
import { MessageCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Messenger button for the Help Center. Visitors write their issue and it is emailed to our support inbox.
export function HelpMessenger() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot, left empty by real people
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const reset = () => { setName(""); setEmail(""); setMessage(""); setError(""); setSent(false); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/help-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message, website, page: window.location.pathname }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.success) throw new Error(j.error || "Could not send right now.");
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send right now.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Message us"
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <MessageCircle className="h-7 w-7" />
      </button>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o && sent) reset(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Message us</DialogTitle>
            <DialogDescription>
              {sent ? "We got it." : "Tell us what's going on and we'll reply by email."}
            </DialogDescription>
          </DialogHeader>

          {sent ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Thanks! Your message was sent. We'll reply to {email} as soon as we can.
              </p>
              <Button className="w-full" onClick={() => { setOpen(false); reset(); }}>Close</Button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="hm-name">Name</Label>
                <Input id="hm-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} autoComplete="name" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="hm-email">Your email</Label>
                <Input id="hm-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} autoComplete="email" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="hm-message">Your issue</Label>
                <Textarea id="hm-message" required minLength={5} maxLength={3000} rows={5} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="What's the problem? What device or browser are you on?" />
              </div>
              <input type="text" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} className="hidden" aria-hidden="true" />
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full gap-2" disabled={busy}>
                <Send className="h-4 w-4" /> {busy ? "Sending…" : "Send message"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
