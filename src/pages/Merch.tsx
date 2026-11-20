import { ShoppingBag } from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import PodcastShop from "@/components/podcast/PodcastShop";

const Merch = () => (
  <div className="min-h-screen bg-background">
    <SEOHead
      title="MetsXMFanZone Merch | Official Fan Gear"
      description="Shop official MetsXMFanZone merch: tees, hats and fan gear. Secure checkout with PayPal."
      canonical="https://metsxmfanzone.com/merch"
    />
    <Navigation />
    <main className="mx-auto max-w-6xl px-4 pb-24 pt-24 md:pt-28">
      <header className="mb-6 rounded-2xl border-t-4 border-t-primary bg-gradient-to-b from-[hsl(var(--mets-blue))] to-[hsl(var(--mets-blue-dark))] p-6 text-center text-white sm:p-10">
        <ShoppingBag className="mx-auto h-9 w-9 text-primary" />
        <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">MetsXMFanZone Merch</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-white/80 sm:text-base">
          Our own fan gear. Pay securely with PayPal and we ship it to you in the U.S.
        </p>
      </header>
      <PodcastShop all />
      <p className="mt-8 text-center text-sm text-muted-foreground">
        Looking for official Mets jerseys and hats? <a href="/mets-shop" className="font-semibold text-primary underline">Visit the Mets Shop</a>
      </p>
    </main>
    <Footer />
  </div>
);

export default Merch;
