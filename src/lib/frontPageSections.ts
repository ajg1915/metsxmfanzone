import { useQuery } from "@tanstack/react-query";
import type { CSSProperties } from "react";
import { supabase } from "@/integrations/supabase/client";

// The signed-out front page's sections. An admin can give each one its own colour and/or a
// background image (Admin › Settings › Front Page). Saved in site_settings.front_page_sections.
export const FRONT_PAGE_SETTING_KEY = "front_page_sections";

export const FRONT_PAGE_SECTIONS = [
  { key: "hero", label: "Top section", defaultColor: "#07101f" },
  { key: "fans", label: "Fans and podcast band", defaultColor: "#002d72" },
  { key: "features", label: "What you get", defaultColor: "#07101f" },
  { key: "inside", label: "A look inside", defaultColor: "#07101f" },
  { key: "devices", label: "Watch anywhere", defaultColor: "#0b1729" },
  { key: "plans", label: "Plans", defaultColor: "#07101f" },
  { key: "trust", label: "Why fans trust us", defaultColor: "#0b1729" },
  { key: "join", label: "Join MetsXMFanZone (bottom)", defaultColor: "#0f2a52" },
  // Picture on the little TV screen (top section) and the "Live now" banner in the members preview.
  // Empty = the MetsXMFanZone TV channel's own picture.
  { key: "tv", label: "MetsXMFanZone TV picture", defaultColor: "#0a1d3d", imageOnly: true },
] as const;

export type FrontPageSection = (typeof FRONT_PAGE_SECTIONS)[number]["key"];

export interface SectionStyle {
  /** Solid colour behind the section (replaces the built-in design colour). */
  color?: string;
  /** Background image URL (R2). */
  image?: string;
  /** How dark the shade over the image is, 0–90 (%). */
  dim?: number;
}

export type FrontPageStyles = Partial<Record<FrontPageSection, SectionStyle>>;

export function useFrontPageStyles() {
  return useQuery({
    queryKey: ["front-page-sections"],
    queryFn: async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("setting_value")
        .eq("setting_key", FRONT_PAGE_SETTING_KEY)
        .maybeSingle();
      return ((data?.setting_value as FrontPageStyles | null) ?? {}) as FrontPageStyles;
    },
    staleTime: 5 * 60_000,
  });
}

/** The CSS for a section: the admin's image (with a shade) or colour, else the built-in look. */
export function sectionStyle(style: SectionStyle | undefined, base?: CSSProperties): CSSProperties {
  if (style?.image) {
    const dim = Math.min(90, Math.max(0, style.dim ?? 65)) / 100;
    const shade = `rgba(7,16,31,${dim})`;
    return {
      backgroundColor: style.color || "#07101f",
      backgroundImage: `linear-gradient(${shade}, ${shade}), url("${style.image.replace(/"/g, "%22")}")`,
      backgroundSize: "cover",
      backgroundPosition: "center",
    };
  }
  if (style?.color) return { background: style.color };
  return { ...base };
}
