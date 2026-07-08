import type { Page } from "@playwright/test";
import { filterAttrs } from "../capture/attrsFilter.js";
import { quantizeBbox } from "../capture/bboxQuantize.js";
import { isRawCapture } from "../capture/captureFingerprint.js";
import { filterClasses } from "../capture/classFilter.js";
import { truncateText } from "../capture/textTruncate.js";
import { extractCandidates, type RawCandidate } from "./candidateExtract.js";
import { candidateSelector } from "./candidateSelector.js";
import type { CandidateFeatures } from "./types.js";

/**
 * Node-side half of transient candidate capture (Blueprint §7.5 stage 1):
 * runs the in-page extractor for the fingerprint's tag (expanded to
 * tag-swap equivalents), then shapes each raw candidate through the exact
 * same allow-list/truncation/quantization pipeline `captureFingerprint.ts`
 * uses for the baseline — a candidate and a stored fingerprint must be
 * comparable apples-to-apples, or every scorer's assumptions break.
 * Fire-and-forget in spirit but not in mechanism: unlike fingerprint
 * capture, this *is* awaited by the matcher (the whole point is to use
 * the result), but a failure here still must never throw into the test —
 * it degrades to "no candidates found," which the matcher already treats
 * as a normal rejection.
 */

/** A shaped candidate plus enough to re-locate it in the live DOM later (see `RawCandidate.domIndex`). */
export interface CapturedCandidate {
  readonly features: CandidateFeatures;
  /** This candidate's position in the *unfiltered* `querySelectorAll(selector)` result. */
  readonly domIndex: number;
  /** The selector `page.locator(selector).nth(domIndex)` will re-resolve this exact candidate with. */
  readonly selector: string;
}

function isRawCandidate(x: unknown): x is RawCandidate {
  if (typeof x !== "object" || x === null) return false;
  const candidate = x as Record<string, unknown>;
  return typeof candidate["domIndex"] === "number" && isRawCapture(x);
}

function shapeCandidate(raw: RawCandidate, selector: string): CapturedCandidate | null {
  if (raw.bbox === null) return null;
  const features: CandidateFeatures = {
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
  return { features, domIndex: raw.domIndex, selector };
}

export async function captureCandidates(page: Page, tag: string): Promise<CapturedCandidate[]> {
  try {
    const selector = candidateSelector(tag);
    const raw: unknown = await page.evaluate(extractCandidates, selector);
    if (!Array.isArray(raw)) return [];

    const shaped: CapturedCandidate[] = [];
    for (const item of raw) {
      if (!isRawCandidate(item)) continue;
      const candidate = shapeCandidate(item, selector);
      if (candidate !== null) shaped.push(candidate);
    }
    return shaped;
  } catch {
    return [];
  }
}
