import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

interface InternalLink {
  title: string;
  description: string;
  href: string;
}

interface InternalLinksProps {
  title?: string;
  links: InternalLink[];
  className?: string;
}

const InternalLinks = ({ title = "Explore More", links, className = "" }: InternalLinksProps) => {
  return (
    <nav aria-label="Related content" className={`py-8 ${className}`}>
      <h2 className="text-xl font-bold text-foreground mb-4">{title}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {links.map((link) => (
          <Link
            key={link.href}
            to={link.href}
            className="group flex items-start gap-3 p-4 rounded-xl border border-border/50 bg-card/50 hover:bg-primary/5 hover:border-primary/30 transition-all"
          >
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors text-sm">
                {link.title}
              </h3>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{link.description}</p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors mt-1 shrink-0" />
          </Link>
        ))}
      </div>
    </nav>
  );
};

// Pre-defined link groups for different pages
export const metsContentLinks: InternalLink[] = [
  { title: "2026 Mets Roster", description: "Full roster breakdown with stats and player profiles", href: "/mets-roster" },
  { title: "Mets Schedule 2026", description: "Complete game schedule with dates, times, and opponents", href: "/mets-schedule-2026" },
  { title: "Live Scores", description: "Real-time Mets game scores and live updates", href: "/mets-scores" },
  { title: "Today's Lineup Card", description: "Starting lineup and batting order for today's game", href: "/mets-lineup-card" },
  { title: "Mets History", description: "Iconic moments, championships, and franchise legends", href: "/mets-history" },
  { title: "Player Stats", description: "Detailed statistics for every Mets player", href: "/player-stats" },
];

export const mediaLinks: InternalLink[] = [
  { title: "MetsXMFanZone TV", description: "Live streaming and on-demand Mets content", href: "/metsxmfanzone" },
  { title: "Podcast", description: "Weekly Mets analysis, interviews, and hot takes", href: "/podcast" },
  { title: "Blog", description: "In-depth articles, analysis, and opinion pieces", href: "/blog" },
  { title: "Video Gallery", description: "Highlights, replays, and exclusive video content", href: "/video-gallery" },
  { title: "Photo Gallery", description: "Fan art, game photos, and exclusive images", href: "/gallery" },
  { title: "Replay Games", description: "Watch classic and recent Mets games on demand", href: "/replay-games" },
];

export const communityLinks: InternalLink[] = [
  { title: "Fan Community", description: "Join thousands of Mets fans in discussions", href: "/community" },
  { title: "Events", description: "Upcoming fan meetups and community events", href: "/events" },
  { title: "Membership Plans", description: "Unlock premium content and exclusive features", href: "/plans" },
  { title: "Social Media Hub", description: "Follow us across all social platforms", href: "/social-media-hub" },
];

export const matchupLinks: InternalLink[] = [
  { title: "Mets vs Yankees", description: "Subway Series rivalry breakdown and history", href: "/matchups/mets-vs-yankees" },
  { title: "Mets vs Braves", description: "NL East rivals head-to-head analysis", href: "/matchups/mets-vs-braves" },
  { title: "Mets vs Astros", description: "Interleague matchup preview and stats", href: "/matchups/mets-vs-astros" },
  { title: "Mets vs Cardinals", description: "Classic NL rivalry comparison", href: "/matchups/mets-vs-cardinals" },
  { title: "Mets vs Red Sox", description: "Boston vs New York matchup analysis", href: "/matchups/mets-vs-red-sox" },
  { title: "Mets vs Nationals", description: "NL East division battle preview", href: "/matchups/mets-vs-nationals" },
];

export default InternalLinks;
