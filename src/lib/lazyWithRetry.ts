import { lazy, type ComponentType, type LazyExoticComponent } from "react";

const RECOVERABLE_DYNAMIC_IMPORT_MESSAGES = [
  "Failed to fetch dynamically imported module",
  "Importing a module script failed",
  "error loading dynamically imported module",
  "Failed to load module script",
];

const CACHE_BUST_QUERY_PARAM = "__lovable_chunk_retry";

const getErrorMessage = (error: unknown) => {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message ?? "");
  }
  return String(error ?? "");
};

export const isRecoverableDynamicImportError = (error: unknown) => {
  const message = getErrorMessage(error);
  return RECOVERABLE_DYNAMIC_IMPORT_MESSAGES.some((fragment) =>
    message.includes(fragment)
  );
};

export const reloadForFreshAssets = (
  storageKey = "__stale_chunk_reloaded_at",
  cooldownMs = 10_000
) => {
  if (typeof window === "undefined") return false;

  const lastAttempt = Number(sessionStorage.getItem(storageKey) || 0);
  if (Date.now() - lastAttempt < cooldownMs) {
    return false;
  }

  sessionStorage.setItem(storageKey, String(Date.now()));

  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set(CACHE_BUST_QUERY_PARAM, String(Date.now()));
  window.location.replace(nextUrl.toString());

  return true;
};

type ImportFactory<T extends ComponentType<any>> = () => Promise<{ default: T }>;

export const lazyWithRetry = <T extends ComponentType<any>>(
  importer: ImportFactory<T>,
  retryKey: string
): LazyExoticComponent<T> => {
  const storageKey = `__lazy_chunk_retry__:${retryKey}`;

  return lazy(async () => {
    try {
      const module = await importer();
      sessionStorage.removeItem(storageKey);
      return module;
    } catch (error) {
      if (isRecoverableDynamicImportError(error)) {
        // One in-place retry first — transient network blips are common on
        // mobile and shouldn't force a full page reload.
        try {
          await new Promise((resolve) => setTimeout(resolve, 600));
          const module = await importer();
          sessionStorage.removeItem(storageKey);
          return module;
        } catch (retryError) {
          if (reloadForFreshAssets(storageKey)) {
            return new Promise<never>(() => {});
          }
          throw retryError;
        }
      }

      throw error;
    }
  });
};
