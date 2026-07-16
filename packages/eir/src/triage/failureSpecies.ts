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
 *
 * RISK-011 (Phase 9 hardening): without `use.actionTimeout` configured,
 * an action on a vanished locator never produces Playwright's bounded
 * `"Timeout ${n}ms exceeded."` action-timeout message at all — it retries
 * until the *test's own* timeout kills it, producing
 * `"Test timeout of ${n}ms exceeded."` instead (lowercase `timeout`,
 * different sentence). The original capital-`"Timeout"` check missed this
 * shape entirely, so an adopter without `actionTimeout` set got a silent,
 * fully-dead triage pipeline on every real broken selector. The timeout
 * check below is case-insensitive so both shapes classify as zero-match —
 * this function only ever runs on an already-caught action-call error, so
 * widening the match doesn't risk misclassifying an unrelated failure.
 */

export type FailureSpecies = "zero-match" | "detached" | "found-but-never-visible" | "unknown";

const DETACHED_MARKER = "not attached to the DOM";
const RESOLVED_MARKER = "resolved to";

export function classifyFailureSpecies(message: string): FailureSpecies {
  if (message.includes(DETACHED_MARKER)) return "detached";
  if (!message.includes(RESOLVED_MARKER)) {
    return message.toLowerCase().includes("timeout") ? "zero-match" : "unknown";
  }
  return "found-but-never-visible";
}
