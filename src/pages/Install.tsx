import { useState, useEffect } from "react";
import SEOHead from "@/components/SEOHead";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Smartphone, Monitor, Tv, Apple, Check } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { AndroidIcon } from "@/components/icons/AndroidIcon";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const Install = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const { user } = useAuth();
  const { isPremium } = useSubscription();
  const isMember = !!user && isPremium;
  // Apple devices see the iPhone steps first; everyone else sees the Android app first.
  const isApple = /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent) && "ontouchend" in document;

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) setIsInstalled(true);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const installed = () => setIsInstalled(true);

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Get the MetsXMFanZone App"
        description="Download the MetsXMFanZone app for Android, or add it to your iPhone, iPad or computer. Paid members get TV mode on smart TVs."
        keywords="MetsXMFanZone app, Mets app, Mets Android app, Mets TV app"
        canonical="https://www.metsxmfanzone.com/install"
      />
      <Navigation />
      <main className="pt-24 pb-16">
        <div className="container mx-auto max-w-3xl px-4 sm:px-6">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-10 text-center">
            <h1 className="text-3xl font-bold sm:text-4xl">Get the MetsXMFanZone app</h1>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              Live games, news and the podcast in one place, with alerts when the Mets play.
            </p>
          </motion.div>

          {isInstalled && (
            <Card className="mb-6 flex items-center justify-center gap-3 border-green-500/30 bg-green-500/10 p-5">
              <Check className="h-5 w-5 text-green-500" />
              <span className="font-semibold text-green-500">The app is installed on this device</span>
            </Card>
          )}

          <div className="grid gap-5">
            {/* Android: the APK we built */}
            <Card className={`flex flex-col gap-4 border-primary/40 p-6 sm:flex-row sm:items-center ${isApple ? "order-2" : ""}`}>
              <div className="flex items-center gap-4 flex-1">
                <div className="rounded-xl bg-[#3ddc84]/15 p-3">
                  <AndroidIcon className="h-7 w-7 text-[#3ddc84]" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">MetsXMFanZone app for Android</h2>
                  <p className="text-sm text-muted-foreground">
                    {isMember
                      ? "Download our Android app, open it, and allow installs from your browser when asked."
                      : "Our Android app is included with Weekly, Monthly and Yearly plans."}
                  </p>
                </div>
              </div>
              {isMember ? (
                <Button asChild size="lg" className="gap-2">
                  <a href="/android-app">
                    <AndroidIcon className="h-5 w-5" />
                    Download Android app
                  </a>
                </Button>
              ) : (
                <Button asChild size="lg" variant="outline" className="gap-2">
                  <Link to={user ? "/pricing" : "/auth?mode=login"}>{user ? "See plans" : "Sign in to download"}</Link>
                </Button>
              )}
            </Card>

            {/* iPhone / iPad and computer: install from the browser */}
            <div className={`grid gap-5 sm:grid-cols-2 ${isApple ? "order-1" : ""}`}>
              <Card className="p-6">
                <div className="mb-3 flex items-center gap-3">
                  <Apple className="h-6 w-6 text-primary" />
                  <h2 className="text-lg font-bold">iPhone & iPad</h2>
                </div>
                <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
                  <li>Open metsxmfanzone.com in Safari</li>
                  <li>Tap Share, then "Add to Home Screen"</li>
                  <li>Tap "Add"</li>
                </ol>
              </Card>

              <Card className="p-6">
                <div className="mb-3 flex items-center gap-3">
                  <Monitor className="h-6 w-6 text-primary" />
                  <h2 className="text-lg font-bold">Computer</h2>
                </div>
                {deferredPrompt ? (
                  <Button onClick={handleInstall} className="gap-2">
                    <Download className="h-4 w-4" />
                    Install now
                  </Button>
                ) : (
                  <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
                    <li>Open metsxmfanzone.com in Chrome or Edge</li>
                    <li>Click the install icon in the address bar</li>
                  </ol>
                )}
              </Card>
            </div>

            {/* MetsXMFanZone TV: its own app, separate from the phone app */}
            <Card className="order-3 flex flex-col gap-4 border-primary/40 p-6 sm:flex-row sm:items-center">
              <div className="flex flex-1 items-center gap-4">
                <div className="rounded-xl bg-primary/15 p-3">
                  <Tv className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">MetsXMFanZone TV app</h2>
                  <p className="text-sm text-muted-foreground">
                    A separate app for Fire TV, Android TV and Google TV. On your TV, open the Downloader app and enter code{" "}
                    <b className="text-foreground">6750144</b>.
                  </p>
                </div>
              </div>
              {isMember ? (
                <Button asChild size="lg" className="gap-2">
                  <a href="/tv-app">
                    <Tv className="h-5 w-5" />
                    Download TV app
                  </a>
                </Button>
              ) : (
                <Button asChild size="lg" variant="outline" className="gap-2">
                  <Link to={user ? "/pricing" : "/auth?mode=login"}>{user ? "See plans" : "Sign in to download"}</Link>
                </Button>
              )}
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Install;
