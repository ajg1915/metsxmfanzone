import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import PodcastShop from "@/components/podcast/PodcastShop";
import { StoreHero } from "@/components/shop/StoreChrome";

const Merch = () => (
  <div className="min-h-screen bg-background">
    <SEOHead
      title="MetsXMFanZone Merch | Official Fan Gear"
      description="Shop official MetsXMFanZone merch: tees, hats and fan gear. Secure checkout with PayPal."
      canonical="https://metsxmfanzone.com/merch"
    />
    <Navigation />
    <main className="mx-auto max-w-6xl px-3 pb-28 pt-20 sm:px-4 md:pt-28">
      <StoreHero title="MetsXMFanZone Merch" subtitle="Tees, hoodies, jackets and caps with the MetsXMFanZone logo. Pick your color and size, and we ship it to you."
        perks={[{ icon: "truck", text: "Ships in the U.S." }, { icon: "shield", text: "Secure PayPal checkout" }, { icon: "gift", text: "Great holiday gift" }]} />
      <PodcastShop all />
      <p className="mt-10 text-center text-sm text-muted-foreground">
        Looking for Mets player tees? <a href="/shop" className="font-semibold text-primary underline">Visit the Mets Shop</a>
      </p>
    </main>
    <Footer />
  </div>
);

export default Merch;
