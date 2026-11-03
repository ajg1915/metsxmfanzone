import { useState, useEffect } from "react";
import SEOHead from "@/components/SEOHead";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Monitor, Tv, Apple, Check, Compass, Share, SquarePlus, Bell } from "lucide-react";
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
        description="Download the MetsXMFanZone app for Android, or add it to your iPhone, iPad or computer."
        keywords="MetsXMFanZone app, Mets app, Mets Android app"
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
            <Card className={`flex flex-col gap-4 border-primary/40 p-6 sm:flex-row sm:items-center ${isApple ? "order-2" : "order-1"}`}>
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
                <Button asChild size="lg" className="gap-2" data-guide="install-android">
                  <a href="/android-app">
                    <AndroidIcon className="h-5 w-5" />
                    Download Android app
                  </a>
                </Button>
              ) : (
                <Button asChild size="lg" variant="outline" className="gap-2" data-guide="install-android">
                  <Link to={user ? "/pricing" : "/auth?mode=login"}>{user ? "See plans" : "Sign in to download"}</Link>
                </Button>
              )}
            </Card>

            {/* iPhone / iPad: add to Home Screen */}
            <Card className={`border-primary/40 p-6 ${isApple ? "order-1" : "order-2"}`} data-guide="install-iphone">
              <div className="mb-1 flex items-center gap-3">
                <div className="rounded-xl bg-white/10 p-3"><Apple className="h-7 w-7 text-white" /></div>
                <div>
                  <h2 className="text-lg font-bold">MetsXMFanZone on iPhone &amp; iPad</h2>
                  <p className="text-sm text-muted-foreground">Add it to your Home Screen in 3 taps. No App Store needed, and it updates by itself.</p>
                </div>
              </div>
              <ol className="mt-5 grid gap-3 sm:grid-cols-3">
                {[
                  { icon: Compass, title: "Open Safari", text: "Go to metsxmfanzone.com in the Safari app." },
                  { icon: Share, title: "Tap Share", text: "Tap the Share button (the square with an arrow pointing up) at the bottom of the screen." },
                  { icon: SquarePlus, title: "Add to Home Screen", text: "Scroll down, tap “Add to Home Screen”, then tap “Add”." },
                ].map((st, i) => (
                  <li key={st.title} className="relative flex items-center gap-4 rounded-xl border border-border bg-muted/20 p-4 pl-12 text-left sm:block sm:pl-4 sm:text-center">
                    <span className="absolute left-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-extrabold text-primary-foreground">{i + 1}</span>
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl sm:mx-auto bg-gradient-to-br from-[#0f4f93] to-[#07111d] ring-1 ring-primary/60">
                      <st.icon className="h-7 w-7 text-white" strokeWidth={2.2} />
                    </span>
                    <div className="min-w-0">
                      <p className="font-bold text-foreground sm:mt-3">{st.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{st.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="mt-4 flex items-start gap-3 rounded-xl bg-primary/10 p-3 text-sm text-foreground">
                <Bell className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p>Want a ping when a game goes live? Open MetsXMFanZone from your Home Screen icon, tap the menu, then tap <b>Live game alerts</b>. Alerts on iPhone need iOS 16.4 or newer.</p>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">Not seeing “Add to Home Screen”? Make sure you opened the site in Safari, not inside another app.</p>
            </Card>

            <Card className="order-3 p-6">
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

            {/* MetsXMFanZone TV: only shown to signed-in members, the code is never public */}
            {user && (
              <Card className="order-4 flex flex-col gap-4 border-primary/40 p-6 sm:flex-row sm:items-center">
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
                  <Button asChild size="lg" className="gap-2" data-guide="install-tv">
                    <a href="/tv-app">
                      <Tv className="h-5 w-5" />
                      Download TV app
                    </a>
                  </Button>
                ) : (
                  <Button asChild size="lg" variant="outline" className="gap-2" data-guide="install-tv">
                    <Link to={user ? "/pricing" : "/auth?mode=login"}>{user ? "See plans" : "Sign in to download"}</Link>
                  </Button>
                )}
              </Card>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Install;
