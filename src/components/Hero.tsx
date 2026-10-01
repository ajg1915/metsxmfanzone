import heroImage from "@/assets/hero-mets.png";
import visitorImage from "@/assets/fanart-mets-home.jpg";
import memberImage from "@/assets/fanart-mets-general.jpg";
import logo from "@/assets/metsxmfanzone-logo.png";
import useEmblaCarousel from "embla-carousel-react";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { Play, Info, ChevronLeft, ChevronRight, Bell, BellRing } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { useToast } from "@/hooks/use-toast";
import { AdminEditBadge } from "@/components/admin/AdminEditBadge";

interface HeroSlide {
  id: string;
  title: string;
  description: string;
  image_url: string | null;
  display_order: number;
  link_url: string | null;
  link_text: string | null;
  show_watch_live: boolean | null;
  show_reminder: boolean | null;
}

const Hero = () => {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, dragFree: false, watchDrag: false, duration: 0 });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mobileIndex, setMobileIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const { user } = useAuth();
  const { isPremium } = useSubscription();
  const [memberSlides, setMemberSlides] = useState<HeroSlide[]>([]);
  const [publicSlides, setPublicSlides] = useState<HeroSlide[]>([]);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [isLiveNow, setIsLiveNow] = useState(false);
  const navigate = useNavigate();
  const { permission, isSubscribed, requestPermission } = useNotifications();
  const { toast } = useToast();

  const handleSetReminder = async () => {
    if (!user) { navigate("/auth"); return; }
    if (permission === "granted" && isSubscribed) {
      toast({ title: "Already Subscribed", description: "You'll get notified when games go live!" });
      return;
    }
    const granted = await requestPermission();
    if (granted) {
      toast({ title: "Reminder Set!", description: "You'll receive a notification when games go live." });
    }
  };


  // Live check
  useEffect(() => {
    const check = async () => {
      const { data } = await supabase.from('live_streams').select('id').eq('status', 'live').eq('published', true).limit(1);
      setIsLiveNow(data && data.length > 0);
    };
    check();
    const ch = supabase.channel('hero-live').on('postgres_changes', { event: '*', schema: 'public', table: 'live_streams' }, () => check()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const onSelect = useCallback(() => { if (emblaApi) setSelectedIndex(emblaApi.selectedScrollSnap()); }, [emblaApi]);
  useEffect(() => { if (!emblaApi) return; onSelect(); emblaApi.on("select", onSelect); return () => { emblaApi.off("select", onSelect); }; }, [emblaApi, onSelect]);

  // Fetch slides
  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("hero_slides").select("*").eq("is_for_members", true).eq("published", true).order("display_order");
      if (data?.length) setMemberSlides(data);
    };
    if (user) fetch();
  }, [user]);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("hero_slides").select("*").eq("is_for_members", false).eq("published", true).order("display_order");
      if (data) setPublicSlides(data);
    };
    fetch();
  }, []);

  const defaultSlides = [
    { title: "METSXMFANZONE.TV", description: "Connect with thousands of passionate Mets fans. Watch live streams, highlights, podcasts and more.", image: heroImage, link_url: null, link_text: null, show_watch_live: true, show_reminder: true, tag: "STREAMING" },
    { title: "Live Game Coverage", description: "Watch exclusive live streams, game highlights, and expert analysis. Never miss a moment.", image: heroImage, link_url: "/metsxmfanzone", link_text: "Watch Now", show_watch_live: false, show_reminder: true, tag: "LIVE" },
    { title: "MetsXMFanZone Podcast", description: "Join Anthony and the Mets Universe on the daily MetsXMFanZone podcast.", image: heroImage, link_url: "/podcast", link_text: "Listen", show_watch_live: false, show_reminder: false, tag: "PODCAST" },
  ];

  const mapDbSlides = (slides: HeroSlide[], tag: string) => slides.map(s => ({
    title: s.title, description: s.description, image: s.image_url || heroImage,
    link_url: s.link_url, link_text: s.link_text, show_watch_live: s.show_watch_live ?? true, show_reminder: s.show_reminder ?? false, tag,
  }));

  const slidesToShow = user
    ? (memberSlides.length > 0 ? mapDbSlides(memberSlides, "MEMBER") : defaultSlides)
    : (publicSlides.length > 0 ? mapDbSlides(publicSlides, "FEATURED") : defaultSlides);

  const mobileSlides = slidesToShow.map((sl, i) => ({
    ...sl,
    // Phones get the fan photos from the new look unless an admin set their own image.
    image: sl.image && sl.image !== heroImage ? sl.image : (user ? memberImage : visitorImage),
    key: i,
  }));
  const mSlide = mobileSlides[Math.min(mobileIndex, mobileSlides.length - 1)];
  const reminderOn = permission === "granted" && isSubscribed;

  const onTouchEnd = (x: number) => {
    if (touchStartX === null || mobileSlides.length < 2) return;
    const dx = x - touchStartX;
    if (Math.abs(dx) > 50) {
      setMobileIndex((i) => (dx < 0 ? (i + 1) % mobileSlides.length : (i - 1 + mobileSlides.length) % mobileSlides.length));
    }
    setTouchStartX(null);
  };

  const premiumRoutes = ['/live', '/metsxmfanzone', '/mlb-network', '/espn-network', '/pix11-network', '/spring-training-live'];
  const requiresPremium = (url: string) => premiumRoutes.some(r => url.toLowerCase().includes(r.toLowerCase().replace('/', '')));

  const handleNav = (url: string) => {
    if (!user) { navigate("/auth"); return; }
    if (!isPremium && requiresPremium(url)) { setShowUpgradePrompt(true); return; }
    url.startsWith("http") ? window.open(url, "_blank") : navigate(url);
  };

  return (
    <section className="group/hero home-hero-shell relative max-sm:!p-0 sm:pt-2">
      <AdminEditBadge to="/admin/hero" label="Edit Hero" />

      {/* Phone hero: full-bleed photo under the floating header */}
      <div
        className="relative h-[calc(100svh-12.5rem)] min-h-[460px] max-h-[720px] overflow-hidden sm:hidden"
        onTouchStart={(e) => setTouchStartX(e.touches[0].clientX)}
        onTouchEnd={(e) => onTouchEnd(e.changedTouches[0].clientX)}
      >
        {/\.(mp4|webm|mov|m4v)(\?|$)/i.test(mSlide.image || "") ? (
          <video key={mSlide.image} src={mSlide.image} autoPlay muted loop playsInline className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <img src={mSlide.image} alt="" className="absolute inset-0 h-full w-full object-cover object-[48%_40%]" />
        )}
        <div className="absolute inset-0" style={{ backgroundImage: "linear-gradient(to bottom, hsl(var(--background) / 0.25) 0%, hsl(var(--background) / 0) 20%, hsl(var(--background) / 0.35) 45%, hsl(var(--background) / 0.92) 75%, hsl(var(--background)) 100%)" }} />

        <div className="absolute inset-x-5 bottom-3 flex flex-col">
          {user ? (
            <div className="flex items-center gap-2.5">
              {isLiveNow && (
                <span className="inline-flex items-center gap-1.5 rounded bg-red-700 px-2 py-[3px] text-[11px] font-extrabold tracking-[0.08em] text-white">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                  LIVE NOW
                </span>
              )}
              <span className="text-[11px] font-extrabold tracking-[0.2em] text-primary">WELCOME BACK</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="h-0.5 w-4 bg-primary" />
              <span className="text-[11px] font-extrabold tracking-[0.2em] text-primary">NEW YORK METS FAN COMMUNITY</span>
            </div>
          )}

          <h1 className="mx-wordmark mt-2.5 font-display uppercase italic leading-[0.98] text-foreground drop-shadow-lg" style={{ fontFamily: "'Oswald','Bebas Neue',sans-serif", fontWeight: 700, fontSize: user ? "clamp(28px, 9.5vw, 38px)" : "clamp(26px, 9vw, 35px)" }}>
            {user ? mSlide.title : "The ultimate destination where the fans go"}
          </h1>
          <p className="mt-2.5 text-[14.5px] leading-snug text-foreground/80">
            {user ? (mSlide.description || "Watch live on MetsXMFanZone TV") : "Live games, highlights and podcasts, built by fans."}
          </p>

          {user ? (
            <>
              <div className="mt-4 flex gap-2.5">
                <Button
                  onClick={() => handleNav("/metsxmfanzone")}
                  className="h-[52px] flex-1 gap-2 rounded-xl bg-[#d43700] text-base font-bold text-white hover:bg-[#d43700]/90"
                >
                  <Play className="h-[18px] w-[18px] fill-current" />
                  {isLiveNow ? "Watch Live" : "Watch"}
                </Button>
                <Button
                  onClick={handleSetReminder}
                  variant="outline"
                  aria-label={reminderOn ? "Reminder on" : "Remind me when games go live"}
                  className={`h-[52px] w-[52px] rounded-xl p-0 ${reminderOn ? "border-primary/40 bg-primary/20 text-primary" : "border-foreground/30 bg-background/50 text-foreground"}`}
                >
                  {reminderOn ? <BellRing className="h-[22px] w-[22px]" /> : <Bell className="h-[22px] w-[22px]" />}
                </Button>
              </div>
              {mobileSlides.length > 1 && (
                <div className="mt-4 flex items-center justify-center gap-1.5">
                  {mobileSlides.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      aria-label={`Show story ${i + 1}`}
                      onClick={() => setMobileIndex(i)}
                      className="flex h-6 items-center px-0.5"
                    >
                      <span className={`block rounded-full ${mobileIndex === i ? "h-[5px] w-5 bg-primary" : "h-[5px] w-[5px] bg-muted-foreground/50"}`} />
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <Button onClick={() => navigate("/auth?mode=signup")} className="mt-4 h-[52px] rounded-xl bg-[#d43700] text-base font-bold text-white hover:bg-[#d43700]/90">
                Join MetsXMFanZone
              </Button>
              <div className="mt-1.5 flex h-11 items-center justify-center gap-1.5 text-sm text-foreground/80">
                Already a member?
                <button type="button" onClick={() => navigate("/auth?mode=login")} className="h-11 px-1 font-bold text-foreground underline">
                  Log in
                </button>
              </div>
              <div className="mt-0.5 flex items-center justify-center gap-2 text-xs font-semibold text-muted-foreground">
                <span>Watch on the go</span><span className="text-primary">&bull;</span><span>All devices</span><span className="text-primary">&bull;</span><span>Cancel anytime</span>
              </div>
            </>
          )}
        </div>
      </div>

      <div ref={emblaRef} className="home-feed-shell hidden overflow-hidden sm:block">
        <div className="flex">
          {slidesToShow.map((slide, index) => (
            <div
              key={index}
              className="relative flex-[0_0_100%] min-w-0 h-[224px] sm:h-auto sm:aspect-[16/8] lg:aspect-[16/7] overflow-hidden rounded-xl sm:rounded-md border border-border/40 bg-card shadow-elevation-high"
              style={{
                opacity: selectedIndex === index ? 1 : 0,
                zIndex: selectedIndex === index ? 10 : 0,
                pointerEvents: selectedIndex === index ? "auto" : "none",
              }}
            >
              {(() => {
                const url = slide.image || "";
                const isVideo = /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);
                if (isVideo) {
                  return (
                    <video
                      key={url}
                      src={url}
                      autoPlay
                      muted
                      loop
                      playsInline
                      preload="auto"
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  );
                }
                return (
                  <div
                    className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                    style={{ backgroundImage: `url(${url})` }}
                  />
                );
              })()}

              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/25 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/25 to-transparent" />

              {/* Content overlay — bottom-left like Netflix */}
              <div
                className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 md:p-8"
              >
                {/* Logo + tag (logo already in the mobile nav, so hidden on phones) */}
                <div className="flex items-center gap-2 mb-1.5 sm:mb-3">
                  <img src={logo} alt="MetsXMFanZone" className="hidden sm:block w-8 h-8 object-contain" />
                  <span className="mx-eyebrow rounded-sm bg-background/75 px-2 py-0.5 text-primary sm:bg-transparent sm:p-0">
                    {slide.tag}
                  </span>
                  {isLiveNow && (
                    <span className="ml-1 inline-flex items-center gap-1.5 rounded-sm bg-destructive/90 px-1.5 py-0.5 text-[9px] font-black uppercase text-destructive-foreground">
                      <span className="w-1.5 h-1.5 rounded-full bg-destructive-foreground animate-pulse" />
                      Live
                    </span>
                  )}
                </div>

                {/* Title — broadcast wordmark on mobile */}
                {index === 0 ? (
                  <h1 className="mx-wordmark mb-1.5 max-w-xl font-display uppercase leading-[0.9] text-foreground drop-shadow-lg sm:mb-2">
                    {slide.title}
                  </h1>
                ) : (
                  <h2 className="mx-wordmark mb-1.5 max-w-xl font-display uppercase leading-[0.9] text-foreground drop-shadow-lg sm:mb-2">
                    {slide.title}
                  </h2>
                )}

                {/* Description */}
                <p className="mb-3 max-w-md line-clamp-1 text-[13px] leading-snug text-foreground/80 sm:mb-4 sm:text-sm sm:line-clamp-3 sm:leading-relaxed">
                  {slide.description}
                </p>

                {/* Action buttons */}
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                  {slide.show_watch_live && (
                    <div className="relative">
                      {isLiveNow && <div className="absolute -inset-1 rounded-lg bg-destructive/40 blur-lg" />}
                      <Button
                        onClick={() => handleNav("/metsxmfanzone")}
                        className={`relative h-11 gap-2 rounded-lg px-6 text-[15px] font-bold sm:h-9 sm:gap-1.5 sm:rounded-sm sm:text-sm ${isLiveNow ? "ring-2 ring-destructive/50" : ""}`}
                      >
                        <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" />
                        {isLiveNow ? "Watch Live" : "Watch"}
                      </Button>
                    </div>
                  )}
                  {slide.link_url && slide.link_text && (
                    <Button
                      onClick={() => slide.link_url && handleNav(slide.link_url)}
                      variant="outline"
                      className="h-11 gap-1.5 rounded-lg border-foreground/20 bg-foreground/10 px-4 text-sm text-foreground hover:bg-foreground/20 sm:h-9 sm:rounded-sm sm:px-5"
                    >
                      <Info className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      {slide.link_text}
                    </Button>
                  )}
                  {slide.show_reminder && (
                    <Button
                      onClick={handleSetReminder}
                      variant="outline"
                      aria-label={permission === "granted" && isSubscribed ? "Reminder on" : "Set reminder"}
                      className={`gap-1.5 h-11 w-11 p-0 rounded-lg sm:h-9 sm:w-auto md:h-10 text-xs sm:text-sm sm:px-5 sm:rounded-sm ${
                        permission === "granted" && isSubscribed
                          ? "bg-primary/20 border-primary/40 text-primary hover:bg-primary/30"
                          : "bg-foreground/10 border-foreground/20 text-foreground hover:bg-foreground/20 hover:border-foreground/40"
                      }`}
                    >
                      {permission === "granted" && isSubscribed ? (
                        <BellRing className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      ) : (
                        <Bell className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      )}
                      <span className="hidden sm:inline">{permission === "granted" && isSubscribed ? "Reminder On" : "Set Reminder"}</span>
                    </Button>
                  )}
                </div>

                {/* Signup banner */}
                {!user && (
                  <div className="mt-3 sm:mt-4">
                    <Button onClick={() => navigate("/auth")} variant="link" className="h-auto p-0 text-[10px] text-foreground/60 hover:text-foreground/80 sm:text-xs">
                      Join MetsXMFanZone · Plans from $9.99/mo
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>


      {/* Slide indicators */}
      <div className="relative z-20 mt-3 hidden justify-center gap-1 sm:flex sm:gap-1.5">
        {slidesToShow.map((_, i) => (
          <Button
            key={i}
            variant="ghost"
            size="icon"
            aria-label={`Show story ${i + 1}`}
            onClick={() => emblaApi?.scrollTo(i)}
            className={`h-5 min-w-0 rounded-sm p-0 hover:bg-transparent ${selectedIndex === i ? "w-7" : "w-3"}`}
          >
            <span className={`h-[3px] w-full rounded-full ${selectedIndex === i ? "bg-foreground" : "bg-foreground/30"}`} />
          </Button>
        ))}
      </div>

      <UpgradePrompt open={showUpgradePrompt} onOpenChange={setShowUpgradePrompt} />
    </section>
  );
};

export default Hero;
