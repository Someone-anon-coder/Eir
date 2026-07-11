/// <reference lib="dom" />
/**
 * Runs *inside the browser* via `page.evaluate(capturePagePulse)` — a
 * single self-contained function, same discipline as `rawExtract.ts`
 * (CLAUDE.md §7.2: no imports, no closures over Node scope). Page-level,
 * not element-level, on purpose: unlike `rawExtract`, this never depends
 * on a specific element still existing, so it stays safe to call both
 * before an action starts and after it resolves — including when the
 * action itself may have detached the very element it acted on.
 */

export interface RawPulse {
  readonly route: string;
  readonly elementCount: number;
}

export function capturePagePulse(): RawPulse {
  return {
    route: location.pathname + location.search,
    elementCount: document.querySelectorAll("*").length,
  };
}
