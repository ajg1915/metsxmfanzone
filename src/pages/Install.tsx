import { useState, useEffect } from "react";
import SEOHead from "@/components/SEOHead";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Download, 
  Smartphone, 
  Monitor, 
  Tv, 
  Apple, 
  Chrome,
  Share,
  Plus,
  Menu,
  MoreVertical,
  ArrowDown,
  Check,
  Wifi,
  Bell,
  Zap,
  Globe
} from "lucide-react";
import { motion } from "framer-motion";
import apkAsset from "@/assets/metsxmfanzone-apk.asset.json";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const Install = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    // Detect platform
    const ua = navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua));
    setIsAndroid(/Android/.test(ua));
    setIsMac(/Mac/.test(ua) && !/iPhone|iPad|iPod/.test(ua));

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener('appinstalled', () => setIsInstalled(true));

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
    }
  };

  const features = [
    { icon: Zap, title: "Lightning Fast", description: "Loads instantly, even on slow networks" },
    { icon: Wifi, title: "Works Offline", description: "Access cached content without internet" },
    { icon: Bell, title: "Push Notifications", description: "Get alerts for live games and updates" },
    { icon: Globe, title: "Full Screen", description: "Immersive experience without browser UI" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Install MetsXMFanZone App - Mobile, Desktop & TV"
        description="Install MetsXMFanZone on your phone, computer, or smart TV for the best Mets fan experience with offline access and push notifications."
        keywords="MetsXMFanZone app, install Mets app, Mets mobile app, Mets TV app"
        canonical="https://www.metsxmfanzone.com/install"
      />
      <Navigation />
      <main className="pt-20 pb-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
          {/* Hero Section */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-10"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary font-medium text-sm mb-4">
              <Download className="h-4 w-4" />
              Install the App
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
              Get <span className="text-primary">MetsXMFanZone</span> on Any Device
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Install our app for a faster, fuller experience with offline access, push notifications, and instant updates
            </p>
          </motion.div>

          {/* Quick Install Button */}
          {deferredPrompt && !isInstalled && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-10"
            >
              <Card className="p-6 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-primary/30">
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="p-4 rounded-2xl bg-primary/20">
                    <Download className="h-8 w-8 text-primary" />
                  </div>
                  <div className="flex-1 text-center sm:text-left">
                    <h2 className="text-xl font-bold mb-1">Ready to Install</h2>
                    <p className="text-muted-foreground text-sm">Your browser supports direct installation</p>
                  </div>
                  <Button onClick={handleInstall} size="lg" className="gap-2 shadow-lg shadow-primary/20">
                    <Download className="h-5 w-5" />
                    Install Now
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}

          {isInstalled && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-10"
            >
              <Card className="p-6 bg-gradient-to-r from-green-500/10 via-green-500/5 to-transparent border-green-500/30">
                <div className="flex items-center gap-4 justify-center">
                  <div className="p-3 rounded-full bg-green-500/20">
                    <Check className="h-6 w-6 text-green-500" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-green-500">App Installed!</h2>
                    <p className="text-muted-foreground text-sm">You're already using the installed version</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          {/* Features Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="p-4 h-full text-center hover:border-primary/30 transition-colors">
                  <feature.icon className="h-6 w-6 text-primary mx-auto mb-2" />
                  <h3 className="font-semibold text-sm mb-1">{feature.title}</h3>
                  <p className="text-xs text-muted-foreground">{feature.description}</p>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Installation Instructions Tabs */}
          <Tabs defaultValue={isIOS ? "ios" : isAndroid ? "android" : "desktop"} className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-6">
              <TabsTrigger value="ios" className="gap-2">
                <Apple className="h-4 w-4" />
                <span className="hidden sm:inline">iPhone/iPad</span>
                <span className="sm:hidden">iOS</span>
              </TabsTrigger>
              <TabsTrigger value="android" className="gap-2">
                <Smartphone className="h-4 w-4" />
                <span className="hidden sm:inline">Android</span>
                <span className="sm:hidden">Android</span>
              </TabsTrigger>
              <TabsTrigger value="desktop" className="gap-2">
                <Monitor className="h-4 w-4" />
                <span className="hidden sm:inline">Desktop</span>
                <span className="sm:hidden">PC</span>
              </TabsTrigger>
              <TabsTrigger value="tv" className="gap-2">
                <Tv className="h-4 w-4" />
                <span className="hidden sm:inline">Smart TV</span>
                <span className="sm:hidden">TV</span>
              </TabsTrigger>
            </TabsList>

            {/* iOS Instructions */}
            <TabsContent value="ios">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Apple className="h-6 w-6 text-primary" />
                    </div>
                    Install on iPhone or iPad
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <p className="text-muted-foreground">
                    Safari on iOS doesn't show an install button, but you can add MetsXMFanZone to your home screen:
                  </p>
                  
                  <div className="space-y-4">
                    <div className="flex gap-4 p-4 rounded-lg bg-muted/50">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">1</div>
                      <div>
                        <h4 className="font-semibold mb-1">Open in Safari</h4>
                        <p className="text-sm text-muted-foreground">Make sure you're viewing metsxmfanzone.com in Safari (not Chrome or another browser)</p>
                      </div>
                    </div>
                    
                    <div className="flex gap-4 p-4 rounded-lg bg-muted/50">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">2</div>
                      <div>
                        <h4 className="font-semibold mb-1 flex items-center gap-2">
                          Tap the Share button
                          <Share className="h-4 w-4 text-primary" />
                        </h4>
                        <p className="text-sm text-muted-foreground">Find the Share icon at the bottom of the screen (square with arrow pointing up)</p>
                      </div>
                    </div>
                    
                    <div className="flex gap-4 p-4 rounded-lg bg-muted/50">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">3</div>
                      <div>
                        <h4 className="font-semibold mb-1 flex items-center gap-2">
                          Select "Add to Home Screen"
                          <Plus className="h-4 w-4 text-primary" />
                        </h4>
                        <p className="text-sm text-muted-foreground">Scroll down in the share menu and tap "Add to Home Screen"</p>
                      </div>
                    </div>
                    
                    <div className="flex gap-4 p-4 rounded-lg bg-muted/50">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">4</div>
                      <div>
                        <h4 className="font-semibold mb-1">Tap "Add"</h4>
                        <p className="text-sm text-muted-foreground">Confirm by tapping "Add" in the top right corner. The app icon will appear on your home screen!</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Android Instructions */}
            <TabsContent value="android">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Smartphone className="h-6 w-6 text-primary" />
                    </div>
                    Install on Android
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Direct APK Download */}
                  <div className="p-5 rounded-xl bg-gradient-to-r from-primary/15 via-primary/5 to-transparent border border-primary/30">
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                      <div className="p-3 rounded-xl bg-primary/20">
                        <Download className="h-7 w-7 text-primary" />
                      </div>
                      <div className="flex-1 text-center sm:text-left">
                        <h3 className="font-bold text-lg mb-1">Download the Android App (APK)</h3>
                        <p className="text-sm text-muted-foreground">
                          Get the native Android app directly. Tap download, open the file, and allow installation from your browser when prompted.
                        </p>
                      </div>
                      <Button asChild size="lg" className="gap-2 shadow-lg shadow-primary/20">
                        <a href={apkAsset.url} download="MetsXMFanZone.apk">
                          <Download className="h-5 w-5" />
                          Download APK
                        </a>
                      </Button>
                    </div>
                  </div>

                  {deferredPrompt ? (
                    <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                      <p className="text-green-500 font-medium mb-3">Your browser supports direct installation!</p>
                      <Button onClick={handleInstall} variant="outline" className="gap-2">
                        <Download className="h-4 w-4" />
                        Install PWA Instead
                      </Button>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">
                      Prefer the browser version? Follow these steps in Chrome to install it as an app:
                    </p>
                  )}
                  
                  <div className="space-y-4">
                    <div className="flex gap-4 p-4 rounded-lg bg-muted/50">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">1</div>
                      <div>
                        <h4 className="font-semibold mb-1">Open in Chrome</h4>
                        <p className="text-sm text-muted-foreground">Visit metsxmfanzone.com in Google Chrome</p>
                      </div>
                    </div>
                    
                    <div className="flex gap-4 p-4 rounded-lg bg-muted/50">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">2</div>
                      <div>
                        <h4 className="font-semibold mb-1 flex items-center gap-2">
                          Tap the menu
                          <MoreVertical className="h-4 w-4 text-primary" />
                        </h4>
                        <p className="text-sm text-muted-foreground">Tap the three dots in the top right corner</p>
                      </div>
                    </div>
                    
                    <div className="flex gap-4 p-4 rounded-lg bg-muted/50">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">3</div>
                      <div>
                        <h4 className="font-semibold mb-1 flex items-center gap-2">
                          Select "Install app" or "Add to Home screen"
                          <ArrowDown className="h-4 w-4 text-primary" />
                        </h4>
                        <p className="text-sm text-muted-foreground">Look for the install option in the menu</p>
                      </div>
                    </div>
                    
                    <div className="flex gap-4 p-4 rounded-lg bg-muted/50">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">4</div>
                      <div>
                        <h4 className="font-semibold mb-1">Confirm Installation</h4>
                        <p className="text-sm text-muted-foreground">Tap "Install" to confirm. The app will be added to your home screen and app drawer!</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Desktop Instructions */}
            <TabsContent value="desktop">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Monitor className="h-6 w-6 text-primary" />
                    </div>
                    Install on Desktop (Windows, Mac, Linux)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {deferredPrompt ? (
                    <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                      <p className="text-green-500 font-medium mb-3">Your browser supports direct installation!</p>
                      <Button onClick={handleInstall} className="gap-2">
                        <Download className="h-4 w-4" />
                        Install Now
                      </Button>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">
                      Install MetsXMFanZone as a desktop app using Chrome or Edge:
                    </p>
                  )}
                  
                  <div className="space-y-4">
                    <div className="flex gap-4 p-4 rounded-lg bg-muted/50">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">1</div>
                      <div>
                        <h4 className="font-semibold mb-1 flex items-center gap-2">
                          Open in Chrome or Edge
                          <Chrome className="h-4 w-4 text-primary" />
                        </h4>
                        <p className="text-sm text-muted-foreground">Visit metsxmfanzone.com in Google Chrome or Microsoft Edge</p>
                      </div>
                    </div>
                    
                    <div className="flex gap-4 p-4 rounded-lg bg-muted/50">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">2</div>
                      <div>
                        <h4 className="font-semibold mb-1">Look for the Install Icon</h4>
                        <p className="text-sm text-muted-foreground">In the address bar (right side), look for a small install icon (computer with download arrow) or a ⊕ plus icon</p>
                      </div>
                    </div>
                    
                    <div className="flex gap-4 p-4 rounded-lg bg-muted/50">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">3</div>
                      <div>
                        <h4 className="font-semibold mb-1 flex items-center gap-2">
                          Alternative: Use Browser Menu
                          <Menu className="h-4 w-4 text-primary" />
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          Click the three dots menu → "Install MetsXMFanZone" or "More tools" → "Create shortcut" (check "Open as window")
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex gap-4 p-4 rounded-lg bg-muted/50">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">4</div>
                      <div>
                        <h4 className="font-semibold mb-1">Launch from Desktop</h4>
                        <p className="text-sm text-muted-foreground">The app will be added to your Start Menu (Windows), Applications folder (Mac), or app launcher (Linux)</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TV Instructions */}
            <TabsContent value="tv">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Tv className="h-6 w-6 text-primary" />
                    </div>
                    Use on Smart TV
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="p-4 rounded-lg bg-primary/10 border border-primary/30">
                    <p className="text-sm">
                      <strong>Pro Tip:</strong> When you open MetsXMFanZone on your Smart TV, it automatically switches to a TV-optimized interface designed for remote control navigation!
                    </p>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Samsung/Tizen */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-primary">Samsung Smart TV</h4>
                      <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                        <li>Open the built-in web browser</li>
                        <li>Navigate to <strong>metsxmfanzone.com</strong></li>
                        <li>Press the ★ (Star) button on your remote</li>
                        <li>Select "Add to Bookmarks"</li>
                        <li>Access anytime from your bookmarks</li>
                      </ol>
                    </div>

                    {/* LG/WebOS */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-primary">LG Smart TV (WebOS)</h4>
                      <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                        <li>Open the LG Web Browser</li>
                        <li>Go to <strong>metsxmfanzone.com</strong></li>
                        <li>Click the ☆ bookmark icon in the address bar</li>
                        <li>Add to your bookmarks/favorites</li>
                        <li>Pin to home screen if available</li>
                      </ol>
                    </div>

                    {/* Fire TV */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-primary">Amazon Fire TV</h4>
                      <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                        <li>Download "Silk Browser" from the app store</li>
                        <li>Open Silk and go to <strong>metsxmfanzone.com</strong></li>
                        <li>Press the menu button and select "Add to Favorites"</li>
                        <li>Or select "Add Page to Home"</li>
                      </ol>
                    </div>

                    {/* Roku */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-primary">Roku TV</h4>
                      <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                        <li>Install "Web Browser X" from the Roku Channel Store</li>
                        <li>Open the browser</li>
                        <li>Navigate to <strong>metsxmfanzone.com</strong></li>
                        <li>Bookmark for quick access</li>
                      </ol>
                    </div>

                    {/* Android TV */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-primary">Android TV / Google TV</h4>
                      <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                        <li>Install Chrome or Puffin TV Browser</li>
                        <li>Open and navigate to <strong>metsxmfanzone.com</strong></li>
                        <li>Chrome may offer to install as PWA</li>
                        <li>Otherwise, bookmark for easy access</li>
                      </ol>
                    </div>

                    {/* Apple TV */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-primary">Apple TV</h4>
                      <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                        <li>Apple TV doesn't have a built-in browser</li>
                        <li>Use AirPlay from your iPhone/iPad/Mac</li>
                        <li>Open MetsXMFanZone on your device</li>
                        <li>Tap AirPlay icon and select your Apple TV</li>
                      </ol>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg bg-muted/50 mt-4">
                    <h4 className="font-semibold mb-2">TV Mode Features</h4>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500" />
                        Large, easy-to-read text optimized for big screens
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500" />
                        D-pad/remote control navigation support
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500" />
                        Simplified interface for TV viewing
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500" />
                        Full-screen video player with keyboard shortcuts
                      </li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Install;
