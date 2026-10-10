import { Link } from "react-router-dom";
import type { CSSProperties, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sectionStyle, useFrontPageStyles, type SectionStyle } from "@/lib/frontPageSections";
import metsLogo from "@/assets/metsxmfanzone-logo.png";

// Front page for visitors who are not signed in: what members get, the plans, and why to trust us.

const PLANS = [
  {
    id: "weekly",
    name: "Weekly",
    price: "$3.99",
    period: "/ week",
    blurb: "Try it for a series.",
    features: ["All live streams", "Full game replays", "All highlights", "HD streaming", "Community access"],
  },
  {
    id: "premium",
    name: "Monthly",
    price: "$9.99",
    period: "/ month",
    blurb: "The full season experience.",
    features: ["Everything in Weekly", "Ad-free experience", "Exclusive content", "Watch on all your devices", "Android and TV apps"],
    popular: true,
  },
  {
    id: "annual",
    name: "Yearly",
    price: "$129.99",
    period: "/ year",
    blurb: "One payment, the whole year.",
    features: ["Everything in Monthly", "Priority support", "Early access to content", "Merch discounts", "VIP community badge"],
  },
];

const FEATURES = [
  { title: "Live games and channels", text: "MetsXMFanZone TV around the clock, plus game-day streams and sports channels.", d: "M2 5h20v13H2zM10 9l5 2.5-5 2.5z" },
  { title: "Full game replays", text: "Missed the game? Watch it from the first pitch whenever you want.", d: "M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" },
  { title: "The podcast and Game Day Live", text: "Watch live every Monday and Friday, or listen to new episodes every day.", d: "M9 2h6v12H9zM5 10a7 7 0 0 0 14 0M12 17v5" },
  { title: "The fan community", text: "Talk the game with other Mets fans who care as much as you do.", d: "M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6M15 14.5c2.8 0 6 1.6 6 5M17 11.5a2.5 2.5 0 1 0 0-5" },
];

const TRUST = [
  { title: "Secure PayPal billing", text: "You pay through PayPal. We never see or store your card." },
  { title: "Cancel anytime", text: "Stop your plan from your Member Center. No contracts." },
  { title: "Run by Mets fans", text: "An independent fan site, built and hosted by fans since 2024." },
  { title: "Real help", text: "Questions? A real person answers through our Help Center." },
];

const FAQ = [
  { q: "What do I get as a member?", a: "Live streams, full replays, highlights, the podcast, exclusive content and the phone and TV apps." },
  { q: "How do I pay?", a: "Through PayPal, which takes credit cards, debit cards and PayPal balance." },
  { q: "Can I cancel?", a: "Yes, anytime from your Member Center. You keep access until the end of the period you paid for." },
  { q: "Can I watch on my TV?", a: "Yes. Members get our TV app for Fire TV, Android TV and Google TV." },
];

// Real pictures for the previews: the MetsXMFanZone TV channel picture and the latest stories.
function useLandingMedia() {
  return useQuery({
    queryKey: ["landing-media"],
    queryFn: async () => {
      const [{ data: streams }, { data: stories }] = await Promise.all([
        supabase.from("live_streams_public").select("title, thumbnail_url").ilike("title", "%metsxmfanzone%").not("thumbnail_url", "is", null).limit(1),
        supabase.from("stories").select("id, title, media_type, media_url, thumbnail_url").eq("published", true).neq("media_type", "text").order("created_at", { ascending: false }).limit(4),
      ]);
      const toUrl = (v: string | null | undefined) => {
        if (!v) return null;
        if (v.startsWith("http")) return v;
        return supabase.storage.from("stories").getPublicUrl(v.split("/stories/")[1] || v).data.publicUrl;
      };
      return {
        tv: (streams?.[0]?.thumbnail_url as string | undefined) ?? null,
        stories: (stories || [])
          .map((s) => ({ id: s.id as string, title: s.title as string, img: toUrl(s.media_type === "video" ? s.thumbnail_url : s.thumbnail_url || s.media_url) }))
          .filter((s) => !!s.img),
      };
    },
    staleTime: 10 * 60_000,
  });
}

