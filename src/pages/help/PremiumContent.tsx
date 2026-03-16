import { Helmet } from "react-helmet-async";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

const PremiumContent = () => {
  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Accessing Premium Content - MetsXMFanZone Help</title>
        <meta
          name="description"
          content="Learn what's included in premium plans and how to access exclusive MetsXMFanZone content."
        />
        <link rel="canonical" href="https://www.metsxmfanzone.com/help/premium-content" />
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
              <CardTitle className="text-2xl sm:text-3xl text-primary">Accessing Premium Content</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-lg prose-slate dark:prose-invert max-w-none space-y-8">
              <div className="space-y-4">
                <h2 className="text-2xl font-bold text-primary border-b pb-3">What's Included in Premium</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Premium and Annual plan members get access to exclusive content:
                </p>
              </div>

              <div className="grid gap-6">
                <div className="space-y-3 p-4 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg border-l-4 border-primary">
                  <h3 className="text-xl font-semibold text-primary">Live Streams</h3>
                  <ul className="space-y-2 text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="text-primary font-bold">•</span>
                      <span>Watch all Mets games live</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary font-bold">•</span>
                      <span>Pre-game and post-game analysis</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary font-bold">•</span>
                      <span>Special live events and Q&A sessions</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary font-bold">•</span>
                      <span>Live podcast shows</span>
                    </li>
                  </ul>
                </div>

                <div className="space-y-3 p-4 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg border-l-4 border-primary">
                  <h3 className="text-xl font-semibold text-primary">Spring Training Content</h3>
                  <ul className="space-y-2 text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="text-primary font-bold">•</span>
                      <span>Exclusive spring training game coverage</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary font-bold">•</span>
                      <span>Behind-the-scenes content</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary font-bold">•</span>
                      <span>Player interviews and insights</span>
                    </li>
                  </ul>
                </div>

                <div className="space-y-3 p-4 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg border-l-4 border-primary">
                  <h3 className="text-xl font-semibold text-primary">Premium Features</h3>
                  <ul className="space-y-2 text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="text-primary font-bold">•</span>
                      <span>HD/Full HD streaming quality</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary font-bold">•</span>
                      <span>Access to stream archives and replays</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary font-bold">•</span>
                      <span>Ad-free experience</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary font-bold">•</span>
                      <span>Priority customer support</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="space-y-6 pt-6 border-t">
                <h2 className="text-2xl font-bold text-primary">How to Upgrade</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  If you're on the Free plan and want to access premium content:
                </p>
                <ol className="space-y-3 text-muted-foreground list-decimal list-inside">
                  <li>
                    Navigate to the{" "}
                    <Link to="/pricing" className="text-primary hover:underline font-medium">
                      Pricing
                    </Link>{" "}
                    page
                  </li>
                  <li>Select either Premium ($9.99/month) or Annual ($129.99/year)</li>
                  <li>Complete the checkout process</li>
                  <li>Start enjoying premium content immediately</li>
                </ol>
              </div>

              <div className="space-y-6 pt-6 border-t">
                <h2 className="text-2xl font-bold text-primary">Free vs Premium</h2>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b-2 border-border bg-muted/50">
                        <th className="text-left p-4 font-semibold text-foreground">Feature</th>
                        <th className="text-center p-4 font-semibold text-foreground">Free</th>
                        <th className="text-center p-4 font-semibold text-foreground">Premium/Annual</th>
                      </tr>
                    </thead>
                    <tbody className="text-muted-foreground">
                      <tr className="border-b border-border">
                        <td className="p-4">Blog Articles</td>
                        <td className="text-center p-4">✓</td>
                        <td className="text-center p-4">✓</td>
                      </tr>
                      <tr className="border-b border-border">
                        <td className="p-4">Community Access</td>
                        <td className="text-center p-4">✓</td>
                        <td className="text-center p-4">✓</td>
                      </tr>
                      <tr className="border-b border-border">
                        <td className="p-4">Gallery</td>
                        <td className="text-center p-4">✓</td>
                        <td className="text-center p-4">✓</td>
                      </tr>
                      <tr className="border-b border-border bg-primary/5">
                        <td className="p-4 font-medium">Live Streams</td>
                        <td className="text-center p-4 text-destructive">✗</td>
                        <td className="text-center p-4 text-green-600">✓</td>
                      </tr>
                      <tr className="border-b border-border bg-primary/5">
                        <td className="p-4 font-medium">Spring Training</td>
                        <td className="text-center p-4 text-destructive">✗</td>
                        <td className="text-center p-4 text-green-600">✓</td>
                      </tr>
                      <tr className="border-b border-border bg-primary/5">
                        <td className="p-4 font-medium">HD Quality</td>
                        <td className="text-center p-4 text-destructive">✗</td>
                        <td className="text-center p-4 text-green-600">✓</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-4 pt-6 border-t">
                <h2 className="text-2xl font-bold text-primary">Questions</h2>
                <p className="text-muted-foreground leading-relaxed">
                  For more details about subscription plans, visit our{" "}
                  <Link to="/help/subscription-plans" className="text-primary hover:underline font-medium">
                    Subscription Plans Explained
                  </Link>{" "}
                  guide.
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

export default PremiumContent;
