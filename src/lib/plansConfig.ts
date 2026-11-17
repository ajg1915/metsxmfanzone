import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { NY_SPORTS_NETWORK_PAGES, NY_TEAM_PAGES, isNYTeamStream } from "@/lib/nyTeamStreamCheck";

// Plans and what each plan can watch. An admin edits this in Admin > Plans and Access; it is saved in
// site_settings.plans_config. If the setting is missing or broken, the defaults below apply, so a bad
// edit can never lock paying members out.
export const PLANS_SETTING_KEY = "plans_config";

export type PlanId = "weekly" | "premium" | "annual";
export const PLAN_IDS: PlanId[] = ["weekly", "premium", "annual"];

/** What a plan can use. Streams are grouped into the first five; highlights and apps are features. */
export type AccessKey =
  | "springTraining"
  | "metsxmfanzone"
  | "premiumPlatforms"
  | "nyTeams"
  | "otherStreams"
  | "highlights"
  | "apps";

export const ACCESS_KEYS: { key: AccessKey; label: string; hint: string }[] = [
  { key: "springTraining", label: "Spring Training streams", hint: "The Spring Training page and its games" },
  { key: "metsxmfanzone", label: "MetsXMFanZone streams", hint: "The MetsXMFanZone TV page and streams assigned to it" },
  { key: "premiumPlatforms", label: "Apple TV, Prime Video, Peacock", hint: "Premium platform pages and network channels" },
  { key: "nyTeams", label: "NY team streams", hint: "Jets, Giants, Knicks, Rangers, Islanders, Nets" },
  { key: "otherStreams", label: "All other streams", hint: "Every other live game or event page" },
  { key: "highlights", label: "Highlights", hint: "The Highlights page" },
  { key: "apps", label: "Android and TV apps", hint: "App downloads and TV Mode" },
];

export type PlanAccess = Record<AccessKey, boolean>;

export interface PlanDef {
  name: string;
  /** Price in dollars. Changing it creates a new PayPal billing plan for new signups. */
  price: number;
  /** Fixed by the billing interval: "per week", "per month", "per year". */
  period: string;
  billingNote: string;
  description: string;
  cta: string;
  popular: boolean;
  features: string[];
  notIncluded: string[];
  access: PlanAccess;
}

export type PlansConfig = Record<PlanId, PlanDef>;

const ALL_ON: PlanAccess = {
  springTraining: true,
  metsxmfanzone: true,
  premiumPlatforms: true,
  nyTeams: true,
  otherStreams: true,
  highlights: true,
  apps: true,
};

export const DEFAULT_PLANS: PlansConfig = {
  weekly: {
    name: "Weekly",
    price: 3.99,
    period: "per week",
    billingNote: "Billed weekly through PayPal",
    description: "MetsXMFanZone streams with a shorter commitment",
    cta: "Choose Weekly",
    popular: false,
    features: ["Mets games", "MetsXMFanZone streams", "Spring Training streams", "Standard quality", "1 device at a time"],
    notIncluded: [
      "Premium games on Apple TV, Prime Video and Peacock (upgrade to watch)",
      "NY team streams",
      "Highlights",
      "HD streaming and ad-free viewing",
      "Android and TV apps",
    ],
    access: {
      springTraining: true,
      metsxmfanzone: true,
      premiumPlatforms: false,
      nyTeams: false,
      otherStreams: true,
      highlights: false,
      apps: false,
    },
  },
  premium: {
    name: "Monthly",
    price: 9.99,
    period: "per month",
    billingNote: "Billed monthly",
    description: "Most popular for true fans",
    cta: "Choose Monthly",
    popular: true,
    features: [
      "Everything in Weekly",
      "Every stream and premium page",
      "Mets game events on Apple TV, Prime Video and Peacock (all 2027 games will also stream on these premium platforms)",
      "Highlights",
      "HD streaming",
      "Ad-free experience",
      "Exclusive content",
      "Up to 2 devices at once",
      "Android + TV apps",
    ],
    notIncluded: [],
    access: { ...ALL_ON },
  },
  annual: {
    name: "Yearly",
    price: 119.88,
    period: "per year",
    billingNote: "Billed annually",
    description: "One payment for a full year",
    cta: "Choose Yearly",
    popular: false,
    features: ["Merch discounts", "VIP community badge", "Priority support", "Early access to content"],
    notIncluded: [],
    access: { ...ALL_ON },
  },
};

