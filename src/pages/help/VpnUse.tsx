import { Helmet } from "react-helmet-async";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const VpnUse = () => (
  <div className="min-h-screen bg-background">
    <Helmet>
      <title>Using a VPN - MetsXMFanZone Help Center</title>
      <meta name="description" content="What to expect when you use a VPN with MetsXMFanZone." />
      <link rel="canonical" href="https://www.metsxmfanzone.com/help/vpn" />
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
            <CardTitle className="text-2xl sm:text-3xl text-primary">Using a VPN</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 text-muted-foreground">
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">Can I use a VPN?</h2>
              <p>You can use MetsXMFanZone with a VPN, but some features may not work as expected.</p>
            </section>
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">What to know</h2>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Some live games and streams are limited by region because of league and broadcaster rules (blackouts). A VPN can change where the site thinks you are, which may block or change what you can watch.</li>
                <li>VPNs can slow your connection, which can cause buffering and lower video quality.</li>
                <li>If a stream won't load, turn the VPN off and refresh the page.</li>
                <li>We don't use a VPN to track you. We never sell your location or other data. See <Link to="/help/cookies-data" className="text-primary underline">Cookies &amp; Your Data</Link>.</li>
              </ul>
            </section>
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">Still stuck?</h2>
              <p>Try our <Link to="/help/playback-issues" className="text-primary underline">playback troubleshooting</Link> guide or the <Link to="/contact" className="text-primary underline">contact page</Link>.</p>
            </section>
          </CardContent>
        </Card>
      </div>
    </main>
    <Footer />
  </div>
);

export default VpnUse;
