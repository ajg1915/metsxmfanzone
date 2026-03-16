import { Helmet } from "react-helmet-async";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

const WatchStreams = () => {
  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Watching Live Streams - MetsXMFanZone Help</title>
        <meta
          name="description"
          content="Guide to watching live Mets game streams on MetsXMFanZone including device requirements and streaming tips."
        />
        <link rel="canonical" href="https://www.metsxmfanzone.com/help/watch-streams" />
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
              <CardTitle className="text-2xl sm:text-3xl text-primary">Watching Live Streams</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-lg prose-slate dark:prose-invert max-w-none space-y-8">
              <div className="space-y-4">
                <h2 className="text-2xl font-bold text-primary border-b pb-3">Requirements</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">To watch live streams on MetsXMFanZone:</p>
                <ul className="space-y-3 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold">✓</span>
                    <span>Active Premium ($9.99/month) or Annual ($129.99/year) subscription</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold">✓</span>
                    <span>Stable internet connection (minimum 5 Mbps recommended)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold">✓</span>
                    <span>Modern web browser (Chrome, Firefox, Safari, Edge)</span>
                  </li>
                </ul>
              </div>

              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-primary border-b pb-3">How to Watch</h2>

                <div className="space-y-3 pl-4 border-l-4 border-primary/30">
                  <h3 className="text-xl font-semibold text-primary">Step 1: Navigate to Live Page</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Click "Live" in the main navigation menu to access the live streaming section.
                  </p>
                </div>

                <div className="space-y-3 pl-4 border-l-4 border-primary/30">
                  <h3 className="text-xl font-semibold text-primary">Step 2: Select a Stream</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Browse available live streams and click on the stream you want to watch.
                  </p>
                </div>

                <div className="space-y-3 pl-4 border-l-4 border-primary/30">
                  <h3 className="text-xl font-semibold text-primary">Step 3: Enjoy the Stream</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    The video player will load automatically. Use the controls to adjust volume, quality, and fullscreen
                    mode.
                  </p>
                </div>
              </div>

              <div className="space-y-4 bg-yellow-50 dark:bg-yellow-900/20 p-6 rounded-lg border-l-4 border-yellow-500">
                <h2 className="text-xl font-bold text-yellow-900 dark:text-yellow-200">Device Restrictions</h2>
                <p className="text-yellow-800 dark:text-yellow-300 leading-relaxed">
                  <strong>Important:</strong> Users who access live streams from more than 2 devices or accounts will
                  face automatic penalties including account restriction, plan downgrade, or account deactivation
                  without warning.
                </p>
              </div>

              <div className="space-y-4 pt-6 border-t">
                <h2 className="text-2xl font-bold text-primary">Supported Devices</h2>
                <ul className="space-y-3 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold">•</span>
                    <span>Desktop computers (Windows, Mac, Linux)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold">•</span>
                    <span>Tablets (iPad, Android tablets)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold">•</span>
                    <span>Mobile phones (iPhone, Android)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold">•</span>
                    <span>Smart TVs with web browsers</span>
                  </li>
                </ul>
              </div>

              <div className="space-y-4 pt-6 border-t">
                <h2 className="text-2xl font-bold text-primary">Troubleshooting</h2>
                <p className="text-muted-foreground leading-relaxed">
                  If you experience issues with streaming, see our{" "}
                  <Link to="/help/playback-issues" className="text-primary hover:underline font-medium">
                    Troubleshooting Playback Issues
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

export default WatchStreams;
