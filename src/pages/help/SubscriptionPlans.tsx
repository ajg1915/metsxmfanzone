import { Helmet } from "react-helmet-async";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

const SubscriptionPlans = () => {
  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Subscription Plans Explained - MetsXMFanZone Help</title>
        <meta
          name="description"
          content="Compare MetsXMFanZone Free, Weekly, Monthly, and Yearly memberships."
        />
        <link rel="canonical" href="https://www.metsxmfanzone.com/help/subscription-plans" />
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
              <CardTitle className="text-2xl sm:text-3xl text-primary">Subscription Plans Explained</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-lg prose-slate dark:prose-invert max-w-none space-y-8">
              <div className="space-y-4">
                <h2 className="text-2xl font-bold text-primary border-b pb-3">Available Plans</h2>
                <p className="text-muted-foreground leading-relaxed">
                  MetsXMFanZone offers four membership choices:
                </p>
              </div>

              <div className="grid gap-6">
                <div className="p-6 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 rounded-lg border-2 border-border">
                  <h3 className="text-2xl font-bold text-primary mb-2">Free Plan</h3>
                  <p className="text-3xl font-bold text-primary mb-4">
                    $0<span className="text-lg text-muted-foreground">/month</span>
                  </p>
                  <ul className="space-y-2 text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="text-green-600">✓</span>
                      <span>Access to all blog articles</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-600">✓</span>
                      <span>Community posting and comments</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-600">✗</span>
                      <span>Live game streams</span>
                    </li>
                  </ul>
                </div>

                <div className="p-6 rounded-lg border-2 border-border bg-card">
                  <h3 className="text-2xl font-bold text-primary mb-2">Weekly Plan</h3>
                  <p className="text-3xl font-bold text-primary mb-4">$3.99<span className="text-lg text-muted-foreground">/week</span></p>
                  <ul className="space-y-2 text-muted-foreground"><li>✓ Everything in Free</li><li>✓ Live streams and game replays</li><li>✓ Premium content and HD viewing</li></ul>
                </div>

                <div className="p-6 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg border-2 border-primary">
                  <h3 className="text-2xl font-bold text-primary mb-2">Monthly Plan</h3>
                  <p className="text-3xl font-bold text-primary mb-4">
                    $9.99<span className="text-lg text-muted-foreground">/month</span>
                  </p>
                  <ul className="space-y-2 text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="text-green-600">✓</span>
                      <span>Everything in Free plan</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-600">✓</span>
                      <span>Access to all live game streams</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-600">✓</span>
                      <span>HD and Full HD quality</span>
                    </li>
                  </ul>
                </div>

                <div className="p-6 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900 dark:to-green-800 rounded-lg border-2 border-green-500">
                  <h3 className="text-2xl font-bold text-primary mb-2">Yearly Plan</h3>
                  <p className="text-3xl font-bold text-primary mb-4">
                    $129.99<span className="text-lg text-muted-foreground">/year</span>
                  </p>
                  <ul className="space-y-2 text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="text-green-600">✓</span>
                       <span>Everything in Monthly plan</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-600">✓</span>
                       <span>One convenient yearly payment</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-600">✓</span>
                      <span>Exclusive annual member perks</span>
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default SubscriptionPlans;
