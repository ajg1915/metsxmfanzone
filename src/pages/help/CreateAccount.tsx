import { Helmet } from "react-helmet-async";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
const CreateAccount = () => {
  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>How to Create an Account - MetsXMFanZone Help</title>
        <meta
          name="description"
          content="Step-by-step guide on creating your MetsXMFanZone account to access exclusive Mets content and live streams."
        />
        <link rel="canonical" href="https://www.metsxmfanzone.com/help/create-account" />
      </Helmet>
      <Navigation />
      <main className="pt-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 max-w-4xl">
          <Link to="/help-center" className="inline-flex items-center text-primary hover:underline mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Help Center
          </Link>

          <Card>
            <CardHeader>
              <CardTitle className="text-2xl sm:text-3xl text-primary">How to Create an Account</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-lg prose-slate dark:prose-invert max-w-none space-y-8">
              <div className="space-y-4">
                <h2 className="text-2xl font-bold text-primary border-b pb-3">Getting Started</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Creating your MetsXMFanZone account is quick and easy. Follow these steps:
                </p>
              </div>

              <div className="space-y-3 pl-4 border-l-4 border-primary/30">
                <h3 className="text-xl font-semibold text-primary">Step 1: Navigate to Sign Up</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Click the "Sign Up" button in the top right corner of the website or navigate directly to the
                  authentication page.
                </p>
              </div>

              <div className="space-y-3 pl-4 border-l-4 border-primary/30">
                <h3 className="text-xl font-semibold text-primary">Step 2: Enter Your Information</h3>
                <ul className="space-y-2 text-muted-foreground">
                  <li>Provide your email address</li>
                  <li>Create a secure password</li>
                  <li>Add your phone number and notification preference</li>
                </ul>
              </div>

              <div className="space-y-3 pl-4 border-l-4 border-primary/30">
                <h3 className="text-xl font-semibold text-primary">Step 3: Select Your Plan</h3>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  After creating your account, you'll be prompted to choose a subscription plan:
                </p>
                <ul className="space-y-2 text-muted-foreground">
                  <li>
                    <strong>Free Plan:</strong> Access to basic content and community features
                  </li>
                  <li>
                    <strong>Weekly Plan ($3.99/week):</strong> Full access with weekly PayPal billing
                  </li>
                  <li>
                    <strong>Monthly Plan ($9.99/month):</strong> Live streams, replays, and premium content
                  </li>
                  <li>
                    <strong>Yearly Plan ($129.99/year):</strong> Full access with yearly PayPal billing
                  </li>
                </ul>
              </div>

              <div className="space-y-3 pl-4 border-l-4 border-primary/30">
                <h3 className="text-xl font-semibold text-primary">Step 4: Complete Payment (for paid plans)</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Complete the checkout process through PayPal to activate your subscription.
                </p>
              </div>

              <div className="space-y-3 pl-4 border-l-4 border-primary/30">
                <h3 className="text-xl font-semibold text-primary">Step 5: Start Enjoying Content</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Once your account is set up, you can immediately start accessing content based on your plan tier.
                </p>
              </div>

              <div className="space-y-4 pt-6 border-t">
                <h2 className="text-2xl font-bold text-primary">Troubleshooting</h2>
                <p className="text-muted-foreground leading-relaxed">
                  If you encounter any issues during account creation, please visit our{" "}
                  <Link to="/contact" className="text-primary hover:underline font-medium">
                    Contact
                  </Link>{" "}
                  page for assistance.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
};
export default CreateAccount;
