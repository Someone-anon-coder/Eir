/**
 * Classifies a caught action error's *shape* into one of Blueprint §7.4's
 * failure species, from Playwright's own error message text — there is no
 * structured error subtype to switch on (a `TimeoutError` is thrown for
 * both zero-match and found-but-never-visible; a plain `Error` for
 * detached). Message shapes below are sourced, not guessed:
 *
 * - `zero-match` and `found-but-never-visible` were captured from a real
 *   spike against Ward (a nonexistent `#id` vs. a real, `display:none`
 *   element), both timeout-wrapped with a call log.
 * - `detached` was traced through `playwright-core`'s own source
 *   (`throwElementIsNotAttached` in `dom.ts`, marked
 *   `isNonRecoverableDOMError` so the action retry loop does *not* wrap it
 *   in a timeout — it surfaces immediately as a plain
 *   `"Element is not attached to the DOM"` message). A live repro proved
 *   harder to force deterministically than the other two (Locator actions
 *   re-resolve on every retry, so the race window is narrow) — flagged
 *   here rather than silently assumed, per CLAUDE.md's honesty rules.
 */

export type FailureSpecies = "zero-match" | "detached" | "found-but-never-visible" | "unknown";

const DETACHED_MARKER = "not attached to the DOM";
const RESOLVED_MARKER = "resolved to";

export function classifyFailureSpecies(message: string): FailureSpecies {
  if (message.includes(DETACHED_MARKER)) return "detached";
  if (!message.includes(RESOLVED_MARKER)) return message.includes("Timeout") ? "zero-match" : "unknown";
  return "found-but-never-visible";
}
