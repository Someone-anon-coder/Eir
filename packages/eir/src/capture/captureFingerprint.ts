import type { Locator } from "@playwright/test";
import { FINGERPRINT_SCHEMA_VERSION, type Fingerprint } from "../fingerprint.js";
import { filterAttrs } from "./attrsFilter.js";
import { quantizeBbox } from "./bboxQuantize.js";
import { filterClasses } from "./classFilter.js";
import { rawExtract, type RawCapture } from "./rawExtract.js";
import { truncateText } from "./textTruncate.js";

/**
 * `real.evaluate(rawExtract)` returns data from the browser world as
 * `unknown` — the Pre-Phase TS Tip pattern, applied for real. Nothing past
 * this predicate touches a field until the shape is proven.
 */
export function isRawCapture(x: unknown): x is RawCapture {
  if (typeof x !== "object" || x === null) return false;
  const candidate = x as Record<string, unknown>;
  return (
    typeof candidate["tag"] === "string" &&
    typeof candidate["attrs"] === "object" &&
    candidate["attrs"] !== null &&
    typeof candidate["text"] === "string" &&
    (candidate["label"] === null || typeof candidate["label"] === "string") &&
    Array.isArray(candidate["ancestors"]) &&
    typeof candidate["siblingIndex"] === "number" &&
    typeof candidate["siblingCount"] === "number" &&
    (candidate["bbox"] === null || typeof candidate["bbox"] === "object")
  );
}

/**
 * Fire-and-forget by construction (Blueprint P1/§7.1): an observability
 * layer must never become a way the test can fail, so this never rejects —
 * a malformed capture, an unmeasurable bbox, or a mid-capture navigation
 * all resolve to `null` rather than throwing. The caller (Work Item 5)
 * decides whether to await this at all.
 */
export async function captureFingerprint(real: Locator): Promise<Fingerprint | null> {
  try {
    const raw: unknown = await real.evaluate(rawExtract);
    if (!isRawCapture(raw) || raw.bbox === null) {
      return null;
    }

    return {
      v: FINGERPRINT_SCHEMA_VERSION,
      tag: raw.tag,
      attrs: filterAttrs(raw.attrs),
      text: truncateText(raw.text),
      label: raw.label === null ? null : truncateText(raw.label),
      ancestors: raw.ancestors.map((hop) => ({
        tag: hop.tag,
        id: hop.id,
        classes: filterClasses(hop.classes),
      })),
      siblingIndex: raw.siblingIndex,
      siblingCount: raw.siblingCount,
      bbox: quantizeBbox(raw.bbox),
    };
  } catch {
    return null;
  }
}
