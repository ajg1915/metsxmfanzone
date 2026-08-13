import heroImage from "@/assets/hero-mets.png";
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
      const { data } = await supabase.from("live_streams_public").select('id').eq('status', 'live').eq('published', true).limit(1);
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

  const premiumRoutes = ['/live', '/metsxmfanzone', '/mlb-network', '/espn-network', '/pix11-network', '/spring-training-live'];
  const requiresPremium = (url: string) => premiumRoutes.some(r => url.toLowerCase().includes(r.toLowerCase().replace('/', '')));

  const handleNav = (url: string) => {
    if (!user) { navigate("/auth"); return; }
    if (!isPremium && requiresPremium(url)) { setShowUpgradePrompt(true); return; }
    url.startsWith("http") ? window.open(url, "_blank") : navigate(url);
  };

  return (
    <section className="group/hero relative h-[clamp(280px,50vw,580px)] overflow-hidden bg-black">
      <AdminEditBadge to="/admin/hero" label="Edit Hero" />
      <div ref={emblaRef} className="overflow-hidden absolute inset-0">
        <div className="flex h-full">
          {slidesToShow.map((slide, index) => (
            <div
              key={index}
              className="flex-[0_0_100%] min-w-0 absolute inset-0"
              style={{
                opacity: selectedIndex === index ? 1 : 0,
                zIndex: selectedIndex === index ? 10 : 0,
                pointerEvents: selectedIndex === index ? "auto" : "none",
              }}
            >
              {/* Full-bleed background media (image, gif, or video) */}
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

              {/* Netflix-style gradient: bottom fade + left vignette */}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/30 to-transparent" />

              {/* Content overlay — bottom-left like Netflix */}
              <div
                className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 md:p-8 lg:p-12 pb-12 sm:pb-14 md:pb-16"
              >
                {/* Logo + tag */}
                <div className="flex items-center gap-2 mb-2 sm:mb-3">
                  <img src={logo} alt="MetsXMFanZone" className="w-6 h-6 sm:w-8 sm:h-8 object-contain" />
                  <span className="mx-eyebrow !text-primary/95">
                    {slide.tag}
                  </span>
                  {isLiveNow && (
                    <span className="ml-1 inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-sm bg-destructive/90 text-[9px] font-black uppercase tracking-widest text-white">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      Live
                    </span>
                  )}
                </div>

                {/* Title — broadcast wordmark on mobile */}
                <h1 className="mx-wordmark sm:not-italic font-black text-foreground mb-1.5 sm:mb-2 max-w-xl leading-[0.95] sm:leading-[1.1] uppercase tracking-tight drop-shadow-lg" style={{ color: 'white' }}>
                  {slide.title}
                </h1>

                {/* Description */}
                <p className="text-[clamp(0.7rem,1.5vw,0.875rem)] text-foreground/75 mb-3 sm:mb-4 max-w-md leading-relaxed line-clamp-2 sm:line-clamp-3" style={{ color: 'rgba(255,255,255,0.78)' }}>
                  {slide.description}
                </p>

                {/* Action buttons */}
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                  {slide.show_watch_live && (
                    <div className="relative">
                      {isLiveNow && <div className="absolute -inset-1 rounded-lg bg-destructive/40 blur-lg" />}
                      <Button
                        onClick={() => handleNav("/metsxmfanzone")}
                        className={`relative gap-1.5 bg-white text-black hover:bg-white/90 font-bold px-4 sm:px-6 h-8 sm:h-9 md:h-10 text-xs sm:text-sm rounded-sm ${isLiveNow ? "ring-2 ring-destructive/50" : ""}`}
                      >
                        <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" />
                        {isLiveNow ? "Watch Live" : "Watch"}
                      </Button>
                    </div>
                  )}
                  {slide.link_url && slide.link_text && (
                    <Button
                      onClick={() => handleNav(slide.link_url!)}
                      variant="outline"
                      className="gap-1.5 bg-white/10 border-white/20 text-white hover:bg-white/20 hover:border-white/40 h-8 sm:h-9 md:h-10 text-xs sm:text-sm px-3 sm:px-5 rounded-sm"
                    >
                      <Info className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      {slide.link_text}
                    </Button>
                  )}
                  {slide.show_reminder && (
                    <Button
                      onClick={handleSetReminder}
                      variant="outline"
                      className={`gap-1.5 h-8 sm:h-9 md:h-10 text-xs sm:text-sm px-3 sm:px-5 rounded-sm ${
                        permission === "granted" && isSubscribed
                          ? "bg-primary/20 border-primary/40 text-primary hover:bg-primary/30"
                          : "bg-white/10 border-white/20 text-white hover:bg-white/20 hover:border-white/40"
                      }`}
                    >
                      {permission === "granted" && isSubscribed ? (
                        <BellRing className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      ) : (
                        <Bell className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      )}
                      {permission === "granted" && isSubscribed ? "Reminder On" : "Set Reminder"}
                    </Button>
                  )}
                </div>

                {/* Signup banner */}
                {!user && (
                  <div className="mt-3 sm:mt-4">
                    <button onClick={() => navigate("/auth")} className="text-[10px] sm:text-xs text-white/60 hover:text-white/80">
                      ⚡ <span className="text-primary font-semibold">FREE Spring Training</span> access · Regular season <span className="text-primary font-semibold">$9.99/mo</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>


      {/* Slide indicators */}
      <div className="absolute bottom-2 sm:bottom-3 left-0 right-0 z-20 flex justify-center gap-1 sm:gap-1.5">
        {slidesToShow.map((_, i) => (
          <button
            key={i}
            onClick={() => emblaApi?.scrollTo(i)}
            className={`h-[3px] rounded-full ${selectedIndex === i ? "w-5 sm:w-7 bg-white" : "w-1.5 sm:w-2 bg-white/30 hover:bg-white/50"}`}
          />
        ))}
      </div>

      <UpgradePrompt open={showUpgradePrompt} onOpenChange={setShowUpgradePrompt} />
    </section>
  );
};

export default Hero;
