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
            <p className="mt-1 font-display text-2xl uppercase text-white">When we go live</p>
            <p className="mt-2 text-sm text-[#c4cfdf]">MetsXMFanZone Radio is live every morning 6:30–8:30 AM ET, plus the Afternoon Hour at 5:30 PM ET. Listen to the latest episodes anytime.</p>
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
            <a
              href="https://www.tiktok.com/@metsxmfanzone"
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-[#ff5910] text-[17px] font-bold text-white shadow-lg shadow-[#ff5910]/30 active:opacity-90"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
                <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5c-1.42 0-2.6-1.16-2.6-2.6 0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64 0 3.33 2.76 5.7 5.69 5.7 3.14 0 5.69-2.55 5.69-5.7V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3s-1.88.09-3.24-1.48z" />
              </svg>
              Join the podcast live
            </a>
            <p className="text-center text-sm text-[#c4cfdf]">
              Watch us live on TikTok @metsxmfanzone · Already a member?{" "}
              <Link to="/auth?mode=login" className="font-bold text-[#ff7a3d]">Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
