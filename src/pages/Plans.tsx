import SEOHead from "@/components/SEOHead";

import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, AlertCircle, CreditCard, Loader2, ShieldCheck } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import CheckoutModal from "@/components/CheckoutModal";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const Plans = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const { tier, loading: subscriptionLoading } = useSubscription();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [activatingFree, setActivatingFree] = useState(false);

  
  // Check if user must select a plan (coming from signup)
  const pendingPlan = localStorage.getItem("pending_signup_plan");
  const mustSelectPlan = searchParams.get("required") === "true" || !!pendingPlan || localStorage.getItem("pending_membership_selection") === "true";
  const [hasPlanSelected, setHasPlanSelected] = useState(false);
  
  // Block navigation if plan selection is required
  useEffect(() => {
    if (mustSelectPlan && !hasPlanSelected) {
      // Prevent back navigation
      const handlePopState = (e: PopStateEvent) => {
        e.preventDefault();
        window.history.pushState(null, "", window.location.href);
      };
      
      window.history.pushState(null, "", window.location.href);
      window.addEventListener("popstate", handlePopState);
      
      return () => {
        window.removeEventListener("popstate", handlePopState);
      };
    }
  }, [mustSelectPlan, hasPlanSelected]);

  const handleSelectPlan = async (planId: string) => {
    if (!user) {
      localStorage.setItem("pending_membership_selection", "true");
      navigate("/auth?mode=signup");
      return;
    }

    if (planId === "free") {
      setActivatingFree(true);
      const { data, error } = await supabase.functions.invoke("activate-free-membership", { body: {} });
      setActivatingFree(false);
      if (error || data?.error) {
        toast({ title: "Membership could not be activated", description: "Please try again.", variant: "destructive" });
        return;
      }
      localStorage.removeItem("pending_membership_selection");
      localStorage.removeItem("pending_signup_plan");
      setHasPlanSelected(true);
      navigate("/dashboard", { replace: true });
      return;
    }

    setSelectedPlan(planId);
    setCheckoutOpen(true);
  };

  const handleCheckoutClose = (open: boolean) => {
    setCheckoutOpen(open);
    
    // If checkout was completed successfully, clear the pending plan
    if (!open && selectedPlan && selectedPlan !== "free") {
      // Check if subscription was created
      if (tier === "weekly" || tier === "premium" || tier === "annual") {
        localStorage.removeItem("pending_signup_plan");
        setHasPlanSelected(true);
      }
    }
  };

  const allPlans = [
    {
      id: "free",
      name: "Free",
      price: "$0",
      priceValue: 0,
      period: "forever",
      billingNote: "No payment required",
      description: "Start with the fan essentials",
      features: ["Public Mets news", "Community access", "Member profile", "Membership notifications"],
      cta: "Choose Free",
      popular: false,
    },
    {
      id: "weekly",
      name: "Weekly",
      price: "$3.99",
      priceValue: 3.99,
      period: "per week",
      billingNote: "Billed weekly through PayPal",
      description: "Full access with a shorter commitment",
      features: ["All live streams", "Full game replays", "All highlights", "Community access", "HD streaming"],
      cta: "Choose Weekly",
      popular: false,
    },
    {
      id: "premium",
      name: "Monthly",
      price: "$9.99",
      priceValue: 9.99,
      period: "per month",
      billingNote: "Billed monthly",
      description: "Most popular for true fans",
      features: [
        "All live streams",
        "Full game replays",
        "All highlights",
        "Community forum access",
        "Ad-free experience",
        "Exclusive content",
        "HD streaming",
        "Multi-device access",
      ],
      notIncluded: [],
      cta: "Choose Monthly",
      popular: true,
    },
    {
      id: "annual",
      name: "Yearly",
      price: "$129.99",
      priceValue: 129.99,
      period: "per year",
      billingNote: "Billed annually",
      description: "One payment for a full year",
      features: [
        "Everything in Premium",
        "Simple yearly billing",
        "Priority support",
        "Early access to content",
        "Exclusive merchandise discounts",
        "VIP community badge",
      ],
      notIncluded: [],
      cta: "Choose Yearly",
      popular: false,
    },
  ];

  const plans = allPlans;

  const selectedPlanData = plans.find((p) => p.id === selectedPlan);

  const faqs = [
    {
      question: "What is included with each membership?",
      answer:
        "Free includes public news and community access. Weekly, Monthly, and Yearly include live streams, replays, highlights, and premium content.",
    },
    {
      question: "Can I switch between paid memberships?",
      answer:
        "Yes. Choose a different paid membership from your Member Center. Your new PayPal billing schedule starts with the new membership.",
    },
    {
      question: "What payment methods do you accept?",
      answer:
        "We accept PayPal for all subscription payments. PayPal supports credit cards, debit cards, and PayPal balance.",
    },
    {
      question: "Can I cancel my subscription anytime?",
      answer:
        "Yes! You can cancel your subscription at any time from your account settings. Your access will continue until the end of your billing period.",
    },
    {
      question: "Is there a refund policy?",
      answer:
        "We offer a 7-day money-back guarantee for first-time subscribers. This trial applies only to the regular season (not Spring Training or off-season). If you're not satisfied, contact support within 7 days for a full refund.",
    },
    {
      question: "Can I watch on multiple devices?",
      answer:
        "Weekly, Monthly, and Yearly memberships allow streaming on up to 2 devices simultaneously. Accounts found accessing from more than 2 devices may be restricted.",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Mets Fan Pricing - Premium Access"
        description="Choose your MetsXMFanZone membership. Get unlimited access to live Mets streams, game replays, exclusive content, and more."
        keywords="Mets subscription, Mets premium, baseball streaming pricing, Mets fan membership, live stream subscription"
        canonical="https://www.metsxmfanzone.com/plans"
      />
      {!mustSelectPlan && <Navigation />}
      <main className={mustSelectPlan ? "pt-8" : "pt-12"}>
        <section className="py-6 sm:py-12">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
            {/* Required Plan Selection Banner */}
            {mustSelectPlan && (
              <div className="mb-8 bg-primary/10 border border-primary/30 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-foreground">Please Select a Plan</h3>
                   <p className="text-sm text-muted-foreground">
                     Complete your setup with Free, Weekly, Monthly, or Yearly membership.
                  </p>
                </div>
              </div>
            )}
            
            {/* Header */}
            <div className="text-center mb-8">
              <Badge variant="outline" className="mb-3">PayPal membership</Badge>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4">
                Choose Your Plan
              </h1>
              <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
                 Start free for news and community, or choose a paid plan for live streams and premium content.
              </p>
            </div>

            {/* Plans Grid */}

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 sm:gap-5 mb-12 max-w-6xl mx-auto">
              {plans.map((plan) => (
                <Card
                  key={plan.id}
                  className={`relative overflow-hidden transition-colors bg-card/90 ${
                    plan.popular ? "border-primary ring-2 ring-primary/20" : "border-border"
                  }`}
                >
                  {plan.popular && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
                      MOST POPULAR
                    </Badge>
                  )}
                  <CardContent className="p-5 sm:p-7 pt-8">
                    <div className="text-left mb-6">
                      <h3 className="text-xl font-semibold text-foreground mb-2">{plan.name}</h3>
                      <p className="text-sm text-muted-foreground mb-4">{plan.description}</p>
                      <div className="mb-2">
                        <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                        <span className="text-muted-foreground ml-1">/{plan.period === "Spring Training" ? "Spring Training" : plan.period.replace("per ", "")}</span>
                      </div>
                      {plan.billingNote && (
                        <p className="text-xs text-muted-foreground">{plan.billingNote}</p>
                      )}
                      {(plan as any).trialNote && (
                        <p className="text-[10px] text-primary font-medium mt-1">{(plan as any).trialNote}</p>
                      )}
                    </div>

                    <Button
                      className="w-full mb-6"
                      variant={plan.popular ? "default" : "outline"}
                      onClick={() => void handleSelectPlan(plan.id)}
                      disabled={tier === plan.id || (plan.id === "free" && activatingFree)}
                    >
                      {plan.id === "free" && activatingFree ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}{tier === plan.id ? "Current plan" : plan.cta}
                    </Button>

                    <div className="space-y-3">
                      {plan.features.map((feature, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                          <span className="text-sm text-foreground">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="mb-12 grid gap-3 sm:grid-cols-3 max-w-4xl mx-auto">
              {["Secure PayPal checkout", "Cancel from Member Center", "Access on up to 2 devices"].map((label) => (
                <div key={label} className="flex items-center gap-2 rounded-lg border border-border/40 bg-card/60 p-3 text-sm">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />{label}
                </div>
              ))}
            </div>

            {/* FAQs Section */}
            <div className="max-w-3xl mx-auto">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground text-center mb-8">
                Frequently Asked Questions
              </h2>
              <Accordion type="single" collapsible className="w-full">
                {faqs.map((faq, index) => (
                  <AccordionItem
                    key={index}
                    value={`item-${index}`}
                    className="border-b border-border"
                  >
                    <AccordionTrigger className="text-left text-base sm:text-lg font-medium text-foreground hover:no-underline py-4">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground text-sm sm:text-base pb-4">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>
        </section>
      </main>
      {!mustSelectPlan && <Footer />}


      {/* Checkout Modal */}
      <CheckoutModal
        open={checkoutOpen}
        onOpenChange={handleCheckoutClose}
        plan={selectedPlanData || null}
      />
    </div>
  );
};

export default Plans;
