import { Link } from "react-router-dom";
import SEOHead from "@/components/SEOHead";

// A real "page not found" screen. It used to redirect to /auth, which made every
// bad URL look like a valid page to Google ("soft 404"). noindex keeps these
// URLs out of search results.
const NotFound = () => (
  <main className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
    <SEOHead title="Page not found" description="This page could not be found on MetsXMFanZone." noindex />
    <p className="text-sm font-bold uppercase tracking-[0.18em] text-primary">404</p>
    <h1 className="font-display text-4xl font-bold uppercase tracking-wide text-foreground">Page not found</h1>
    <p className="max-w-md text-muted-foreground">That page doesn't exist or has moved. Head back to the latest Mets news and streams.</p>
    <div className="flex flex-wrap justify-center gap-3">
      <Link to="/" className="rounded-full bg-primary px-6 py-3 font-bold text-primary-foreground">Home</Link>
      <Link to="/blog" className="rounded-full border px-6 py-3 font-bold text-foreground">Mets news</Link>
    </div>
  </main>
);

export default NotFound;
