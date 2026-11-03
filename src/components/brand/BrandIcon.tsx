import type { LucideIcon } from "lucide-react";
import logo from "@/assets/metsxmfanzone-logo.png";

const TONES = {
  orange: "bg-[#ff4400]",
  red: "bg-[#d71919]",
  blue: "bg-[#1d78dc]",
  green: "bg-[#1fa85a]",
} as const;
export type BrandTone = keyof typeof TONES;

/** The MetsXMFanZone icon tile used across the site: logo on a dark blue square with an orange edge, and a round badge showing what it is. */
export default function BrandIcon({ icon: Icon, size = 32, tone = "orange", className = "" }: { icon: LucideIcon; size?: number; tone?: BrandTone; className?: string }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size }}
      className={`relative inline-block shrink-0 overflow-hidden rounded-[24%] border border-[#ff4400]/80 bg-gradient-to-br from-[#0f4f93] to-[#07111d] ${className}`}
    >
      <img src={logo} alt="" draggable={false} className="absolute left-[8%] top-[10%] w-[84%] object-contain" />
      <span className={`absolute -bottom-[6%] -right-[6%] flex h-[56%] w-[56%] items-center justify-center rounded-full border-[1.5px] border-[#07111d] ${TONES[tone]}`}>
        <Icon className="h-[60%] w-[60%] text-white" strokeWidth={2.6} />
      </span>
    </span>
  );
}
