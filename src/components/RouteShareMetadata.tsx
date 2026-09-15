import { useLocation } from "react-router-dom";
import SEOHead from "@/components/SEOHead";
import sharePages from "@/data/share-pages.json";

const SITE_URL = "https://metsxmfanzone.com";
const PRIVATE_PREFIXES = [
  "/admin",
  "/dashboard",
  "/writer",
  "/auth",
  "/confirm-account",
  "/logout",
  "/payment-",
  "/paypal-success",
  "/private-player",
  "/metsxm-player",
  "/unsubscribe",
];

export default function RouteShareMetadata() {
  const { pathname } = useLocation();
  const path = pathname === "/" ? pathname : pathname.replace(/\/+$/, "");
  const page = sharePages.find((entry) => entry.path === path);

  if (page) {
    return (
      <SEOHead
        title={page.title}
        description={page.description}
        canonical={`${SITE_URL}${page.path === "/" ? "/" : page.path}`}
        ogImage={page.image}
        ogImageAlt={`${page.label} — MetsXMFanZone`}
      />
    );
  }

  if (PRIVATE_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    return (
      <SEOHead
        title="MetsXMFanZone"
        description="Private MetsXMFanZone account page."
        canonical={`${SITE_URL}${path}`}
        noindex
        twitterCard="summary"
      />
    );
  }

  return null;
}