import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [planType, setPlanType] = useState<string>('');

  useEffect(() => {
    const verifyPayment = async () => {
      const token = searchParams.get('token');
      const subscriptionId = searchParams.get('subscription_id');

      if (!token && !subscriptionId) {
        setStatus('error');
        setTimeout(() => navigate('/plans'), 3000);
        return;
      }

      try {
        // Pass subscriptionId from PayPal's redirect (preferred) or fall back to token
        const result = await supabase.functions.invoke('verify-paypal-payment', {
          body: { subscriptionId: subscriptionId || undefined, orderId: token || undefined }
        });

        if (result.error) throw result.error;

        const confirmedPlan = result.data?.subscription?.plan_type || 'premium';
        setStatus('success');
        setPlanType(confirmedPlan);

        toast({
          title: confirmedPlan === 'free' ? "PayPal Linked! 🎉" : "Payment Successful! 🎉",
          description: confirmedPlan === 'free'
            ? "Your PayPal account is linked and your free membership is active. You were not charged."
            : "Your subscription is now active. Welcome to the premium experience!",
        });

        setTimeout(() => navigate('/'), 5000);
      } catch (error) {
        console.error('Payment verification error:', error);
        setStatus('error');
        toast({
          title: "Payment Verification Failed",
          description: "There was an issue verifying your payment. Please contact support.",
          variant: "destructive",
        });
        setTimeout(() => navigate('/plans'), 5000);
      }
    };

    verifyPayment();
  }, [searchParams, navigate, toast]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Helmet>
        <title>Payment Confirmation | MetsXMFanZone</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <Navigation />
      
      <main className="flex-1 flex items-center justify-center px-4 pt-12">
        <Card className="w-full max-w-lg border-2 border-primary">
          <CardHeader>
            <CardTitle className="text-2xl text-center text-primary">
              Payment Processing
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center py-8">
            {status === 'processing' && (
              <div className="space-y-4">
                <Loader2 className="w-16 h-16 mx-auto text-primary animate-spin" />
                <div>
                  <p className="text-lg font-semibold">Processing your payment...</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Please wait while we confirm your subscription
                  </p>
                </div>
              </div>
            )}

            {status === 'success' && (
              <div className="space-y-6">
                <div className="relative">
                  <CheckCircle2 className="w-20 h-20 mx-auto text-green-500" />
                  <Sparkles className="w-6 h-6 absolute top-0 right-1/3 text-primary animate-pulse" />
                  <Sparkles className="w-6 h-6 absolute bottom-0 left-1/3 text-primary animate-pulse delay-75" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-green-500 mb-2">
                    {planType === 'free' ? 'PayPal Linked!' : 'Payment Successful!'}
                  </h2>
                  <p className="text-muted-foreground">
                    {planType === 'free'
                      ? 'Your free membership is active and your PayPal account is linked. You were not charged.'
                      : `Your ${planType} subscription is now active`}
                  </p>
                </div>
                <div className="bg-primary/10 rounded-lg p-4 space-y-2 text-sm">
                  <p className="font-semibold">What's Next?</p>
                  <ul className="space-y-1 text-left list-disc list-inside">
                    <li>Access all premium content and live streams</li>
                    <li>Enjoy ad-free experience across the platform</li>
                    <li>Get exclusive access to game replays and highlights</li>
                    <li>Join our VIP community discussions</li>
                  </ul>
                </div>
                <Button 
                  size="lg" 
                  onClick={() => navigate('/')}
                  className="w-full"
                >
                  Go to Home
                </Button>
                <p className="text-xs text-muted-foreground">
                  Redirecting automatically in 5 seconds...
                </p>
              </div>
            )}

            {status === 'error' && (
              <div className="space-y-4">
                <div className="w-16 h-16 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
                  <span className="text-3xl">⚠️</span>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-destructive mb-2">
                    Verification Failed
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    We couldn't verify your payment. Please contact support if you were charged.
                  </p>
                </div>
                <div className="space-y-2">
                  <Button 
                    variant="outline" 
                    onClick={() => navigate('/plans')}
                    className="w-full"
                  >
                    Back to Plans
                  </Button>
                  <Button 
                    variant="ghost" 
                    onClick={() => navigate('/help-center')}
                    className="w-full"
                  >
                    Contact Support
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
      
      <Footer />
    </div>
  );
};

export default PaymentSuccess;
