import { useMemo } from "react";
import DOMPurify from "dompurify";
import { cn } from "@/lib/utils";

const isHtml = (s: string) => /<\/?[a-z][\s\S]*>/i.test(s);

/**
 * Cleans pasted article HTML (Word / Google Docs / websites) so it lays out
 * the same on every device: drops fixed widths, fonts, colors and layout
 * styles, and makes images, videos and tables fit the screen.
 */
export const cleanArticleHtml = (html: string) => {
  const clean = DOMPurify.sanitize(html, {
    FORBID_TAGS: ["style", "script", "font", "meta", "link", "o:p"],
    FORBID_ATTR: ["width", "height", "align", "bgcolor", "face", "color", "size", "class", "id"],
    ADD_TAGS: ["iframe"],
    ADD_ATTR: ["allow", "allowfullscreen", "frameborder", "target"],
  });
  const doc = new DOMParser().parseFromString(`<div>${clean}</div>`, "text/html");
  const root = doc.body.firstElementChild as HTMLElement;
  root.querySelectorAll<HTMLElement>("[style]").forEach((el) => {
    // Keep only text alignment; everything else breaks mobile layouts.
    const align = el.style.textAlign;
    el.removeAttribute("style");
    if (align && ["left", "center", "right", "justify"].includes(align)) el.style.textAlign = align;
  });
  root.querySelectorAll("p, div, span").forEach((el) => {
    if (!el.textContent?.replace(/\u00a0/g, "").trim() && !el.querySelector("img,iframe,video,br")) el.remove();
  });
  root.querySelectorAll("table").forEach((t) => {
    const wrap = doc.createElement("div");
    wrap.setAttribute("data-table-wrap", "");
    t.replaceWith(wrap);
    wrap.appendChild(t);
  });
  root.querySelectorAll("a[href^='http']").forEach((a) => {
    a.setAttribute("target", "_blank");
    a.setAttribute("rel", "noopener noreferrer");
  });
  return root.innerHTML;
};

export default function ArticleBody({ content, className }: { content: string; className?: string }) {
  const html = useMemo(() => (isHtml(content) ? cleanArticleHtml(content) : null), [content]);
  return (
    <div
      className={cn(
        "article-body prose prose-invert prose-sm sm:prose-base lg:prose-lg max-w-none break-words text-foreground",
        "prose-headings:font-bold prose-headings:text-foreground prose-p:text-foreground prose-li:text-foreground prose-strong:text-foreground prose-em:text-foreground prose-blockquote:text-foreground prose-a:text-primary prose-img:rounded-lg prose-img:mx-auto",
        "[&_img]:max-w-full [&_img]:h-auto [&_video]:max-w-full [&_iframe]:w-full [&_iframe]:aspect-video [&_iframe]:h-auto",
        "[&_[data-table-wrap]]:overflow-x-auto [&_pre]:overflow-x-auto [&_pre]:whitespace-pre-wrap",
        className,
      )}
    >
      {html !== null ? (
        <div dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <div className="whitespace-pre-wrap">{content}</div>
      )}
    </div>
  );
}
