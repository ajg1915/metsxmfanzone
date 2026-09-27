import { Helmet } from "react-helmet-async";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const ReturnPolicy = () => {
  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Return Policy - MetsXMFanZone Help Center</title>
        <meta
          name="description"
          content="Learn about MetsXMFanZone's return and refund policy for Memberships and merchandise purchases."
        />
        <link rel="canonical" href="https://www.metsxmfanzone.com/help/return-policy" />
      </Helmet>
      <Navigation />
      <main className="pt-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 max-w-4xl">
          <Link
            to="/help-center"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Help Center
          </Link>

          <Card>
            <CardHeader>
              <CardTitle className="text-2xl sm:text-3xl text-primary">Return Policy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 text-muted-foreground">
              <section>
                <h2 className="text-xl font-semibold text-foreground mb-3">Membership Subscription Plans</h2>
                <div className="space-y-3">
                  <p>
                    MetsXMFanZone Membership plans are billed on a recurring basis (weekly, monthly or annually). Due to the
                    nature of digital content and immediate access granted upon membership, we generally do not offer
                    refunds for Membership fees.
                  </p>
                  <p>
                    However, we understand that special circumstances may arise. If you believe you're entitled to a
                    refund, please contact our support team within 1 days of your purchase.
                  </p>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-3">Cancellation Policy</h2>
                <div className="space-y-3">
                  <p>
                    You may cancel your Membership subscription at any time through your account settings or by
                    contacting support. Upon cancellation:
                  </p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>You will Not retain access to premium content if you cancel within 2 days</li>
                    <li>No further charges will be made after the current period ends</li>
                    <li>You can reactivate your subscription at any time</li>
                  </ul>
                  <p className="text-sm">
                    Learn more about{" "}
                    <Link to="/help/cancel-subscription" className="text-primary hover:underline">
                      how to cancel your Membership subscription
                    </Link>
                    .
                  </p>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-3">NY Sports Streaming Package</h2>
                <div className="space-y-3">
                  <p>
                    The NY Sports Streaming package is a separate $19.99/month subscription covering only the New York
                    Giants, Jets, Knicks, Rangers, Islanders and Brooklyn Nets, plus our 24/7 sports network streams. It is
                    billed separately from your Mets membership, and the same refund policy above applies to it.
                  </p>
                  <p>
                    You can cancel NY Sports Streaming anytime from your Member Center without affecting your Mets
                    membership, and cancelling your Mets membership does not cancel NY Sports Streaming.
                  </p>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-3">Merchandise Returns</h2>
                <div className="space-y-3">
                  <p>For physical merchandise purchased through our store:</p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>Returns are not accepted within 3 business days of delivery</li>
                    <li>Items must be unworn, unused, and in original condition with tags attached</li>
                    <li>Return shipping costs are the responsibility of the customer unless the item is defective</li>
                    <li> No Refunds unless you email us within 72 hours. </li>
                  </ul>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-3">Defective or Damaged Items</h2>
                <p>
                  If you receive a defective or damaged item, please contact us immediately with photos of the issue. We
                  will provide a replacement or full refund, including return shipping costs.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-3">Processing Returns</h2>
                <div className="space-y-3">
                  <p>To initiate a return:</p>
                  <ol className="list-decimal list-inside space-y-2 ml-4">
                    <li>
                      Contact our support team via the{" "}
                      <Link to="/contact" className="text-primary hover:underline">
                        contact page
                      </Link>
                    </li>
                    <li>Provide your order number and reason for return</li>
                    <li>Wait for return authorization and instructions</li>
                    <li>Ship the item back using the provided instructions</li>
                  </ol>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-3">Questions?</h2>
                <p>
                  If you have any questions about our return policy or need assistance with a return, please don't
                  hesitate to{" "}
                  <Link to="/contact" className="text-primary hover:underline">
                    contact our support team
                  </Link>
                  . We're here to help!
                </p>
              </section>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ReturnPolicy;
