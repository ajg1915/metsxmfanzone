import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Page SEO managed from Admin → SEO Settings (table: seo_settings).
 * Loaded once per visit and cached in sessionStorage; SEOHead applies the
 * row for the current path over whatever the page component passes in.
 */
export interface SeoOverride {
  page_path: string;
  title: string;
  description: string;
  keywords: string | null;
  og_title: string | null;
  og_description: string | null;
  og_image: string | null;
  canonical_url: string | null;
  robots: string | null;
}

const CACHE_KEY = "seo-overrides-v1";
const CACHE_MS = 5 * 60 * 1000;

export const normalizeSeoPath = (p: string) => {
  const trimmed = (p || "/").trim().split(/[?#]/)[0];
  const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withSlash === "/" ? "/" : withSlash.replace(/\/+$/, "").toLowerCase();
};

let overrides: Map<string, SeoOverride> = new Map();
let loaded = false;
let started = false;
const listeners = new Set<() => void>();

function setRows(rows: SeoOverride[]) {
  overrides = new Map(rows.map((r) => [normalizeSeoPath(r.page_path), r]));
  loaded = true;
  listeners.forEach((l) => l());
}

function load() {
  if (started || typeof window === "undefined") return;
  started = true;

  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (raw) {
      const cached = JSON.parse(raw);
      if (Date.now() - cached.at < CACHE_MS && Array.isArray(cached.rows)) {
        setRows(cached.rows);
        return;
      }
    }
  } catch { /* storage unavailable */ }

  supabase
    .from("seo_settings")
    .select("page_path, title, description, keywords, og_title, og_description, og_image, canonical_url, robots")
    .then(({ data, error }) => {
      if (error || !data) { loaded = true; listeners.forEach((l) => l()); return; }
      setRows(data as SeoOverride[]);
      try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), rows: data })); } catch { /* quota */ }
    });
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  load();
  return () => listeners.delete(cb);
}

let version = 0;
listeners.add(() => { version++; });
const getSnapshot = () => version;

/** Returns the admin-managed SEO row for a path, or undefined. Re-renders when settings load. */
export function useSeoOverride(path: string): SeoOverride | undefined {
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return overrides.get(normalizeSeoPath(path));
}

export const seoOverridesLoaded = () => loaded;

/** Call after saving in the admin so the next page view picks up changes. */
export function clearSeoOverrideCache() {
  try { sessionStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
  started = false;
  load();
}
