/// <reference lib="dom" />
/**
 * Runs *inside the browser* via `locator.evaluate(rawExtract)` — a single
 * self-contained function with no imports and no closures over Node scope
 * (CLAUDE.md §7.2). It does only mechanical DOM reads; every filtering,
 * truncation, and quantization decision happens back in Node (see
 * captureFingerprint.ts), where those rules can be unit-tested without a
 * browser. The `/// <reference lib="dom" />` above exists because the
 * package's own tsconfig has no "DOM" lib (it's a Node package) — this
 * directive pulls in DOM types for this one file only, since this is the
 * one file that actually runs as browser code.
 */

export interface RawAncestorHop {
  readonly tag: string;
  readonly id: string | null;
  readonly classes: readonly string[];
}

export interface RawBoundingBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface RawCapture {
  readonly tag: string;
  readonly attrs: Readonly<Record<string, string>>;
  readonly text: string;
  readonly label: string | null;
  readonly ancestors: readonly RawAncestorHop[];
  readonly siblingIndex: number;
  readonly siblingCount: number;
  readonly bbox: RawBoundingBox | null;
}

export function rawExtract(el: Element): RawCapture {
  // Declared inside the function, not at module scope: Playwright serializes
  // only this function's own body text to send to the browser — a
  // module-level constant referenced here would be `undefined` at runtime
  // (learned the hard way; see the `ReferenceError` this used to throw).
  const maxAncestorHops = 3;

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
  const bbox =
    rect.width > 0 && rect.height > 0
      ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
      : null;

  return { tag, attrs, text, label, ancestors, siblingIndex, siblingCount, bbox };
}
