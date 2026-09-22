import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Shield, ArrowLeft } from "lucide-react";
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
        localStorage.setItem("pending_signup_plan", plan.id);
        navigate("/auth?mode=signup");
      return;
    }

    setIsProcessing(true);

    try {
      if (plan.id !== "premium" && plan.id !== "annual" && plan.id !== "weekly") {
        toast({
          title: "Paid plan required",
          description: "Only paid memberships can be activated.",
          variant: "destructive",
        });
        onOpenChange(false);
        return;
      }

      // PayPal checkout for paid plans
      toast({
        title: "Processing...",
        description: "Redirecting to PayPal",
      });

      const { data, error } = await supabase.functions.invoke("create-paypal-order", {
        body: { planType: plan.id, promoCode: null, returnOrigin: window.location.origin },
      });

      if (error || data?.error) throw new Error("checkout_failed");

      if (data?.approvalUrl) {
        window.location.href = data.approvalUrl;
      } else {
        toast({
          title: "Transaction could not be completed",
          description: "Please try again in a moment.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Transaction could not be completed",
        description: "Please try again or contact support.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
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

          {/* Order Summary */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="text-foreground">{plan.price}</span>
            </div>
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
