import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useBotGuard } from "@/utils/botGuard";
import logo from "@/assets/metsxmfanzone-logo.png";

const NewsletterSection = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { check, markSubmitted, reset, honeypotProps } = useBotGuard("newsletter");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const guard = check();
    if (!guard.ok) {
      toast({ title: "Subscription failed", description: guard.reason, variant: "destructive" });
      return;
    }

    setIsLoading(true);

    try {
      // Goes to our own server, which adds the visitor to the Resend newsletter list.
      const res = await fetch("/api/join-fan-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), name: name.trim() }),
      });
      if (!res.ok) throw new Error(`Signup failed (${res.status})`);

      markSubmitted();
      toast({
        title: "Successfully subscribed!",
        description: "You'll receive the latest Mets news and updates.",
      });
      setEmail("");
      setName("");
      reset();
    } catch (error) {
      console.error("Newsletter signup error:", error);
      toast({
        title: "Subscription failed",
        description: "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const field =
    "box-border h-12 w-full rounded-[10px] border border-white/20 bg-[#06101c] px-3.5 text-base text-[#f3f6f9] placeholder:text-[#7f93aa] focus-visible:ring-[#ff4500]";
  const label = "mb-1 block text-xs font-semibold text-[#9fb0c2]";

  return (
    <section aria-labelledby="newsletter-title" className="border-y border-white/10 border-t-[3px] border-t-[#ff4500] bg-gradient-to-r from-[#0b3e75] via-[#0c1c2c] to-[#0c1c2c]">
      <div className="mx-auto flex max-w-[1240px] flex-col gap-6 px-5 py-7 md:flex-row md:items-center md:justify-between md:gap-12 md:px-8 md:py-9">
        {/* Left: the logo and the message */}
        <div className="flex min-w-0 items-center gap-4 md:flex-1 md:gap-6">
          <img src={logo} alt="MetsXMFanZone" className="h-14 w-auto shrink-0 drop-shadow-[0_0_20px_rgba(255,69,0,0.45)] md:h-[84px]" />
          <div className="min-w-0">
            <p className="text-xs font-bold tracking-[0.14em] text-[#ff8a57] md:text-[13px]">THE NEWSLETTER</p>
            <h2 id="newsletter-title" className="font-display text-4xl uppercase leading-none text-white md:text-[54px]">
              Get MetsXMFanZone News
            </h2>
            <p className="mt-2 hidden max-w-[460px] text-base leading-snug text-[#c3cfdb] md:block">
              Mets news, game highlights and updates from the fan zone, straight to your email.
            </p>
          </div>
        </div>
        <p className="-mt-3 text-[15px] leading-snug text-[#c3cfdb] md:hidden">
          Mets news, game highlights and updates, straight to your email.
        </p>

        {/* Right: the signup */}
        <form onSubmit={handleSubmit} className="relative flex w-full flex-col gap-2.5 md:w-[540px] md:shrink-0">
          <input {...honeypotProps} />
          <div className="flex flex-col gap-2.5 md:flex-row">
            <div className="md:flex-1">
              <label htmlFor="newsletter-name" className={label}>Your name</label>
              <Input id="newsletter-name" type="text" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" className={field} />
            </div>
            <div className="md:flex-[1.3]">
              <label htmlFor="newsletter-email" className={label}>Email</label>
              <Input id="newsletter-email" type="email" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" className={field} />
            </div>
          </div>
          <Button type="submit" disabled={isLoading} className="mt-1 h-[50px] rounded-full bg-[#ff4500] text-base font-bold text-[#06101c] hover:bg-[#ff5910]">
            {isLoading ? "Subscribing..." : "Subscribe"}
          </Button>
          <p className="text-center text-xs text-[#9fb0c2]">We respect your privacy. Unsubscribe at any time.</p>
        </form>
      </div>
    </section>
  );
};
export default NewsletterSection;
