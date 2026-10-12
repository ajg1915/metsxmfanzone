import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
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
      // Plain insert: visitors are allowed to add themselves, but not to read or change the list.
      const { error } = await supabase
        .from("newsletter_subscribers")
        .insert({ email: email.trim().toLowerCase(), full_name: name.trim() || null, is_active: true });

      // 23505 = this email is already on the list, which is fine for the visitor
      if (error && (error as { code?: string }).code !== "23505") throw error;

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

  return <section className="py-6 sm:py-8 md:py-12">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
        <div className="max-w-xl sm:max-w-2xl mx-auto text-center glass-card glow-blue rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 bg-gradient-to-br from-primary/10 via-background to-primary/5">
          <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-full bg-primary/10 mb-3 sm:mb-4 md:mb-5">
            <img src={logo} alt="MetsXMFanZone" className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14" />
          </div>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-2 sm:mb-3 leading-tight">
            Get MetsXMFanZone News
          </h2>
          <p className="text-muted-foreground mb-4 sm:mb-5 md:mb-6 text-xs sm:text-sm max-w-md mx-auto">
            Mets news, game highlights and updates from MetsXMFanZone, straight to your email.
          </p>
          <form onSubmit={handleSubmit} className="relative flex flex-col gap-2 sm:gap-3 max-w-sm sm:max-w-md mx-auto">
            <input {...honeypotProps} />
            <Input type="text" placeholder="Your name" value={name} onChange={e => setName(e.target.value)} maxLength={80} autoComplete="name" className="flex-1 h-9 sm:h-10 text-sm" />
            <Input type="email" placeholder="Enter your email" value={email} onChange={e => setEmail(e.target.value)} required className="flex-1 h-9 sm:h-10 text-sm" />

            <Button type="submit" size="default" disabled={isLoading} className="h-9 sm:h-10 text-xs sm:text-sm px-4 sm:px-6">
              {isLoading ? "Subscribing..." : "Subscribe"}
            </Button>
          </form>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-3 sm:mt-4">
            We respect your privacy. Unsubscribe at any time.
          </p>
        </div>
      </div>
    </section>;
};
export default NewsletterSection;