const PERIODS: Record<PlanId, string> = { weekly: "per week", premium: "per month", annual: "per year" };

const strList = (v: unknown, fallback: string[]) =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "").map((x) => x.trim()) : fallback;

/** Merge a saved (possibly partial or broken) setting over the defaults, field by field. */
export function mergePlansConfig(saved: unknown): PlansConfig {
  const out = {} as PlansConfig;
  const src = (saved && typeof saved === "object" ? saved : {}) as Record<string, Record<string, unknown> | undefined>;
  for (const id of PLAN_IDS) {
    const d = DEFAULT_PLANS[id];
    const s = (src[id] && typeof src[id] === "object" ? src[id] : {}) as Record<string, unknown>;
    const price = Number(s.price);
    const sAccess = (s.access && typeof s.access === "object" ? s.access : {}) as Record<string, unknown>;
    const access = { ...d.access };
    for (const { key } of ACCESS_KEYS) if (typeof sAccess[key] === "boolean") access[key] = sAccess[key] as boolean;
    out[id] = {
      name: typeof s.name === "string" && s.name.trim() ? s.name.trim() : d.name,
      price: Number.isFinite(price) && price >= 0.5 && price <= 999.99 ? Math.round(price * 100) / 100 : d.price,
      period: PERIODS[id],
      billingNote: typeof s.billingNote === "string" && s.billingNote.trim() ? s.billingNote.trim() : d.billingNote,
      description: typeof s.description === "string" && s.description.trim() ? s.description.trim() : d.description,
      cta: typeof s.cta === "string" && s.cta.trim() ? s.cta.trim() : `Choose ${typeof s.name === "string" && s.name.trim() ? s.name.trim() : d.name}`,
      popular: typeof s.popular === "boolean" ? s.popular : d.popular,
      features: strList(s.features, d.features),
      notIncluded: strList(s.notIncluded, d.notIncluded),
      access,
    };
  }
  return out;
}

export const formatPrice = (price: number) => `$${price.toFixed(2)}`;

export function usePlansConfig() {
  const query = useQuery({
    queryKey: ["plans-config"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings").select("setting_value").eq("setting_key", PLANS_SETTING_KEY).maybeSingle();
      return mergePlansConfig(data?.setting_value);
    },
    placeholderData: DEFAULT_PLANS,
    staleTime: 60_000,
    retry: 1,
  });
  return { config: query.data ?? DEFAULT_PLANS, loading: query.isLoading };
}

export type StreamCategory = Exclude<AccessKey, "highlights" | "apps">;

/** Which access group a stream page belongs to. The stricter groups are checked first. */
export function streamCategory(opts: {
  pageKey?: string | null;
  stream?: { title?: string | null; description?: string | null; assigned_pages?: string[] | null } | null;
}): StreamCategory {
  const keys = [opts.pageKey, ...(opts.stream?.assigned_pages || [])].filter(Boolean).map((k) => String(k).toLowerCase());
  const teamPages: readonly string[] = NY_TEAM_PAGES;
  const networkPages: readonly string[] = NY_SPORTS_NETWORK_PAGES;
  if (keys.some((k) => teamPages.includes(k)) || (opts.stream && isNYTeamStream(opts.stream))) return "nyTeams";
  if (keys.some((k) => networkPages.includes(k))) return "premiumPlatforms";
  if (keys.includes("spring-training-live")) return "springTraining";
  if (keys.includes("metsxmfanzone")) return "metsxmfanzone";
  return "otherStreams";
}
