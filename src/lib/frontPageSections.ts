// Front page (signed out) sections whose background an admin can set in Admin › Backgrounds.
export const FRONT_PAGE_SECTIONS = [
  { key: "home_hero", label: "Front page: top section" },
  { key: "home_fans", label: "Front page: fans and podcast band" },
  { key: "home_features", label: "Front page: what you get" },
  { key: "home_inside", label: "Front page: a look inside" },
  { key: "home_devices", label: "Front page: watch anywhere" },
  { key: "home_plans", label: "Front page: plans" },
  { key: "home_trust", label: "Front page: why fans trust us" },
  { key: "home_join", label: "Front page: join (bottom)" },
] as const;

export type FrontPageSection = (typeof FRONT_PAGE_SECTIONS)[number]["key"];
