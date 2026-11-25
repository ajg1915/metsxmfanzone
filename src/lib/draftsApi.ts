import { supabase } from "@/integrations/supabase/client";
import {
  type Article,
  createArticle,
  deleteArticle,
  getManagedArticle,
  listManagedArticles,
  updateArticle,
} from "@/lib/articlesApi";

// Drafts live in the owner's Cloudflare R2 bucket and are served by the
// drafts-api Worker (cloudflare/drafts-api-worker.js). Supabase only gets the
// finished article, when a draft is approved.
export const DRAFTS_API = "https://drafts-api.metsxmfan.workers.dev";

export type DraftStatus = "pending" | "approved" | "rejected";

export interface DraftSummary {
  id: string;
  title: string;
  summary: string;
  category: string;
  tags: string[];
  created_at: string;
  status: DraftStatus;
  word_count: number;
}

export interface Draft {
  id: string;
  slug: string;
  title: string;
  content: string;
  summary: string;
  meta_description: string;
  category: string;
  tags: string[];
  sources: string[];
  status: DraftStatus;
  source?: string;
  created_at: string;
  updated_at: string;
  approved_at?: string;
  rejected_at?: string;
  published_post_id?: string;
  published_slug?: string;
}

/** Result of the originality check (drafts-api Worker, POST /check). */
export interface OriginalityResult {
  level: "pass" | "review" | "no_sources";
  overlap?: number;
  longest_run?: number;
  word_count?: number;
  sources_checked: number;
  sources_failed: string[];
  flagged: { text: string; words: number; source: string }[];
  checked_at?: string;
}

/** Result of the web check (drafts-api Worker, POST /check-web). */
export interface WebCheckResult {
  level: "pass" | "review" | "not_configured" | "bad_key";
  sentences_checked?: number;
  sentences_total?: number;
  matches?: { sentence: string; url: string; title: string; words: number }[];
  possible?: { sentence: string; url: string; title: string; words: number }[];
  stopped?: string | null;
  checked_at?: string;
}

export type DraftEdits = Partial<
  Pick<Draft, "title" | "content" | "summary" | "meta_description" | "category" | "tags">
>;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not signed in");

  let res: Response;
  try {
    res = await fetch(`${DRAFTS_API}${path}`, {
      ...init,
      headers: {
        ...(init?.headers || {}),
        Authorization: `Bearer ${token}`,
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
      },
    });
  } catch {
    throw new Error("Can't reach the drafts service. Check your connection, or that the drafts-api Worker is deployed.");
  }

  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error || `Drafts service error (${res.status})`);
  return body as T;
}

// ----- drafts the daily 5am task saves straight into the blog table -----
// Those are articles in the Cloudflare articles service with approval_status "pending" (or "rejected").
// They show up here beside the Worker's drafts, with ids like "post-<uuid>", so
// this page is the one place to review and approve every waiting article.

const POST_PREFIX = "post-";
export const isPostDraftId = (id: string) => id.startsWith(POST_PREFIX);
const postUuid = (id: string) => id.slice(POST_PREFIX.length);

