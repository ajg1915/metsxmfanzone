import { Link } from "react-router-dom";
import { sectionStyle, type SectionStyle } from "@/lib/frontPageSections";

// The membership plans, shown on the signed-out front page and on the phone home page.
const PLANS = [
  {
    id: "weekly",
    name: "Weekly",
    price: "$3.99",
    period: "/ week",
    blurb: "Try it for a series.",
    features: ["Everything in Free", "All live streams", "Full game replays", "All highlights", "HD streaming"],
  },
  {
    id: "premium",
    name: "Monthly",
    price: "$9.99",
    period: "/ month",
    blurb: "The full season experience.",
    features: ["Everything in Weekly", "Ad-free experience", "Exclusive content", "Watch on all your devices (Android + TV apps)"],
    popular: true,
  },
  {
    id: "annual",
    name: "Yearly",
    price: "$129.99",
    period: "/ year",
    blurb: "One payment, the whole year.",
    features: ["Everything in Monthly", "Merch discounts", "VIP community badge", "Priority support", "Early access to content"],
  },
];

const pickPlan = (id: string) => {
  try {
    localStorage.setItem("pending_signup_plan", id);
  } catch {
    /* private mode */
  }
};

export default function PlansSection({ bg }: { bg?: SectionStyle }) {
  return (
      <section id="plans" className="relative overflow-hidden px-4 py-12 sm:px-6 sm:py-16" style={sectionStyle(bg)}>
        <div className="mx-auto max-w-[1240px]">
          <div className="text-center">
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-[#ff7a3d]">Plans</p>
            <h2 className="mb-2 mt-1.5 font-display text-[clamp(32px,4vw,48px)] uppercase leading-none text-white">Pick your plan</h2>
            <p className="mb-7 text-base text-[#b6c3d6] sm:mb-8 sm:text-[17px]">Every plan includes live streams, replays, highlights and the apps. Cancel anytime.</p>
          </div>
          <div className="grid items-stretch gap-5 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]">
            {PLANS.map((p) => (
              <div
                key={p.id}
                className={`relative flex flex-col gap-3 rounded-[20px] p-5 sm:gap-3.5 sm:p-7 ${
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
      </section>
  );
}