const pickPlan = (id: string) => {
  try {
    localStorage.setItem("pending_signup_plan", id);
  } catch {
    /* private mode */
  }
};

function Section({
  id,
  bg,
  className = "",
  base,
  children,
}: {
  id?: string;
  bg?: SectionStyle;
  className?: string;
  base?: CSSProperties;
  children: ReactNode;
}) {
  const style = sectionStyle(bg, base);
  return (
    <section id={id} className={`relative overflow-hidden ${className}`} style={style}>
      {children}
    </section>
  );
}

const Eyebrow = ({ children, light }: { children: ReactNode; light?: boolean }) => (
  <p className={`text-sm font-bold uppercase tracking-[0.14em] ${light ? "text-[#ffb48f]" : "text-[#ff7a3d]"}`}>{children}</p>
);
const H2 = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <h2 className={`font-display text-[clamp(32px,4vw,48px)] uppercase leading-none text-white ${className}`}>{children}</h2>
);

export default function SignedOutLanding() {
  const { data: bgs = {} } = useFrontPageStyles();
  const { data: media } = useLandingMedia();
  const tvPicture = bgs.tv?.image || media?.tv || null;
  const tvPictureStyle: CSSProperties | undefined = tvPicture
    ? { backgroundImage: `url("${tvPicture.replace(/"/g, "%22")}")`, backgroundSize: "cover", backgroundPosition: "center" }
    : undefined;

  return (
    <div className="bg-[#07101f] text-[#f2f5fa]">
      {/* Hero */}
      <Section
        bg={bgs.hero}
        className="px-4 pb-16 pt-24 sm:px-6 sm:pt-32"
        base={{
          background:
            "radial-gradient(60% 80% at 85% 20%, rgba(255,89,16,0.22), transparent 60%), radial-gradient(50% 70% at 0% 100%, rgba(30,80,160,0.35), transparent 60%), repeating-linear-gradient(90deg, rgba(255,255,255,0.035) 0 2px, transparent 2px 44px), #07101f",
        }}
      >
        <svg aria-hidden="true" viewBox="0 0 200 200" className="pointer-events-none absolute -bottom-48 -right-40 h-[520px] w-[520px] opacity-[0.14]">
          <circle cx="100" cy="100" r="96" fill="#f2f5fa" />
          <path d="M38 30 C70 70 70 130 38 170" fill="none" stroke="#e11d48" strokeWidth="4" strokeDasharray="7 6" />
          <path d="M162 30 C130 70 130 130 162 170" fill="none" stroke="#e11d48" strokeWidth="4" strokeDasharray="7 6" />
        </svg>
        <div className="relative mx-auto flex max-w-[1240px] flex-wrap items-center gap-12">
          <div className="flex min-w-0 flex-[1_1_440px] flex-col gap-5">
            <span className="inline-flex items-center gap-2 self-start rounded-full bg-[#e11d48]/15 px-3.5 py-1.5 text-sm font-bold uppercase tracking-wider text-[#ff8fa3]">
              <span className="h-2 w-2 rounded-full bg-[#e11d48]" /> Live every game day
            </span>
            <h1 className="font-display text-[clamp(44px,6vw,76px)] uppercase leading-[0.98] text-white">
              Every Mets game. Every moment. With the fans.
            </h1>
            <p className="hero-description max-w-[560px] text-lg leading-relaxed text-[#c4cfdf] sm:text-[19px]">
              Live games and our own MetsXMFanZone TV channel, full replays, highlights, the podcast and daily Mets news. On your phone, computer and TV.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/auth?mode=signup" className="inline-flex min-h-[52px] items-center rounded-full bg-[#ff5910] px-7 text-[17px] font-bold text-white hover:opacity-90">
                Join from $3.99 a week
              </Link>
              <a href="#what" className="inline-flex min-h-[52px] items-center rounded-full border border-white/25 px-6 text-[17px] font-semibold text-white hover:bg-white/5">
                See what's included
              </a>
            </div>
            <p className="text-base text-[#c4cfdf]">
              Already a member?{" "}
              <Link to="/auth?mode=login" className="font-bold text-[#ff7a3d] hover:underline">
                Sign in
              </Link>
            </p>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-[#a9b7cb]">
              <span>✓ Secure PayPal checkout</span>
              <span>✓ Cancel anytime</span>
              <span>✓ Phone, computer and TV</span>
            </div>
          </div>
          <div className="min-w-0 flex-[1_1_400px]">
            <div
              className="relative aspect-video overflow-hidden rounded-[18px] border-[10px] border-[#151a22] bg-[radial-gradient(80%_90%_at_70%_30%,#1b3d6b_0%,#0a1d3d_60%,#050b16_100%)] shadow-2xl"
              style={tvPictureStyle}
            >
              {tvPicture && <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-black/70" />}
              <div className="absolute left-5 top-4 flex items-center gap-2.5">
                <img src={metsLogo} alt="" className="h-11 w-auto" />
                <div>
                  <span className="inline-block rounded-full bg-[#e11d48] px-2.5 py-0.5 text-[11px] font-extrabold">LIVE</span>
                  <div className="text-lg font-bold">MetsXMFanZone TV</div>
                </div>
              </div>
              <div className="absolute inset-x-5 bottom-4 grid grid-cols-4 gap-2 text-center text-xs font-semibold">
                {["MetsXMFanZone", "SNY", "MSG", "MLB Network"].map((c, i) => (
                  <div key={c} className={`rounded-lg bg-black/55 px-1 py-3 backdrop-blur-sm ${i === 0 ? "outline outline-2 outline-white" : ""}`}>{c}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* Fans + podcast */}
      <Section
        bg={bgs.fans}
        className="border-y-4 border-[#ff5910] px-4 py-11 sm:px-6"
        base={{ background: "linear-gradient(90deg, #002d72 0%, #0b1f4a 55%, #07101f 100%)" }}
      >
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-7">
          <div className="min-w-0 flex-[1_1_420px]">
            <Eyebrow light>By fans, for fans</Eyebrow>
            <H2 className="mb-2.5 mt-1.5">We bleed orange and blue</H2>
            <p className="text-lg leading-relaxed text-[#d4dceb]">
              MetsXMFanZone is run by lifelong Mets fans. We celebrate the wins, sweat the losses and talk about every game with you, live.
            </p>
          </div>
          <div className="grid min-w-0 flex-[1_1_420px] grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-white/[0.08] p-4">
              <p className="text-[13px] font-bold uppercase tracking-wider text-[#ffb48f]">Watch the podcast live</p>
              <p className="mt-1 font-display text-3xl uppercase">Mondays &amp; Fridays</p>
              <p className="text-sm text-[#c4cfdf]">Live on MetsXMFanZone TV</p>
            </div>
            <div className="rounded-2xl bg-white/[0.08] p-4">
              <p className="text-[13px] font-bold uppercase tracking-wider text-[#ffb48f]">Listen anytime</p>
              <p className="mt-1 font-display text-3xl uppercase">New every day</p>
              <p className="text-sm text-[#c4cfdf]">Daily episodes on the site and apps</p>
            </div>
          </div>
        </div>
      </Section>

      {/* What you get */}
      <Section id="what" bg={bgs.features} className="px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-[1240px]">
          <Eyebrow>What you get</Eyebrow>
          <H2 className="mb-7 mt-1.5">Everything a Mets fan needs, in one place</H2>
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex flex-col gap-2 rounded-2xl border border-white/[0.08] bg-[#0d1a2e] p-5">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ff7a3d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d={f.d} />
                </svg>
                <h3 className="text-[21px] font-bold text-white">{f.title}</h3>
                <p className="leading-relaxed text-[#b6c3d6]">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* A look inside */}
      <Section bg={bgs.inside} className="px-4 pb-16 sm:px-6">
        <div className="mx-auto max-w-[1240px]">
          <Eyebrow>A look inside</Eyebrow>
          <H2 className="mb-2 mt-1.5">Your members home</H2>
          <p className="mb-5 text-[17px] text-[#b6c3d6]">This is what you see after you join.</p>
          <div className="relative overflow-hidden rounded-[22px] border border-white/10 bg-[#0a1424] p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5">
                <img src={metsLogo} alt="" className="h-8 w-auto" />
                <span className="font-bold">Welcome back</span>
              </div>
              <div className="flex gap-2 text-[13px]">
                <span className="rounded-full bg-[#ff5910] px-3 py-1.5 font-bold">Home</span>
                <span className="rounded-full bg-[#13233d] px-3 py-1.5">Live</span>
                <span className="rounded-full bg-[#13233d] px-3 py-1.5">Replays</span>
                <span className="hidden rounded-full bg-[#13233d] px-3 py-1.5 sm:inline">Podcast</span>
              </div>
            </div>
            <div
              className="relative flex min-h-[200px] flex-col justify-end gap-2 overflow-hidden rounded-2xl bg-[radial-gradient(80%_120%_at_85%_10%,rgba(255,89,16,0.35),transparent_60%),linear-gradient(120deg,#0d2a5c,#0a1d3d_60%,#07101f)] p-6 sm:min-h-[240px]"
              style={tvPictureStyle}
            >
              {tvPicture && <div className="absolute inset-0 bg-gradient-to-r from-[#07101f]/85 via-[#07101f]/40 to-transparent" />}
              <span className="relative self-start rounded-full bg-[#e11d48] px-3 py-0.5 text-xs font-extrabold">LIVE NOW</span>
              <p className="relative font-display text-[34px] uppercase leading-none">MetsXMFanZone TV</p>
              <span className="relative self-start rounded-full bg-white px-4 py-2 text-sm font-bold text-[#07101f]">Watch live</span>
            </div>
            <p className="mb-2 mt-4 font-semibold">Stories</p>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {(media?.stories?.length ? media.stories : [0, 1, 2, 3].map((i) => ({ id: String(i), title: "", img: null as string | null }))).map((s, i) => (
                <div key={s.id} className={`relative aspect-video overflow-hidden rounded-xl ${i % 2 ? "bg-gradient-to-br from-[#3a1d10] to-[#13233d]" : "bg-gradient-to-br from-[#1b3d6b] to-[#13233d]"}`}>
                  {s.img && <img src={s.img} alt="" loading="lazy" className="h-full w-full object-cover" />}
                  {s.title && (
                    <span className="absolute inset-x-0 bottom-0 line-clamp-1 bg-gradient-to-t from-black/80 to-transparent px-2 pb-1.5 pt-4 text-[12px] font-semibold">{s.title}</span>
                  )}
                </div>
              ))}
            </div>
            <div className="absolute inset-x-0 bottom-0 flex h-32 items-end justify-center bg-gradient-to-t from-[#07101f] from-15% to-transparent pb-5">
              <a href="#plans" className="inline-flex min-h-[48px] items-center rounded-full bg-[#ff5910] px-6 font-bold text-white hover:opacity-90">
                Unlock it all
              </a>
            </div>
          </div>
        </div>
      </Section>

      {/* Watch anywhere */}
      <Section bg={bgs.devices} className="px-4 py-14 sm:px-6" base={{ backgroundColor: "#0b1729" }}>
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-8">
          <div className="min-w-0 flex-[1_1_380px]">
            <Eyebrow>Watch anywhere</Eyebrow>
            <H2 className="mb-3 mt-1.5">One account. Every screen.</H2>
            <p className="text-lg leading-relaxed text-[#b6c3d6]">
              Members get our Android app and our TV app for Fire TV, Android TV and Google TV. Or just open the website on any computer, iPhone or tablet.
            </p>
          </div>
          <div className="grid min-w-0 flex-[1_1_520px] gap-3 text-center [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
            {[
              ["TV", "Fire TV · Android TV · Google TV"],
              ["Phone and tablet", "Android app · iPhone home screen"],
              ["Computer", "Any web browser"],
            ].map(([t, s]) => (
              <div key={t} className="rounded-2xl bg-[#13233d] px-3 py-5">
                <p className="text-lg font-bold">{t}</p>
                <p className="text-sm text-[#a9b7cb]">{s}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* Plans */}
      <Section id="plans" bg={bgs.plans} className="px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-[1240px]">
          <div className="text-center">
            <Eyebrow>Plans</Eyebrow>
            <H2 className="mb-2 mt-1.5">Pick your plan</H2>
            <p className="mb-8 text-[17px] text-[#b6c3d6]">Every plan includes live streams, replays, highlights and the apps. Cancel anytime.</p>
          </div>
          <div className="grid items-stretch gap-5 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
            {PLANS.map((p) => (
              <div
                key={p.id}
                className={`relative flex flex-col gap-3.5 rounded-[20px] p-7 ${
                  p.popular ? "border-2 border-[#ff5910] bg-gradient-to-b from-[#1a2c4d] to-[#0d1a2e]" : "border border-white/10 bg-[#0d1a2e]"
                }`}
              >
                {p.popular && (
                  <span className="absolute -top-3.5 left-7 rounded-full bg-[#ff5910] px-3.5 py-1 text-[13px] font-extrabold uppercase tracking-wide">Most popular</span>
                )}
                <p className="text-xl font-bold">{p.name}</p>
                <p>
                  <span className="font-display text-[52px] leading-none">{p.price}</span>
                  <span className="text-[#a9b7cb]"> {p.period}</span>
                </p>
                <p className="text-[#b6c3d6]">{p.blurb}</p>
                <ul className="list-disc space-y-1.5 pl-5 text-[#d4dceb]">
                  {p.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                <Link
                  to="/auth?mode=signup"
                  onClick={() => pickPlan(p.id)}
                  className={`mt-auto flex min-h-[50px] items-center justify-center rounded-full font-bold ${
                    p.popular ? "bg-[#ff5910] text-white hover:opacity-90" : "border border-white/30 text-white hover:bg-white/5"
                  }`}
                >
                  Choose {p.name}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* Trust */}
      <Section bg={bgs.trust} className="px-4 py-14 sm:px-6" base={{ backgroundColor: "#0b1729" }}>
        <div className="mx-auto max-w-[1240px]">
          <H2 className="mb-6 text-center">Why fans trust us</H2>
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
            {TRUST.map((t) => (
              <div key={t.title} className="rounded-2xl bg-[#13233d] p-5">
                <h3 className="mb-1.5 text-lg font-bold text-white">{t.title}</h3>
                <p className="leading-relaxed text-[#b6c3d6]">{t.text}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-[860px] px-4 py-16 sm:px-6">
        <H2 className="mb-5">Questions</H2>
        <div className="flex flex-col gap-2.5">
          {FAQ.map((f) => (
            <details key={f.q} className="rounded-xl bg-[#0d1a2e] px-4 py-4">
              <summary className="cursor-pointer text-[17px] font-bold text-white">{f.q}</summary>
              <p className="mt-2.5 text-[#b6c3d6]">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Final call */}
      <div className="px-4 pb-16 sm:px-6">
        <Section
          bg={bgs.join}
          className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-5 rounded-3xl px-7 py-11"
          base={{ background: "linear-gradient(120deg, #0f2a52, #1a2c4d 60%, #3a1d10)" }}
        >
          <div>
            <H2>Join MetsXMFanZone today</H2>
            <p className="mt-1.5 text-[17px] text-[#c4cfdf]">
              From $3.99 a week. Cancel anytime. Already a member?{" "}
              <Link to="/auth?mode=login" className="font-bold text-[#ff7a3d] hover:underline">
                Sign in
              </Link>
            </p>
          </div>
          <Link to="/auth?mode=signup" className="inline-flex min-h-[54px] items-center rounded-full bg-[#ff5910] px-8 text-lg font-bold text-white hover:opacity-90">
            Join now
          </Link>
        </Section>
      </div>
    </div>
  );
}
