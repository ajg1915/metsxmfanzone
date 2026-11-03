import { Helmet } from "react-helmet-async";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const CookiesData = () => (
  <div className="min-h-screen bg-background">
    <Helmet>
      <title>Cookies & Your Data - MetsXMFanZone Help Center</title>
      <meta name="description" content="How MetsXMFanZone uses cookies and handles your data. We never sell your personal information." />
      <link rel="canonical" href="https://www.metsxmfanzone.com/help/cookies-data" />
    </Helmet>
    <Navigation />
    <main className="pt-12">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 max-w-4xl">
        <Link to="/help-center" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Help Center
        </Link>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl sm:text-3xl text-primary">Cookies & Your Data</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 text-muted-foreground">
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-foreground">
              <p className="font-semibold">We do not sell your data. Not now, not ever.</p>
              <p className="mt-1 text-sm text-muted-foreground">Nobody pays us for your information, and we don't hand your personal details to advertisers or data brokers.</p>
            </div>
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">What we collect</h2>
              <p>Only what we need to run the site:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Your account details (name, email, and what you add to your profile).</li>
                <li>Your membership status, so we know which content you can watch.</li>
                <li>Your activity in the community, such as posts, comments and reactions.</li>
                <li>Basic visit information such as pages viewed and device type, to see what fans enjoy and fix problems.</li>
              </ul>
            </section>
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">Cookies and similar storage</h2>
              <p>Cookies and your browser's local storage keep the site working and remember your choices:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Essential:</strong> keep you signed in and remember things like your tour progress and display settings. The site needs these to work.</li>
                <li><strong>Analytics:</strong> we use Google Analytics to count visits and see which pages are popular. This is general usage data, not a profile we sell.</li>
                <li><strong>Notifications:</strong> if you turn on push notifications, a browser token is stored so we can send you Mets alerts. You can turn them off in your browser or device settings at any time.</li>
              </ul>
              <p>We do not use cookies to build advertising profiles of you.</p>
            </section>
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">Who else handles data</h2>
              <p>A few services help us run the site, and they only receive what they need to do their job:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Payment processors (such as PayPal) handle your payment. We never see or store your full card number.</li>
                <li>Google Analytics provides visit statistics.</li>
                <li>Our hosting and database providers store the site's data securely.</li>
              </ul>
              <p>They act on our behalf and are not allowed to sell your data either.</p>
            </section>
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">Your choices</h2>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Block or delete cookies in your browser settings. The site may not keep you signed in if you do.</li>
                <li>Opt out of Google Analytics with Google's browser add-on or your browser's privacy features.</li>
                <li>Ask us to see, correct or delete your account data by using the <Link to="/contact" className="text-primary underline">contact page</Link>.</li>
                <li>Cancel your membership any time from your account settings.</li>
              </ul>
            </section>
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">More detail</h2>
              <p>Read our full <Link to="/privacy" className="text-primary underline">Privacy Policy</Link> and <Link to="/terms" className="text-primary underline">Terms</Link>. If we ever change how we handle your data, we will update this page.</p>
            </section>
          </CardContent>
        </Card>
      </div>
    </main>
    <Footer />
  </div>
);

export default CookiesData;