const wordsOf = (html: string) =>
  (html || "").replace(/<[^>]*>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").split(/\s+/).filter(Boolean).length;

const postStatus = (p: any): DraftStatus =>
  p.approval_status === "rejected" && !p.published ? "rejected" : p.published ? "approved" : "pending";

const postSummary = (p: any): DraftSummary => ({
  id: POST_PREFIX + p.id,
  title: p.title,
  summary: p.excerpt || "",
  category: p.category || "Mets News",
  tags: p.tags || [],
  created_at: p.created_at,
  status: postStatus(p),
  word_count: wordsOf(p.content),
});

const postDraft = (p: any): Draft => ({
  id: POST_PREFIX + p.id,
  slug: p.slug,
  title: p.title,
  content: p.content || "",
  summary: p.excerpt || "",
  meta_description: p.meta_description || "",
  category: p.category || "Mets News",
  tags: p.tags || [],
  sources: [],
  status: postStatus(p),
  source: "blog-table",
  created_at: p.created_at,
  updated_at: p.updated_at || p.created_at,
  published_post_id: p.published ? p.id : undefined,
  published_slug: p.published ? p.slug : undefined,
});

// What counts as what, for articles in the blog table:
//   Waiting    not live, not rejected, no publish date set
//   Published  live, or approved with a future publish date (shown as Scheduled)
//   Rejected   rejected and not live
// Articles come from the Cloudflare articles service (see articlesApi.ts).
const isWaiting = (p: Article) => !p.published && p.approval_status !== "rejected" && !p.scheduled_publish_at;
const isRejected = (p: Article) => !p.published && p.approval_status === "rejected";
const isPublishedOrScheduled = (p: Article) =>
  p.published || (!!p.scheduled_publish_at && p.approval_status === "approved");

async function allPosts(fields: "card" | "full" = "card"): Promise<Article[]> {
  return listManagedArticles({ limit: 2000, fields });
}

async function listPosts(status: DraftStatus): Promise<DraftSummary[]> {
  if (status === "approved") return []; // live articles have their own list, see listPublished
  let rows: Article[];
  try {
    rows = await allPosts("full");
  } catch {
    throw new Error("Could not load the waiting articles from the blog");
  }
  return rows
    .filter(status === "rejected" ? isRejected : isWaiting)
    .slice(0, 50)
    .map(postSummary);
}

async function countPosts(status: "pending" | "rejected"): Promise<number> {
  try {
    return (await allPosts()).filter(status === "rejected" ? isRejected : isWaiting).length;
  } catch {
    throw new Error("Could not count the waiting articles");
  }
}

export interface PublishedPost {
  id: string; // draft-style id, "post-<uuid>"
  postId: string;
  title: string;
  slug: string;
  excerpt: string;
  category: string;
  featured_image_url: string | null;
  live: boolean; // false = scheduled for later
  at: string; // when it went live, or when it will
}

/** Live articles, plus ones scheduled to go live, newest first. */
export async function listPublished(): Promise<PublishedPost[]> {
  let rows: Article[];
  try {
    rows = await allPosts();
  } catch {
    throw new Error("Could not load your published articles");
  }
  return rows
    .filter(isPublishedOrScheduled)
    .slice(0, 100)
    .map((p) => ({
      id: POST_PREFIX + p.id,
      postId: p.id,
      title: p.title,
      slug: p.slug,
      excerpt: p.excerpt || "",
      category: p.category || "",
      featured_image_url: p.featured_image_url || null,
      live: !!p.published,
      at: (p.published ? p.published_at : p.scheduled_publish_at) || p.created_at,
    }));
}

export async function countPublished(): Promise<number> {
  try {
    return (await allPosts()).filter(isPublishedOrScheduled).length;
  } catch {
    throw new Error("Could not count your published articles");
  }
}

export async function deletePost(postId: string): Promise<void> {
  try {
    await deleteArticle(postId);
  } catch {
    throw new Error("Could not delete the article");
  }
}

const workerList = (status: DraftStatus) =>
  request<{ drafts: DraftSummary[] }>(`/drafts?status=${status}`).then((r) => r.drafts);

export async function listDrafts(status: DraftStatus): Promise<DraftSummary[]> {
  const [w, p] = await Promise.allSettled([workerList(status), listPosts(status)]);
  if (w.status === "rejected" && p.status === "rejected") throw w.reason;
  const items = [
    ...(w.status === "fulfilled" ? w.value : []),
    ...(p.status === "fulfilled" ? p.value : []),
  ];
  // If the drafts service is down and nothing else is waiting, say so rather than show "no drafts".
  if (w.status === "rejected" && items.length === 0) throw w.reason;
  return items.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getDraft(id: string): Promise<Draft> {
  if (isPostDraftId(id)) {
    const data = await getManagedArticle(postUuid(id)).catch(() => null);
    if (!data) throw new Error("Draft not found");
    return postDraft(data);
  }
  return request<{ draft: Draft }>(`/drafts/${encodeURIComponent(id)}`).then((r) => r.draft);
}

/** Compares the article text with the source articles it was written from. Nothing is saved. */
export function checkOriginality(text: string, sources: string[]): Promise<OriginalityResult> {
  return request<OriginalityResult>("/check", { method: "POST", body: JSON.stringify({ text, sources }) });
}

/** Searches the web for the article's own sentences. Nothing is saved. */
export function checkWeb(text: string): Promise<WebCheckResult> {
  return request<WebCheckResult>("/check-web", { method: "POST", body: JSON.stringify({ text }) });
}

export async function draftCounts(): Promise<Record<DraftStatus, number>> {
  const [w, pp, pr] = await Promise.allSettled([
    request<Record<DraftStatus, number>>("/drafts/counts"),
    countPosts("pending"),
    countPosts("rejected"),
  ]);
  if (w.status === "rejected" && pp.status === "rejected") throw w.reason;
  const base = w.status === "fulfilled" ? w.value : { pending: 0, approved: 0, rejected: 0 };
  return {
    pending: base.pending + (pp.status === "fulfilled" ? pp.value : 0),
    approved: base.approved,
    rejected: base.rejected + (pr.status === "fulfilled" ? pr.value : 0),
  };
}

export async function updateDraft(id: string, edits: DraftEdits): Promise<Draft> {
  if (isPostDraftId(id)) {
    const patch: Record<string, unknown> = {};
    if (edits.title !== undefined) patch.title = edits.title;
    if (edits.content !== undefined) patch.content = edits.content;
    if (edits.summary !== undefined) patch.excerpt = edits.summary;
    if (edits.meta_description !== undefined) patch.meta_description = edits.meta_description;
    if (edits.category !== undefined) patch.category = edits.category;
    if (edits.tags !== undefined) patch.tags = edits.tags;
    const current = await getManagedArticle(postUuid(id)).catch(() => null);
    if (!current || current.published) throw new Error("Could not save your changes");
    const data = await updateArticle(postUuid(id), patch as any).catch(() => null);
    if (!data) throw new Error("Could not save your changes");
    return postDraft(data);
  }
  return request<{ draft: Draft }>(`/drafts/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(edits),
  }).then((r) => r.draft);
}

export async function setDraftStatus(
  id: string,
  status: DraftStatus,
  published?: { postId: string; slug: string },
): Promise<Draft> {
  if (isPostDraftId(id)) {
    if (status === "approved") throw new Error("Use Approve & publish for this article");
    const data = await updateArticle(postUuid(id), {
      approval_status: status,
      published: false,
      is_draft: false,
      scheduled_publish_at: null,
    }).catch(() => null);
    if (!data) throw new Error("Could not update the article");
    return postDraft(data);
  }
  return request<{ draft: Draft }>(`/drafts/${encodeURIComponent(id)}/status`, {
    method: "POST",
    body: JSON.stringify({
      status,
      ...(published ? { published_post_id: published.postId, published_slug: published.slug } : {}),
    }),
  }).then((r) => r.draft);
}

async function sendNewArticlePush(title: string, slug: string, postId: string) {
  try {
    await supabase.functions.invoke("send-push-notification", {
      body: {
        title: "📰 New Article on MetsXMFanZone!",
        body: title,
        url: `/blog/${slug}`,
        icon: "/logo-192.png",
        tag: `blog-${postId}`,
      },
    });
  } catch (e) {
    console.error("Push failed:", e);
  }
}

const todayStamp = () => new Date().toISOString().slice(0, 10);

/**
 * Publishes an approved draft to the site (the Cloudflare articles service the public site
 * reads), sends the same subscriber push the old Pending check mark sent, then
 * marks the draft approved in R2.
 *
 * Safe to run again if a step failed halfway: an article that is already live
 * under this title is reused instead of posted twice, and the push only goes
 * out when the article is first created.
 */
export async function publishDraft(draft: Draft): Promise<{ postId: string; slug: string; alreadyLive: boolean }> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error("Not signed in");

  // An article the 5am task already saved in the blog table: approving just switches it on.
  if (isPostDraftId(draft.id)) {
    const uuid = postUuid(draft.id);
    const existing = await getManagedArticle(uuid).catch(() => null);
    if (!existing) throw new Error("Could not find this article on the site");
    if (existing.published && existing.approval_status === "approved") {
      return { postId: existing.id, slug: existing.slug, alreadyLive: true };
    }
    try {
      await updateArticle(uuid, {
        published: true,
        published_at: new Date().toISOString(),
        is_draft: false,
        approval_status: "approved",
        scheduled_publish_at: null,
      });
    } catch {
      throw new Error("Could not publish the article to the site");
    }
    await sendNewArticlePush(existing.title, existing.slug, existing.id);
    return { postId: existing.id, slug: existing.slug, alreadyLive: false };
  }

  const candidates = [
    draft.slug,
    `${draft.slug}-${todayStamp()}`,
    `${draft.slug}-${todayStamp()}-2`,
    `${draft.slug}-${todayStamp()}-3`,
  ];

  let live: { postId: string; slug: string; alreadyLive: boolean } | null = null;

  for (const slug of candidates) {
    let existing: { id: string; slug: string; title: string; published: boolean } | null = null;
    try {
      existing = (await allPosts()).find((p) => p.slug === slug) || null;
    } catch {
      throw new Error("Could not check the site for an existing article");
    }

    if (!existing) {
      let created: Article;
      try {
        created = await createArticle({
          title: draft.title,
          slug,
          content: draft.content,
          excerpt: draft.summary,
          meta_description: draft.meta_description,
          category: draft.category,
          tags: draft.tags,
          published: true,
          published_at: new Date().toISOString(),
          is_draft: false,
          approval_status: "approved",
          user_id: userId,
        });
      } catch {
        throw new Error("Could not publish the article to the site");
      }
      live = { postId: created.id, slug: created.slug, alreadyLive: false };
      break;
    }

    if (existing.title === draft.title && existing.published) {
      live = { postId: existing.id, slug: existing.slug, alreadyLive: true };
      break;
    }
  }

  if (!live) throw new Error("Could not find a free web address for this article");

  if (!live.alreadyLive) await sendNewArticlePush(draft.title, live.slug, live.postId);

  try {
    await setDraftStatus(draft.id, "approved", { postId: live.postId, slug: live.slug });
  } catch (e) {
    const reason = e instanceof Error ? e.message : "unknown problem";
    throw new Error(`The article is live, but the draft could not be marked approved (${reason}). Tap approve again to finish.`);
  }

  return live;
}

// ----- plain-text editing of the article body -----

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Article HTML as plain paragraphs separated by blank lines (## for headings, - for bullets). */
export function htmlToText(html: string): string {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstElementChild;
  if (!root) return "";
  const blocks: string[] = [];
  root.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = (node.textContent || "").trim();
      if (t) blocks.push(t);
      return;
    }
    const el = node as HTMLElement;
    const tag = el.tagName?.toLowerCase();
    const text = (el.textContent || "").replace(/\s+/g, " ").trim();
    if (!text) return;
    if (tag === "h2") blocks.push(`## ${text}`);
    else if (tag === "h3" || tag === "h4") blocks.push(`### ${text}`);
    else if (tag === "ul" || tag === "ol") {
      blocks.push(
        Array.from(el.querySelectorAll("li"))
          .map((li) => `- ${(li.textContent || "").replace(/\s+/g, " ").trim()}`)
          .join("\n"),
      );
    } else blocks.push(text);
  });
  return blocks.join("\n\n");
}

/** Plain paragraphs back into simple, safe article HTML. */
export function textToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean)
    .map((block) => {
      if (block.startsWith("### ")) return `<h3>${escapeHtml(block.slice(4).trim())}</h3>`;
      if (block.startsWith("## ")) return `<h2>${escapeHtml(block.slice(3).trim())}</h2>`;
      const lines = block.split("\n").map((l) => l.trim());
      if (lines.every((l) => l.startsWith("- "))) {
        return `<ul>${lines.map((l) => `<li>${escapeHtml(l.slice(2).trim())}</li>`).join("")}</ul>`;
      }
      return `<p>${lines.map(escapeHtml).join("<br>")}</p>`;
    })
    .join("");
}

/** "TODAY · 4:54 AM", "YESTERDAY · …" or "OCT 10 · …", in New York time. */
export function draftStamp(iso: string): string {
  const d = new Date(iso);
  const tz = "America/New_York";
  const day = (x: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(x);
  const time = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(d);
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 3600 * 1000);
  if (day(d) === day(now)) return `TODAY · ${time}`;
  if (day(d) === day(yesterday)) return `YESTERDAY · ${time}`;
  const date = new Intl.DateTimeFormat("en-US", { timeZone: tz, month: "short", day: "numeric" }).format(d);
  return `${date.toUpperCase()} · ${time}`;
}

/** Whole days a draft has been waiting (0 if under a day). */
export const daysWaiting = (iso: string) =>
  Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 3600 * 1000)));
