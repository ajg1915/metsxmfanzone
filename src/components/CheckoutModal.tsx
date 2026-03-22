import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tag, X, Shield, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import metsLogo from "@/assets/metsxmfanzone-logo.png";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

interface Plan {
  id: string;
  name: string;
  price: string;
  priceValue: number;
  period: string;
  billingNote?: string;
  description: string;
  features: string[];
}

interface CheckoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: Plan | null;
}

const CheckoutModal = ({ open, onOpenChange, plan }: CheckoutModalProps) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showPromoCode, setShowPromoCode] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubscribe = async () => {
    if (!plan) return;

    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to subscribe",
        variant: "destructive",
      });
      onOpenChange(false);
      navigate("/auth");
      return;
    }

    setIsProcessing(true);

    try {
      // Handle free plan - create subscription directly
      if (plan.id === "free") {
        const springTrainingEnd = new Date("2026-03-26T23:59:59Z");
        const { error } = await supabase
          .from("subscriptions")
          .insert({
            user_id: user.id,
            plan_type: "free",
            status: "active",
            amount: 0,
            currency: "USD",
            start_date: new Date().toISOString(),
            end_date: springTrainingEnd.toISOString(),
            payment_method: "free",
          });

        if (error) throw error;

        try {
          await supabase.functions.invoke("notify-admin-new-member", {
            body: {
              userId: user.id,
              planType: "free",
              amount: "$0.00",
              source: "Free Plan",
            },
          });
        } catch (notifyError) {
          console.error("Error notifying admins:", notifyError);
        }

        toast({
          title: "Welcome!",
          description: "Your free plan has been activated",
        });
        onOpenChange(false);
        navigate("/");
        return;
      }

      // PayPal checkout for paid plans
      toast({
        title: "Processing...",
        description: "Redirecting to PayPal",
      });

      const { data, error } = await supabase.functions.invoke("create-paypal-order", {
        body: { planType: plan.id, promoCode: appliedPromo, returnOrigin: window.location.origin },
      });

      if (error) throw error;

      if (data?.approvalUrl) {
        window.location.href = data.approvalUrl;
      } else {
        toast({
          title: "Error",
          description: "Failed to create payment session. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error creating payment:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to initiate payment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApplyPromo = () => {
    if (promoCode.trim()) {
      setAppliedPromo(promoCode.trim().toUpperCase());
      toast({
        title: "Promo Code Applied",
        description: `Code "${promoCode.toUpperCase()}" has been applied`,
      });
      setShowPromoCode(false);
    }
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoCode("");
  };

  if (!plan) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onOpenChange(false)}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <img src={metsLogo} alt="MetsXM" className="h-8 w-8 object-contain" />
            <DialogTitle className="text-xl font-semibold">Checkout</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Plan Summary */}
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="font-semibold text-foreground">{plan.name} Plan</h3>
                <p className="text-sm text-muted-foreground">{plan.description}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-foreground">{plan.price}</p>
                <p className="text-xs text-muted-foreground">{plan.period}</p>
              </div>
            </div>
            {plan.billingNote && (
              <p className="text-xs text-muted-foreground">{plan.billingNote}</p>
            )}
          </div>

          <Separator />

          {/* Promo Code Section */}
          <div>
            {appliedPromo ? (
              <div className="flex items-center justify-between bg-primary/10 p-3 rounded-lg">
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium text-primary">{appliedPromo}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRemovePromo}
                  className="h-7 w-7 p-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : showPromoCode ? (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter promo code"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    className="h-10"
                    onKeyDown={(e) => e.key === "Enter" && handleApplyPromo()}
                  />
                  <Button onClick={handleApplyPromo} className="h-10 px-4">
                    Apply
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPromoCode(false)}
                  className="text-xs text-muted-foreground"
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPromoCode(true)}
                className="w-full justify-start h-10"
              >
                <Tag className="w-4 h-4 mr-2" />
                Add promotion code
              </Button>
            )}
          </div>

          <Separator />

          {/* Order Summary */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="text-foreground">{plan.price}</span>
            </div>
            {appliedPromo && (
              <div className="flex justify-between text-sm">
                <span className="text-primary">Promo discount</span>
                <span className="text-primary">-$0.00</span>
              </div>
            )}
            <Separator className="my-2" />
            <div className="flex justify-between font-semibold text-base">
              <span className="text-foreground">Total due today</span>
              <span className="text-foreground">{plan.price}</span>
            </div>
          </div>

          <Separator />

          {/* Subscribe Button */}
          <Button
            className="w-full h-12 text-base font-semibold"
            size="lg"
            onClick={handleSubscribe}
            disabled={isProcessing}
          >
            {isProcessing
              ? "Processing..."
              : plan.priceValue === 0
              ? "Activate Free Plan"
              : `Pay with PayPal — ${plan.price}`}
          </Button>

          {/* Security Badge */}
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Shield className="w-4 h-4" />
            <span>Secure checkout powered by PayPal</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CheckoutModal;
