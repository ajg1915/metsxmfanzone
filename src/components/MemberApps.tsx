import { useState } from "react";
import { Link } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { Check, Copy, Download, LockKeyhole, Smartphone, Tv } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";

// Member Center: the Android app and the TV app, for paid members only.
const TV_CODE = "6750144";
const ANDROID_URL = "https://metsxmfanzone.com/android-app";
const TV_URL = "https://metsxmfanzone.com/tv-app";

export default function MemberApps() {
  const { isPremium, loading } = useSubscription();
  const [copied, setCopied] = useState(false);

  if (loading) return null;

  const copy = () => {
    void navigator.clipboard?.writeText(TV_CODE);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="p-0" aria-labelledby="member-apps">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="member-apps" className="text-xl text-foreground">Get the apps</h2>
        {isPremium && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-300">
            <Check className="h-3.5 w-3.5" /> Paid member
          </span>
        )}
      </div>

      {!isPremium ? (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-border/50 bg-card/70 p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/15">
            <LockKeyhole className="h-5 w-5 text-primary" />
          </div>
          <h3 className="text-lg font-bold text-foreground">Apps are for paid members</h3>
          <p className="max-w-xl text-sm text-muted-foreground">
            Pick Weekly, Monthly or Yearly to unlock the Android app and the TV app for Fire TV, Android TV and Google TV.
          </p>
          <Link to="/pricing" className="inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground hover:opacity-90">
            See plans
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* TV app */}
          <div className="flex flex-col gap-4 rounded-xl border border-border/50 bg-card/70 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-secondary/40"><Tv className="h-6 w-6 text-primary" /></div>
              <div>
                <h3 className="text-lg font-bold text-foreground">MetsXMFanZone TV</h3>
                <p className="text-xs text-muted-foreground">Fire TV · Android TV · Google TV</p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg bg-secondary/30 px-4 py-3">
              <div>
                <p className="text-xs text-muted-foreground">Downloader code</p>
                <p className="font-display text-4xl tracking-[0.08em] text-foreground">{TV_CODE}</p>
              </div>
              <button type="button" onClick={copy} className="inline-flex h-11 items-center gap-2 rounded-full border border-border/60 px-4 text-sm font-semibold text-foreground hover:border-primary/60">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
              <li>On your TV, install the free <b className="text-foreground">Downloader</b> app.</li>
              <li>Open it, type <b className="text-foreground">{TV_CODE}</b> and press Go.</li>
              <li>Install, open MetsXMFanZone TV and sign in.</li>
            </ol>
            <a href={TV_URL} className="mt-auto inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary text-sm font-bold text-primary-foreground hover:opacity-90">
              <Download className="h-4 w-4" /> Download TV app (.apk)
            </a>
          </div>

          {/* Android phone and tablet app */}
          <div className="flex flex-col gap-4 rounded-xl border border-border/50 bg-card/70 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-secondary/40"><Smartphone className="h-6 w-6 text-primary" /></div>
              <div>
                <h3 className="text-lg font-bold text-foreground">MetsXMFanZone for Android</h3>
                <p className="text-xs text-muted-foreground">Phones and tablets</p>
              </div>
            </div>
            <div className="hidden items-center gap-4 rounded-lg bg-secondary/30 p-4 md:flex">
              <div className="shrink-0 rounded-md bg-white p-2"><QRCodeSVG value={ANDROID_URL} size={88} /></div>
              <p className="text-sm text-muted-foreground">On a computer? Scan this with your phone's camera to download it straight to your phone.</p>
            </div>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Tap Download on your Android phone or tablet.</li>
              <li>If asked, allow installs from your browser.</li>
              <li>Open the app and sign in.</li>
            </ol>
            <a href={ANDROID_URL} className="mt-auto inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary text-sm font-bold text-primary-foreground hover:opacity-90">
              <Download className="h-4 w-4" /> Download Android app (.apk)
            </a>
          </div>

          <p className="text-xs text-muted-foreground md:col-span-2">
            iPhone and iPad: open metsxmfanzone.com in Safari, tap Share, then Add to Home Screen.
          </p>
        </div>
      )}
    </section>
  );
}
