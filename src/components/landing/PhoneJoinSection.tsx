import { Link } from "react-router-dom";
import { Mic, Smartphone, Tv } from "lucide-react";
import metsLogo from "@/assets/metsxmfanzone-logo.png";

// Last section of the phone home page for visitors who aren't signed in: who we are, when the
// podcast is live, where you can watch, and one clear way to join.
export default function PhoneJoinSection() {
  return (
    <section className="px-4 pb-28 pt-8">
      <div
        className="relative overflow-hidden rounded-3xl border border-white/10 p-6 text-[#f2f5fa]"
        style={{
          background:
            "radial-gradient(90% 60% at 100% 0%, rgba(255,89,16,0.35), transparent 60%), repeating-linear-gradient(90deg, rgba(255,255,255,0.04) 0 2px, transparent 2px 34px), linear-gradient(160deg, #002d72 0%, #0b1f4a 55%, #07101f 100%)",
        }}
      >
        <svg aria-hidden="true" viewBox="0 0 200 200" className="pointer-events-none absolute -bottom-24 -right-24 h-64 w-64 opacity-[0.16]">
          <circle cx="100" cy="100" r="96" fill="#f2f5fa" />
          <path d="M38 30 C70 70 70 130 38 170" fill="none" stroke="#e11d48" strokeWidth="4" strokeDasharray="7 6" />
          <path d="M162 30 C130 70 130 130 162 170" fill="none" stroke="#e11d48" strokeWidth="4" strokeDasharray="7 6" />
        </svg>

        <div className="relative flex flex-col gap-5">
          <img src={metsLogo} alt="MetsXMFanZone" className="h-16 w-auto self-start" />
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#ffb48f]">By fans, for fans</p>
            <h2 className="mt-1 font-display text-[40px] uppercase leading-[0.95] text-white">We bleed orange and blue</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-[#d4dceb]">
              Run by lifelong Mets fans. We celebrate the wins, sweat the losses and talk every game with you, live.
            </p>
          </div>

          <div className="rounded-2xl bg-white/[0.08] p-4">
            <div className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-wider text-[#ffb48f]">
              <Mic className="h-4 w-4" /> The podcast, live
            </div>
            <p className="mt-1 font-display text-2xl uppercase text-white">Mondays &amp; Fridays</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {["6:00 AM", "8:30 AM", "5:00 PM"].map((t) => (
                <span key={t} className="rounded-full bg-[#ff5910]/20 px-3 py-1 text-sm font-semibold text-white">{t} ET</span>
              ))}
            </div>
            <p className="mt-2 text-sm text-[#c4cfdf]">New episodes to listen to every day.</p>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { icon: Tv, label: "TV app" },
              { icon: Smartphone, label: "Android app" },
              { icon: Smartphone, label: "iPhone" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="rounded-xl bg-white/[0.08] px-2 py-3">
                <Icon className="mx-auto h-5 w-5 text-[#ff7a3d]" />
                <p className="mt-1 text-xs font-semibold text-white">{label}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <Link to="/auth?mode=signup" className="flex min-h-[52px] items-center justify-center rounded-full bg-[#ff5910] text-[17px] font-bold text-white shadow-lg shadow-[#ff5910]/30 active:opacity-90">
              Join MetsXMFanZone
            </Link>
            <p className="text-center text-sm text-[#c4cfdf]">
              From $3.99 a week · Cancel anytime ·{" "}
              <Link to="/auth?mode=login" className="font-bold text-[#ff7a3d]">Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
