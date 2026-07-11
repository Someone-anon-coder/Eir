import type { Page } from "@playwright/test";
import { normalizeRoute } from "../routeNormalize.js";
import type { NormalizedPulse } from "../postCondition.js";
import { capturePagePulse, type RawPulse } from "./pagePulse.js";

/** `page.evaluate()` returns data from a different JS world — `unknown` at the boundary, same discipline as `captureFingerprint.ts`. */
function isRawPulse(x: unknown): x is RawPulse {
  if (typeof x !== "object" || x === null) return false;
  const candidate = x as Record<string, unknown>;
  return typeof candidate["route"] === "string" && typeof candidate["elementCount"] === "number";
}

/**
 * Never throws — a pulse failure (mid-capture navigation, a closed page)
 * degrades to `null`, which callers treat as "nothing to compare," never
 * as a reason to fail the test (Blueprint P1: observability never causes
 * failure). Route-normalized here so `derivePostCondition`'s comparisons
 * and the stored `PostCondition.toRoute` use the same bucketing every
 * other part of the store does.
 */
export async function capturePulse(page: Page): Promise<NormalizedPulse | null> {
  try {
    const raw: unknown = await page.evaluate(capturePagePulse);
    if (!isRawPulse(raw)) return null;
    return { route: normalizeRoute(raw.route), elementCount: raw.elementCount };
  } catch {
    return null;
  }
}
