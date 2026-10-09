import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Download } from "lucide-react";
import { METSXMFANZONE_SOCIALS } from "@/components/SocialLinksSection";

// The handful of links most fans want. Everything else lives in the site menu.
const QUICK_LINKS: { label: string; to: string }[] = [
  { label: "Live", to: "/metsxmfanzone" },
  { label: "News", to: "/blog" },
  { label: "Schedule", to: "/broadcast-schedule" },
  { label: "Podcast", to: "/podcast" },
  { label: "Plans", to: "/pricing" },
  { label: "Help", to: "/help-center" },
];

const Footer = () => {
  const navigate = useNavigate();

  return (
    <motion.footer
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className="relative border-t border-border/60 bg-card/80 backdrop-blur-md"
    >
      <div className="container mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-10 pb-24 md:pb-10">
        {/* Brand, socials, app */}
        <div className="flex flex-col items-center gap-6 text-center md:flex-row md:justify-between md:text-left">
          <div>
            <h3 className="text-lg font-bold text-primary">MetsXMFanZone</h3>
            <p className="mt-1 text-sm text-muted-foreground">Fan-run coverage of the New York Mets</p>
          </div>

          <div className="flex items-center gap-2" aria-label="Follow MetsXMFanZone">
            {METSXMFANZONE_SOCIALS.map(({ name, url, Icon }) => (
              <a
                key={name}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`MetsXMFanZone on ${name}`}
                className="flex h-9 w-9 items-center justify-center rounded-full text-foreground/70 transition-colors hover:bg-muted hover:text-primary"
              >
                <Icon className="h-4 w-4" />
              </a>
            ))}
          </div>

          <Link
            to="/install"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Download className="h-4 w-4" />
            Get the App
          </Link>
        </div>

        {/* Quick links */}
        <nav aria-label="Footer" className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-y border-border/50 py-5">
          {QUICK_LINKS.map((l) => (
            <Link key={l.to} to={l.to} className="text-sm text-foreground/80 transition-colors hover:text-primary">
              {l.label}
            </Link>
          ))}
        </nav>

        {/* Legal */}
        <div className="mt-5 flex flex-col items-center gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <Link to="/privacy" className="transition-colors hover:text-primary">Privacy</Link>
            <Link to="/terms" className="transition-colors hover:text-primary">Terms</Link>
            <Link to="/contact" className="transition-colors hover:text-primary">Contact</Link>
          </div>
          <p
            onClick={() => navigate("/admin-portal")}
            className="cursor-pointer select-none text-center text-[11px] leading-relaxed opacity-70"
            aria-hidden="true"
          >
            &copy; {new Date().getFullYear()} MetsXMFanZone. Not affiliated with MLB or the New York Mets.
          </p>
        </div>
      </div>
    </motion.footer>
  );
};

export default Footer;
