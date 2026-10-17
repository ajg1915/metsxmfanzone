import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, ClipboardCopy, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { checkOriginality, checkWeb, htmlToText, type OriginalityResult, type WebCheckResult } from "@/lib/draftsApi";

const label = "text-[12px] font-extrabold tracking-wider text-[#FF9A6B]";
const ghostBtn =
  "flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/25 px-3 text-[15px] font-bold text-white active:bg-white/10 disabled:opacity-50";

const read = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode: the choice just isn't remembered */
  }
};

const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

const parseLinks = (text: string) =>
  [...new Set(text.split(/\s+/).map((s) => s.trim()).filter((s) => /^https?:\/\//i.test(s)))].slice(0, 10);

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}

/**
 * Originality check shown while a draft is waiting for approval:
 * 1) automatic check against the articles the draft was written from (runs on the drafts Worker, free);
 * 2) copy the article and open Grammarly's plagiarism check (Grammarly has no connection for other sites,
 *    so it stays a manual step; the box below just remembers that it was done).
 */
export default function OriginalityCard({
  draftId,
  title,
  html,
  sources,
  onGrammarlyChange,
  onResult,
  onFlaggedChange,
}: {
  draftId: string;
  title: string;
  html: string;
  sources: string[];
  onGrammarlyChange?: (done: boolean) => void;
  onResult?: (result: OriginalityResult | null) => void;
  /** True when either check found passages that are too close to something else. */
  onFlaggedChange?: (flagged: boolean) => void;
}) {
  const { toast } = useToast();
  const sourcesKey = `mxf_draft_sources_${draftId}`;
  const grammarlyKey = `mxf_draft_grammarly_${draftId}`;

  const [sourcesText, setSourcesText] = useState(() => read(sourcesKey) ?? sources.join("\n"));
  const [grammarly, setGrammarly] = useState(() => read(grammarlyKey) === "1");
  const [result, setResult] = useState<OriginalityResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ranFor = useRef("");
  const [web, setWeb] = useState<WebCheckResult | null>(null);
  const [webChecking, setWebChecking] = useState(false);
  const [webError, setWebError] = useState<string | null>(null);

  useEffect(() => {
    onGrammarlyChange?.(grammarly);
  }, [grammarly, onGrammarlyChange]);

  const runWeb = async () => {
    setWebChecking(true);
    setWebError(null);
    try {
      setWeb(await checkWeb(htmlToText(html)));
    } catch (e) {
      setWeb(null);
      setWebError(e instanceof Error ? e.message : "The web check could not run");
    } finally {
      setWebChecking(false);
    }
  };

  const run = useCallback(async () => {
    const links = parseLinks(sourcesText);
    write(sourcesKey, sourcesText);
    setChecking(true);
    setError(null);
    try {
      const r = await checkOriginality(htmlToText(html), links);
      setResult(r);
      onResult?.(r);
    } catch (e) {
      setResult(null);
      onResult?.(null);
      setError(e instanceof Error ? e.message : "The check could not run");
    } finally {
      setChecking(false);
    }
  }, [html, sourcesText, sourcesKey, onResult]);

  // Check automatically when the draft opens and it has source links.
  useEffect(() => {
    if (ranFor.current === draftId) return;
    ranFor.current = draftId;
    if (parseLinks(sourcesText).length) void run();
  }, [draftId, run, sourcesText]);

  const copyForGrammarly = async () => {
    const ok = await copyText(`${title}\n\n${htmlToText(html)}`);
    toast(
      ok
        ? { title: "Article copied", description: "Paste it into Grammarly and run the plagiarism check." }
        : { title: "Could not copy", description: "Select the article text and copy it by hand.", variant: "destructive" },
    );
  };

  const toggleGrammarly = (on: boolean) => {
    setGrammarly(on);
    write(grammarlyKey, on ? "1" : "0");
  };

  const level = result?.level;
  const flagged = level === "review" || web?.level === "review";
  useEffect(() => {
    onFlaggedChange?.(flagged);
  }, [flagged, onFlaggedChange]);

  return (
    <div className="space-y-4 rounded-2xl border border-white/15 bg-white/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className={label}>ORIGINALITY CHECK</p>
        {checking && (
          <span className="flex items-center gap-1.5 text-[12px] text-slate-300">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking…
          </span>
        )}
        {!checking && level === "pass" && (
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-700 px-3 py-1 text-[12px] font-extrabold text-white">
            <Check className="h-3.5 w-3.5" /> PASS
          </span>
        )}
        {!checking && level === "review" && (
          <span className="flex items-center gap-1.5 rounded-full bg-[#FF5910] px-3 py-1 text-[12px] font-extrabold text-[#0B1730]">
            <AlertTriangle className="h-3.5 w-3.5" /> REVIEW
          </span>
        )}
      </div>

      {/* Web check: searches the web for the article's own sentences, no links needed */}
      <div className="space-y-3 rounded-xl bg-black/20 p-3.5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[12px] font-extrabold tracking-wider text-slate-300">WHOLE ARTICLE · WEB SEARCH</p>
          {webChecking && (
            <span className="flex items-center gap-1.5 text-[12px] text-slate-300">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…
            </span>
          )}
          {!webChecking && web?.level === "pass" && (
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-700 px-3 py-1 text-[12px] font-extrabold text-white">
              <Check className="h-3.5 w-3.5" /> PASS
            </span>
          )}
          {!webChecking && web?.level === "review" && (
            <span className="flex items-center gap-1.5 rounded-full bg-[#FF5910] px-3 py-1 text-[12px] font-extrabold text-[#0B1730]">
              <AlertTriangle className="h-3.5 w-3.5" /> REVIEW
            </span>
          )}
        </div>

        {!web && !webChecking && !webError && (
          <p className="text-[14px] leading-relaxed text-slate-300">
            Searches the web for sentences from this article and lists any pages with the same wording. It takes about 10 seconds.
          </p>
        )}
        {webError && <p className="text-[14px] text-red-300">{webError}</p>}
        {web?.level === "not_configured" && (
          <p className="text-[14px] leading-relaxed text-slate-200">
            Not set up yet. Get a free key at{" "}
            <a href="https://brave.com/search/api/" target="_blank" rel="noopener noreferrer" className="text-[#FFB08A] underline">
              brave.com/search/api
            </a>{" "}
            and add it to the drafts-api Worker as a secret named BRAVE_API_KEY.
          </p>
        )}
        {web?.level === "bad_key" && (
          <p className="text-[14px] leading-relaxed text-slate-200">
            The search service rejected the BRAVE_API_KEY on the drafts-api Worker. Check that it was copied in full.
          </p>
        )}
        {(web?.level === "pass" || web?.level === "review") && (
          <p className="text-[14px] leading-relaxed text-slate-200">
            {web.level === "pass"
              ? `No matching pages found for the ${web.sentences_checked} sentences searched.`
              : `${web.matches?.length} sentence${web.matches?.length === 1 ? "" : "s"} appear${web.matches?.length === 1 ? "s" : ""} on other pages. Reword ${web.matches?.length === 1 ? "it" : "them"}, then search again.`}{" "}
            This checks a sample of {web.sentences_checked} of {web.sentences_total} sentences, so it can miss a short copied passage.
          </p>
        )}
        {web?.stopped && <p className="text-[12px] text-[#FFB08A]">{web.stopped}. Only part of the article was searched.</p>}

        {web?.matches?.map((m, i) => (
          <div key={i} className="space-y-1.5 rounded-xl bg-black/25 p-3">
            <p className="text-[14px] leading-relaxed text-white">
              “<mark className="rounded bg-[#FF5910]/35 px-0.5 text-white">{m.sentence}</mark>”
            </p>
            <p className="text-[12px] text-slate-300">
              Also on{" "}
              <a href={m.url} target="_blank" rel="noopener noreferrer" className="text-[#FFB08A] underline">
                {host(m.url)}
              </a>{" "}
              · {m.words} words in a row
            </p>
          </div>
        ))}
        {web?.possible && web.possible.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[12px] font-extrabold tracking-wider text-slate-300">WORTH A LOOK (NOT CONFIRMED)</p>
            {web.possible.map((m, i) => (
              <p key={i} className="text-[12px] text-slate-300">
                <a href={m.url} target="_blank" rel="noopener noreferrer" className="text-[#FFB08A] underline">
                  {host(m.url)}
                </a>{" "}
                came up for “{m.sentence.slice(0, 70)}…” but its preview doesn't show the wording.
              </p>
            ))}
          </div>
        )}

        <button type="button" disabled={webChecking} onClick={() => void runWeb()} className={ghostBtn}>
          <RefreshCw className="h-4 w-4" /> {web && (web.level === "pass" || web.level === "review") ? "Search the web again" : "Check the whole article on the web"}
        </button>
      </div>

      {/* Source check */}
      {error && <p className="text-[14px] text-red-300">{error}</p>}

      {result && level === "pass" && (
        <p className="text-[14px] leading-relaxed text-slate-200">
          Looks original. Nothing was copied from the {result.sources_checked} source{result.sources_checked === 1 ? "" : "s"} checked.
        </p>
      )}
      {result && level === "review" && (
        <p className="text-[14px] leading-relaxed text-slate-200">
          {result.flagged.length > 0
            ? `${result.flagged.length} passage${result.flagged.length === 1 ? " is" : "s are"} too close to a source. Reword ${result.flagged.length === 1 ? "it" : "them"}, then run the check again.`
            : "A lot of this article overlaps with its sources. Reword the parts that are closest, then run the check again."}
        </p>
      )}
      {result && level === "no_sources" && (
        <p className="text-[14px] leading-relaxed text-slate-200">
          None of the source links could be read, so nothing was compared. Check the links below.
        </p>
      )}
      {!result && !checking && !error && (
        <p className="text-[14px] leading-relaxed text-slate-300">
          Add the links of the articles this was written from, then run the check. It compares the wording against them.
        </p>
      )}

      {result && level !== "no_sources" && (
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-black/25 px-2 py-2.5">
            <p className="text-[20px] font-extrabold text-white">{result.overlap ?? 0}%</p>
            <p className="text-[11px] text-slate-300">Overlap</p>
          </div>
          <div className="rounded-xl bg-black/25 px-2 py-2.5">
            <p className="text-[20px] font-extrabold text-white">{result.longest_run ?? 0}</p>
            <p className="text-[11px] text-slate-300">Longest shared run (words)</p>
          </div>
          <div className="rounded-xl bg-black/25 px-2 py-2.5">
            <p className="text-[20px] font-extrabold text-white">{result.sources_checked}</p>
            <p className="text-[11px] text-slate-300">Sources compared</p>
          </div>
        </div>
      )}

      {result && result.flagged.length > 0 && (
        <div className="space-y-2.5">
          <p className="text-[12px] font-extrabold tracking-wider text-slate-300">FLAGGED PASSAGES</p>
          {result.flagged.map((f, i) => (
            <div key={i} className="space-y-1.5 rounded-xl bg-black/25 p-3">
              <p className="text-[14px] leading-relaxed text-white">
                “<mark className="rounded bg-[#FF5910]/35 px-0.5 text-white">{f.text}</mark>”
              </p>
              <p className="text-[12px] text-slate-300">
                Matches{" "}
                <a href={f.source} target="_blank" rel="noopener noreferrer" className="text-[#FFB08A] underline">
                  {host(f.source)}
                </a>{" "}
                · {f.words} words in a row
              </p>
            </div>
          ))}
        </div>
      )}

      {result && result.sources_failed.length > 0 && (
        <p className="text-[12px] text-slate-300">
          Could not read: {result.sources_failed.map(host).join(", ")}. Those were not compared.
        </p>
      )}

      <p className="text-[12px] font-extrabold tracking-wider text-slate-300">AGAINST ITS SOURCE ARTICLES (OPTIONAL)</p>
      <div className="space-y-1.5">
        <label htmlFor={`sources-${draftId}`} className="text-[12px] font-extrabold tracking-wider text-slate-300">
          SOURCE LINKS (ONE PER LINE)
        </label>
        <textarea
          id={`sources-${draftId}`}
          value={sourcesText}
          onChange={(e) => setSourcesText(e.target.value)}
          rows={3}
          placeholder="https://..."
          className="w-full rounded-xl border border-white/20 bg-white/5 px-3.5 py-3 text-[14px] leading-snug text-white placeholder:text-slate-400 focus:border-[#FF5910] focus:outline-none"
        />
      </div>
      <button type="button" disabled={checking || parseLinks(sourcesText).length === 0} onClick={() => void run()} className={ghostBtn}>
        <RefreshCw className="h-4 w-4" /> {result ? "Run the check again" : "Check against sources"}
      </button>

      {/* Grammarly */}
      <div className="space-y-3 border-t border-white/10 pt-4">
        <p className="text-[12px] font-extrabold tracking-wider text-slate-300">GRAMMARLY</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={() => void copyForGrammarly()} className={ghostBtn}>
            <ClipboardCopy className="h-4 w-4" /> Copy article for Grammarly
          </button>
          <a
            href="https://app.grammarly.com/"
            target="_blank"
            rel="noopener noreferrer"
            className={ghostBtn}
          >
            <ExternalLink className="h-4 w-4" /> Open Grammarly
          </a>
        </div>
        <label className="flex min-h-11 items-center gap-3 text-[14px] text-slate-100">
          <input
            type="checkbox"
            checked={grammarly}
            onChange={(e) => toggleGrammarly(e.target.checked)}
            className="h-5 w-5 accent-[#FF5910]"
          />
          I ran the plagiarism check in Grammarly
        </label>
      </div>
    </div>
  );
}
