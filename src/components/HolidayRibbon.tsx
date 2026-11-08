import { useLocation } from "react-router-dom";
import { getHoliday } from "@/lib/holiday";

export function HolidayRibbon() {
  const { search } = useLocation();
  const h = getHoliday(new Date(), search);
  if (!h) return null;
  const text =
    h === "thanksgiving"
      ? "🦃 Happy Thanksgiving from the MetsXMFanZone family! 🍂"
      : "🎄 Happy Holidays from MetsXMFanZone! LFGM 🎅";
  return (
    <div
      role="status"
      className="w-full bg-gradient-to-r from-[#002D72] via-[#FF5910] to-[#002D72] py-1.5 text-center text-xs font-bold uppercase tracking-wide text-white sm:text-sm"
    >
      {text}
    </div>
  );
}
