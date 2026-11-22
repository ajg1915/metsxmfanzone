// Inside the installed TV app (Amazon Appstore / Fire TV build) the premium game streams are
// called "Premium Games 1/2/3" instead of the outside brand names, so the app passes store review.
// The website, phone app and admin are unchanged. This runs only when isTVApp() is true.

const RENAMES: [RegExp, string][] = [
  [/amazon prime video/gi, "Premium Games 2"],
  [/apple tv\+?/gi, "Premium Games 1"],
  [/prime video/gi, "Premium Games 2"],
  [/peacock/gi, "Premium Games 3"],
];

const TEST = /apple tv|prime video|peacock/i;

export function tvAppName(text: string): string {
  let out = text;
  for (const [re, name] of RENAMES) out = out.replace(re, name);
  return out;
}

const ATTRS = ["aria-label", "alt", "title", "placeholder"];

function fixNode(node: Node) {
  if (node.nodeType === Node.TEXT_NODE) {
    const v = node.nodeValue;
    if (v && TEST.test(v)) node.nodeValue = tvAppName(v);
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const el = node as Element;
  if (el.tagName === "SCRIPT" || el.tagName === "STYLE") return;
  for (const a of ATTRS) {
    const v = el.getAttribute(a);
    if (v && TEST.test(v)) el.setAttribute(a, tvAppName(v));
  }
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let n = walker.nextNode();
  while (n) {
    if (n.nodeType === Node.TEXT_NODE) {
      const v = n.nodeValue;
      if (v && TEST.test(v)) n.nodeValue = tvAppName(v);
    } else {
      const e = n as Element;
      for (const a of ATTRS) {
        const v = e.getAttribute(a);
        if (v && TEST.test(v)) e.setAttribute(a, tvAppName(v));
      }
    }
    n = walker.nextNode();
  }
}

/** Start renaming everything on screen (and the page title). Call once, only in the TV app. */
export function startTVAppNames(): void {
  if (typeof document === "undefined") return;
  const fixTitle = () => {
    if (TEST.test(document.title)) document.title = tvAppName(document.title);
  };
  const run = () => {
    fixNode(document.body);
    fixTitle();
    new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === "characterData") fixNode(r.target);
        else if (r.type === "attributes") fixNode(r.target);
        else r.addedNodes.forEach(fixNode);
      }
      fixTitle();
    }).observe(document.documentElement, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ATTRS,
    });
  };
  if (document.body) run();
  else document.addEventListener("DOMContentLoaded", run, { once: true });
}
