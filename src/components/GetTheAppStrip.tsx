import { Link } from "react-router-dom";
import { Bell, Share, SquarePlus } from "lucide-react";
import { AndroidIcon } from "@/components/icons/AndroidIcon";
import { useNotifications } from "@/hooks/useNotifications";

// A quiet strip at the bottom of the home page (never a popup): how to get the app,
// add the site to the home screen, and turn on game alerts.
const GetTheAppStrip = () => {
  const { permission, requestPermission } = useNotifications();
  const canAsk = typeof window !== "undefined" && "Notification" in window && permission === "default";

  const tile = "flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4";
  const icon = "mt-0.5 h-5 w-5 shrink-0 text-[#ff8a57]";

  return (
    <section aria-labelledby="get-app-title" className="bg-[#06101c] px-5 py-8 md:px-8 md:py-10">
      <div className="mx-auto max-w-[1240px]">
        <p className="text-xs font-bold tracking-[0.14em] text-[#ff8a57]">GET THE APP</p>
        <h2 id="get-app-title" className="font-display text-3xl uppercase leading-none text-white md:text-4xl">
          Keep MetsXMFanZone one tap away
        </h2>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <a href="/android-app" className={`${tile} transition hover:border-[#ff4500]/60`}>
            <AndroidIcon className={icon} />
            <span>
              <span className="block font-semibold text-white">Android app</span>
              <span className="block text-sm text-[#c3cfdb]">Download the MetsXMFanZone app for Android.</span>
            </span>
          </a>
          <div className={tile}>
            <span className="mt-0.5 flex shrink-0 gap-1 text-[#ff8a57]"><Share className="h-5 w-5" /><SquarePlus className="h-5 w-5" /></span>
            <span>
              <span className="block font-semibold text-white">Add it to your home screen</span>
              <span className="block text-sm text-[#c3cfdb]">iPhone: tap Share, then Add to Home Screen. Android: open the browser menu and tap Add to Home screen.</span>
              <Link to="/install" className="mt-1 inline-block text-sm font-semibold text-[#ff8a57] underline underline-offset-2">Step-by-step help</Link>
            </span>
          </div>
          {canAsk ? (
            <button type="button" onClick={() => void requestPermission()} className={`${tile} text-left transition hover:border-[#ff4500]/60`}>
              <Bell className={icon} />
              <span>
                <span className="block font-semibold text-white">Turn on game alerts</span>
                <span className="block text-sm text-[#c3cfdb]">Get live game and breaking Mets news alerts on this device.</span>
              </span>
            </button>
          ) : (
            <Link to="/install" className={`${tile} transition hover:border-[#ff4500]/60`}>
              <Bell className={icon} />
              <span>
                <span className="block font-semibold text-white">All install options</span>
                <span className="block text-sm text-[#c3cfdb]">Step-by-step help for the MetsXMFanZone app.</span>
              </span>
            </Link>
          )}
        </div>
      </div>
    </section>
  );
};

export default GetTheAppStrip;
