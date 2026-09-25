import { useLocation } from "react-router-dom";
import SEOHead from "@/components/SEOHead";
import sharePages from "@/data/share-pages.json";
import { useSeoOverride } from "@/lib/seoOverrides";

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
  const managed = useSeoOverride(path);

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

  const isPrivate = PRIVATE_PREFIXES.some((prefix) => path.startsWith(prefix));

  // A page added in Admin → SEO Settings that isn't in the built-in list.
  if (managed && !isPrivate) {
    return (
      <SEOHead
        title={managed.title}
        description={managed.description}
        canonical={`${SITE_URL}${path}`}
      />
    );
  }

  if (isPrivate) {
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