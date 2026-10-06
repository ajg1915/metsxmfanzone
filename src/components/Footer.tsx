import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Download } from "lucide-react";
import { METSXMFANZONE_SOCIALS } from "@/components/SocialLinksSection";

type FooterLink = { label: string; to: string };

// Keep in sync with: src/vanilla/ui/shell.js and scripts/build-static-site.mjs
const COLUMNS: { title: string; links: FooterLink[] }[] = [
  {
    title: "Watch",
    links: [
      { label: "Live Network", to: "/metsxmfanzone" },
      { label: "Game Day Live", to: "/gameday-live" },
      { label: "Game Replays", to: "/replay-games" },
      { label: "TV Schedule", to: "/broadcast-schedule" },
      { label: "TV Mode", to: "/tv" },
    ],
  },
  {
    title: "Read",
    links: [
      { label: "News", to: "/blog" },
      { label: "Game Recaps", to: "/mets-game-recaps" },
      { label: "Scores", to: "/mets-scores" },
      { label: "2026 Schedule", to: "/mets-schedule-2026" },
      { label: "Roster", to: "/mets-roster" },
    ],
  },
  {
    title: "Community",
    links: [
      { label: "Community", to: "/community" },
      { label: "Podcast", to: "/podcast" },
      { label: "Highlights", to: "/video-gallery" },
      { label: "Follow Us", to: "/social" },
      { label: "Business Partners", to: "/business-partner" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Help Center", to: "/help-center" },
      { label: "FAQ", to: "/faqs" },
      { label: "Contact Us", to: "/contact" },
      { label: "Plans & Pricing", to: "/pricing" },
      { label: "Install App", to: "/install" },
    ],
  },
];

const Footer = () => {
  const navigate = useNavigate();

  const handleSecretClick = () => {
    navigate("/admin-portal");
  };

  return (
    <motion.footer
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className="relative glass-nav border-t-2 border-primary bg-card/80 backdrop-blur-md"
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-24 md:pb-8 max-w-6xl">
        {/* Brand + social */}
        <div className="flex flex-col items-center gap-4 pb-6 border-b border-border/40 text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <h3 className="font-bold text-primary text-lg">MetsXMFanZone.com</h3>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">Fan-run coverage of the New York Mets</p>
          </div>
          <div className="flex gap-2.5" aria-label="Follow MetsXMFanZone">
            {METSXMFANZONE_SOCIALS.map(({ name, url, Icon }) => (
              <a
                key={name}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`MetsXMFanZone on ${name}`}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-muted/40 text-foreground/80 transition-colors hover:border-primary hover:text-primary"
              >
                <Icon className="h-[18px] w-[18px]" />
              </a>
            ))}
          </div>
        </div>

        {/* Link columns */}
        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-6 gap-y-7 py-7 md:grid-cols-4">
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h4 className="mb-2.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                <span className="h-3.5 w-[3px] bg-primary" aria-hidden />
                {col.title}
              </h4>
              <ul className="space-y-1">
                {col.links.map((l) => (
                  <li key={l.to}>
                    <Link to={l.to} className="block py-1 text-sm text-foreground/80 transition-colors hover:text-primary">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* Install bar */}
        <div className="mb-6 flex flex-col items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-center sm:flex-row sm:text-left">
          <span className="text-sm text-foreground/80">Take the Mets with you: install the MetsXMFanZone app.</span>
          <Link
            to="/install"
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Download className="h-3.5 w-3.5" />
            Install App
          </Link>
        </div>

        {/* Legal */}
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pb-2 text-xs sm:text-sm">
          <Link to="/privacy" className="text-muted-foreground hover:text-primary transition-colors">Privacy</Link>
          <Link to="/terms" className="text-muted-foreground hover:text-primary transition-colors">Terms</Link>
          <Link to="/contact" className="text-muted-foreground hover:text-primary transition-colors">Contact</Link>
        </div>
        <p
          onClick={handleSecretClick}
          className="mt-2 cursor-pointer select-none text-center text-[11px] leading-relaxed text-muted-foreground/70 transition-colors hover:text-muted-foreground"
          aria-hidden="true"
        >
          &copy; {new Date().getFullYear()} MetsXMFanZone. Fan-run coverage of the New York Mets. Not affiliated with MLB or the New York Mets.
        </p>
        <p className="mt-1.5 text-center text-[10px] text-muted-foreground/50">VPN Secured · AES-256 Encrypted</p>
      </div>
    </motion.footer>
  );
};

export default Footer;
