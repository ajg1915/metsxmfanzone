import { supabase } from "@/integrations/supabase/client";

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

export const listDrafts = (status: DraftStatus) =>
  request<{ drafts: DraftSummary[] }>(`/drafts?status=${status}`).then((r) => r.drafts);

export const getDraft = (id: string) =>
  request<{ draft: Draft }>(`/drafts/${encodeURIComponent(id)}`).then((r) => r.draft);

export const draftCounts = () => request<Record<DraftStatus, number>>("/drafts/counts");

export const updateDraft = (id: string, edits: DraftEdits) =>
  request<{ draft: Draft }>(`/drafts/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(edits),
  }).then((r) => r.draft);

export const setDraftStatus = (
  id: string,
  status: DraftStatus,
  published?: { postId: string; slug: string },
) =>
  request<{ draft: Draft }>(`/drafts/${encodeURIComponent(id)}/status`, {
    method: "POST",
    body: JSON.stringify({
      status,
      ...(published ? { published_post_id: published.postId, published_slug: published.slug } : {}),
    }),
  }).then((r) => r.draft);

const todayStamp = () => new Date().toISOString().slice(0, 10);

/**
 * Publishes an approved draft to the site (the blog_posts table the public site
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

  const candidates = [
    draft.slug,
    `${draft.slug}-${todayStamp()}`,
    `${draft.slug}-${todayStamp()}-2`,
    `${draft.slug}-${todayStamp()}-3`,
  ];

  let live: { postId: string; slug: string; alreadyLive: boolean } | null = null;

  for (const slug of candidates) {
    const { data: existing, error } = await supabase
      .from("blog_posts")
      .select("id, slug, title, published")
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw new Error("Could not check the site for an existing article");

    if (!existing) {
      const { data: created, error: insertError } = await supabase
        .from("blog_posts")
        .insert([
          {
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
          },
        ])
        .select("id, slug")
        .single();
      if (insertError || !created) throw new Error("Could not publish the article to the site");
      live = { postId: created.id, slug: created.slug, alreadyLive: false };
      break;
    }

    if (existing.title === draft.title && existing.published) {
      live = { postId: existing.id, slug: existing.slug, alreadyLive: true };
      break;
    }
  }

  if (!live) throw new Error("Could not find a free web address for this article");

  if (!live.alreadyLive) {
    try {
      await supabase.functions.invoke("send-push-notification", {
        body: {
          title: "📰 New Article on MetsXMFanZone!",
          body: draft.title,
          url: `/blog/${live.slug}`,
          icon: "/logo-192.png",
          tag: `blog-${live.postId}`,
        },
      });
    } catch (e) {
      console.error("Push failed:", e);
    }
  }

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
