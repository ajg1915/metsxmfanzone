import { METSXMFANZONE_SOCIALS } from "@/components/SocialLinksSection";

// Small swipe row of every official account, sitting right under the hero.
const HomeSocialRow = () => (
  <nav aria-label="Follow MetsXMFanZone" className="relative z-10 pb-2 pt-[70px] sm:pt-[72px]">
    <div className="mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto px-4 scrollbar-hide sm:px-6 lg:px-8">
      <span className="shrink-0 pr-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-primary">Follow</span>
      {METSXMFANZONE_SOCIALS.map(({ name, url, Icon }) => (
        <a
          key={name}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`MetsXMFanZone on ${name}`}
          className="flex h-10 shrink-0 items-center gap-2 rounded-full border border-border/60 bg-card/80 px-3.5 text-[13px] font-bold text-foreground transition-colors hover:border-primary/60"
        >
          <Icon className="h-4 w-4" />
          {name}
        </a>
      ))}
    </div>
  </nav>
);

export default HomeSocialRow;
