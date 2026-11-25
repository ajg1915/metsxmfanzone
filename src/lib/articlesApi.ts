// Articles live on Cloudflare (D1 database "metsxm-articles") since Nov 2026.
// Every page that shows, edits or counts articles goes through this file, which talks to
// the "articles-api" Worker. Sign-in still uses the normal site login (Supabase auth).
import { supabase } from "@/integrations/supabase/client";

export const ARTICLES_API =
  (import.meta.env.VITE_ARTICLES_API as string | undefined) || "https://articles-api.metsxmfan.workers.dev";

export interface Article {
  id: string;
  user_id: string | null;
  title: string;
  slug: string;
  content?: string | null;
  excerpt: string | null;
  featured_image_url: string | null;
  audio_url?: string | null;
  category: string | null;
  tags: string[];
  published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string | null;
  scheduled_publish_at?: string | null;
  is_draft?: boolean;
  approval_status: string | null;
  meta_description: string | null;
}

export type ArticleFields = "card" | "full" | "seo";
type DateField = "published_at" | "created_at" | "updated_at";

export interface ListOptions {
  limit?: number;
  offset?: number;
  category?: string;
  exclude?: string;
  since?: string;
  until?: string;
  dateField?: DateField;
  order?: DateField;
  fields?: ArticleFields;
}

function query(opts: Record<string, unknown>): string {
  const q = new URLSearchParams();
  const map: Record<string, string> = { dateField: "date_field" };
  for (const [k, v] of Object.entries(opts)) {
    if (v === undefined || v === null || v === "") continue;
    q.set(map[k] || k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

async function call<T>(path: string, init: RequestInit = {}, signedIn = false): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (signedIn) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Please sign in again");
    headers.Authorization = `Bearer ${token}`;
  }
  let lastError: unknown;
  // One quick retry for a dropped connection on reads.
  const tries = !init.method || init.method === "GET" ? 2 : 1;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(`${ARTICLES_API}${path}`, { ...init, headers: { ...headers, ...(init.headers || {}) } });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error(body?.error || `Articles service error (${res.status})`) as Error & { status?: number };
        err.status = res.status;
        throw err;
      }
      return body as T;
    } catch (e) {
      lastError = e;
      if ((e as { status?: number }).status) break; // a real answer from the service, do not retry
    }
  }
  throw lastError;
}

// ---------- public (published articles only) ----------
export async function listPublishedArticles(opts: ListOptions = {}): Promise<Article[]> {
  const { posts } = await call<{ posts: Article[] }>(`/posts${query({ ...opts })}`);
  return posts;
}

export async function countPublishedArticles(opts: Pick<ListOptions, "since" | "until" | "dateField"> = {}): Promise<number> {
  const { count } = await call<{ count: number }>(`/posts/count${query({ ...opts })}`);
  return count;
}

/** One published article by its URL slug, or null when there is none. */
export async function getPublishedArticle(slug: string): Promise<Article | null> {
  try {
    const { post } = await call<{ post: Article }>(`/posts/${encodeURIComponent(slug)}`);
    return post;
  } catch (e) {
    if ((e as { status?: number }).status === 404) return null;
    throw e;
  }
}

// ---------- signed in (admins: all articles; writers: their own) ----------
export interface ManageListOptions extends ListOptions {
  mine?: boolean;
  status?: "pending" | "approved" | "rejected" | "published" | "unpublished";
}

export async function listManagedArticles(opts: ManageListOptions = {}): Promise<Article[]> {
  const { mine, ...rest } = opts;
  const { posts } = await call<{ posts: Article[] }>(`/manage/posts${query({ ...rest, mine: mine ? 1 : undefined })}`, {}, true);
  return posts;
}

export async function countManagedArticles(
  opts: Pick<ListOptions, "since" | "until" | "dateField"> & { published?: boolean } = {},
): Promise<number> {
  const { count } = await call<{ count: number }>(`/manage/posts/count${query({ ...opts })}`, {}, true);
  return count;
}

export async function getManagedArticle(id: string): Promise<Article | null> {
  try {
    const { post } = await call<{ post: Article }>(`/manage/posts/${encodeURIComponent(id)}`, {}, true);
    return post;
  } catch (e) {
    const s = (e as { status?: number }).status;
    if (s === 404 || s === 403) return null;
    throw e;
  }
}

export async function isSlugAvailable(slug: string, exceptId?: string): Promise<boolean> {
  const { available } = await call<{ available: boolean }>(
    `/manage/slug-available${query({ slug, exclude: exceptId })}`,
    {},
    true,
  );
  return available;
}

export type ArticleInput = Partial<Omit<Article, "tags">> & { tags?: string[] | null };

export async function createArticle(input: ArticleInput): Promise<Article> {
  const { post } = await call<{ post: Article }>(`/manage/posts`, { method: "POST", body: JSON.stringify(input) }, true);
  return post;
}

export async function updateArticle(id: string, patch: ArticleInput): Promise<Article> {
  const { post } = await call<{ post: Article }>(
    `/manage/posts/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(patch) },
    true,
  );
  return post;
}

export async function deleteArticle(id: string): Promise<void> {
  await call(`/manage/posts/${encodeURIComponent(id)}`, { method: "DELETE" }, true);
}

/** Titles for a set of article ids (for view stats, hero slides, stories). */
export async function articleTitlesById(ids: string[]): Promise<Map<string, Article>> {
  const out = new Map<string, Article>();
  if (!ids.length) return out;
  const posts = await listManagedArticles({ limit: 2000 }).catch(() => listPublishedArticles({ limit: 500 }));
  for (const p of posts) if (ids.includes(p.id)) out.set(p.id, p);
  return out;
}

/** Wraps an articles call in the { data, error } shape the Supabase client used, for Promise.all blocks. */
export async function asResult<T>(p: Promise<T>): Promise<{ data: T | null; error: Error | null }> {
  try {
    return { data: await p, error: null };
  } catch (e) {
    console.error("Articles service:", e);
    return { data: null, error: e as Error };
  }
}

/** Adds the author's profile ({ full_name, email }) to each article, as the old Supabase join did. */
export async function withAuthors<T extends { user_id: string | null }>(
  posts: T[],
): Promise<(T & { profiles: { full_name: string | null; email: string | null } | null })[]> {
  const ids = [...new Set(posts.map((p) => p.user_id).filter(Boolean))] as string[];
  const byId = new Map<string, { full_name: string | null; email: string | null }>();
  if (ids.length) {
    const { data } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
    for (const p of (data as { id: string; full_name: string | null; email: string | null }[] | null) || []) {
      byId.set(p.id, { full_name: p.full_name, email: p.email });
    }
  }
  return posts.map((p) => ({ ...p, profiles: (p.user_id && byId.get(p.user_id)) || null }));
}
