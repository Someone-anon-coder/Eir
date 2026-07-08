/// <reference lib="dom" />
/**
 * Runs *inside the browser* via `page.evaluate(extractCandidates, selector)`
 * — self-contained, no imports, no closures over Node scope (CLAUDE.md
 * §7.2), same constraint `rawExtract.ts` documents. That constraint is
 * also why the per-element extraction logic below is a near-duplicate of
 * `rawExtract.ts`'s rather than a shared call: Playwright serializes only
 * this function's own source text, so a call out to `rawExtract` from here
 * would be `undefined` at runtime, not a real reference.
 *
 * Candidate generation (Blueprint §7.5 stage 1): all elements matching the
 * fingerprint's tag plus known tag-swap equivalents, pre-filtered to
 * rendered elements — tens of candidates, not thousands. The tag-swap
 * expansion itself happens Node-side (`candidateSelector.ts`), which is
 * why this function takes a ready-made CSS selector string rather than a
 * bare tag name.
 */

import type { RawAncestorHop, RawBoundingBox, RawCapture } from "../capture/rawExtract.js";

export const MAX_CANDIDATES = 200;

/**
 * `domIndex` is this candidate's position in the *unfiltered*
 * `querySelectorAll(selector)` result — not its position in the returned
 * (rendered-only) array. The suggested-selector generator needs it to
 * re-locate the winning candidate later via `page.locator(selector).nth(domIndex)`;
 * without the original index, a `.nth()` built from the filtered position
 * would silently point at the wrong element whenever any hidden element
 * was skipped ahead of it.
 */
export interface RawCandidate extends RawCapture {
  readonly domIndex: number;
}

export function extractCandidates(selector: string): RawCandidate[] {
  const maxAncestorHops = 3;

  function extractOne(el: Element): RawCapture {
    const tag = el.tagName.toLowerCase();

    const attrs: Record<string, string> = {};
    for (const attr of Array.from(el.attributes)) {
      attrs[attr.name] = attr.value;
    }

    const text = el.textContent ?? "";

    let label: string | null = null;
    const elId = el.getAttribute("id");
    if (elId) {
      const forLabel = el.ownerDocument.querySelector(`label[for="${CSS.escape(elId)}"]`);
      if (forLabel?.textContent) {
        label = forLabel.textContent;
      }
    }
    if (label === null) {
      const wrappingLabel = el.closest("label");
      if (wrappingLabel?.textContent) {
        label = wrappingLabel.textContent;
      }
    }

    const ancestors: RawAncestorHop[] = [];
    let current = el.parentElement;
    while (current !== null && ancestors.length < maxAncestorHops) {
      const currentTag = current.tagName.toLowerCase();
      if (currentTag === "body" || currentTag === "html") break;
      ancestors.push({
        tag: currentTag,
        id: current.getAttribute("id"),
        classes: Array.from(current.classList),
      });
      current = current.parentElement;
    }

    let siblingIndex = 0;
    let siblingCount = 1;
    if (el.parentElement) {
      const sameTag = Array.from(el.parentElement.children).filter(
        (child) => child.tagName === el.tagName,
      );
      siblingCount = sameTag.length;
      siblingIndex = sameTag.indexOf(el);
    }

    const rect = el.getBoundingClientRect();
    const bbox: RawBoundingBox | null =
      rect.width > 0 && rect.height > 0
        ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
        : null;

    return { tag, attrs, text, label, ancestors, siblingIndex, siblingCount, bbox };
  }

  const maxCandidates = 200; // duplicated literal — see MAX_CANDIDATES docstring above; must be a literal, not an imported const, for the same self-containment reason.
  const elements = Array.from(document.querySelectorAll(selector));
  const rendered: RawCandidate[] = [];
  for (const [domIndex, el] of elements.entries()) {
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      rendered.push({ ...extractOne(el), domIndex });
    }
    if (rendered.length >= maxCandidates) break;
  }
  return rendered;
}
