import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

const PayPalSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');

  useEffect(() => {
    const verifyPayment = async () => {
      const subscriptionId = searchParams.get('subscription_id') || searchParams.get('token');
      
      if (!subscriptionId) {
        setStatus('error');
        toast({
          title: "Error",
          description: "Invalid payment session",
          variant: "destructive",
        });
        setTimeout(() => navigate('/plans'), 3000);
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke('verify-paypal-payment', {
          body: { subscriptionId },
        });

        if (error) throw error;

        if (data.success) {
          setStatus('success');
          toast({
            title: "Payment Successful!",
            description: "Your subscription has been activated.",
          });
          setTimeout(() => navigate('/claim-shirt?from=signup'), 2000);
        } else {
          setStatus('error');
          toast({
            title: "Payment Failed",
            description: "There was an issue processing your payment.",
            variant: "destructive",
          });
          setTimeout(() => navigate('/plans'), 3000);
        }
      } catch (error) {
        console.error('Error verifying payment:', error);
        setStatus('error');
        toast({
          title: "Error",
          description: "Failed to verify payment. Please contact support.",
          variant: "destructive",
        });
        setTimeout(() => navigate('/payment-error'), 1000);
      }
    };

    verifyPayment();
  }, [searchParams, navigate, toast]);

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="pt-12">
        <section className="py-16">
          <div className="container mx-auto px-4 max-w-2xl">
            <Card className="border-2 border-primary">
              <CardHeader>
                <CardTitle className="text-center text-primary">
                  Payment Processing
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center py-8">
                {status === 'processing' && (
                  <>
                    <Loader2 className="w-16 h-16 text-primary animate-spin mb-4" />
                    <p className="text-foreground text-center">
                      Processing your payment...
                    </p>
                  </>
                )}
                
                {status === 'success' && (
                  <>
                    <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
                    <p className="text-foreground text-center font-semibold text-xl mb-2">
                      Payment Successful!
                    </p>
                    <p className="text-muted-foreground text-center">
                      Redirecting to your dashboard...
                    </p>
                  </>
                )}
                
                {status === 'error' && (
                  <>
                    <XCircle className="w-16 h-16 text-red-500 mb-4" />
                    <p className="text-foreground text-center font-semibold text-xl mb-2">
                      Payment Failed
                    </p>
                    <p className="text-muted-foreground text-center">
                      Redirecting back to plans...
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default PayPalSuccess;
