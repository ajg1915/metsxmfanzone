import { useLocation } from "react-router-dom";
import { getHoliday } from "@/lib/holiday";

export function HolidayRibbon({ tv = false }: { tv?: boolean }) {
  const { search } = useLocation();
  const h = getHoliday(new Date(), search);
  if (!h) return null;
  const text =
    h === "thanksgiving"
      ? "🦃 Happy Thanksgiving from MetsXMFanZone 🍂"
      : "🎄 Happy Holidays from MetsXMFanZone 🎅";
  return (
    <div
      role="status"
      className={tv ? "w-full overflow-hidden whitespace-nowrap bg-gradient-to-r from-[#002D72] via-[#FF5910] to-[#002D72] px-[2vw] py-[0.8vh] text-center text-[1.3rem] font-bold uppercase leading-tight tracking-wide text-white" : "w-full overflow-hidden whitespace-nowrap bg-gradient-to-r from-[#002D72] via-[#FF5910] to-[#002D72] px-2 py-1 text-center text-[clamp(9px,3.1vw,13px)] font-bold uppercase leading-tight tracking-normal text-white sm:py-1.5 sm:text-sm sm:tracking-wide"}
    >
      {text}
    </div>
  );
}
