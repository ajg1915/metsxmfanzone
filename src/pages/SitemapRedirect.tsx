import { useEffect } from "react";

// Hard-redirect /sitemap.xml to the dynamic edge function so search engines
// receive valid XML (not a React HTML shell).
const SITEMAP_URL =
  "https://clwghkbtkofacsjeyrtk.supabase.co/functions/v1/dynamic-sitemap";

export default function SitemapRedirect() {
  useEffect(() => {
    window.location.replace(SITEMAP_URL);
  }, []);
  return null;
}
