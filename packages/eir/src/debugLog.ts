/**
 * `EIR_DEBUG=1` proof-of-interception logging. Phase 2 never acts on a
 * failure — this is observation only, and must never throw into a test
 * (an observability layer causing the failure it observes would violate
 * Blueprint §7.2's fire-and-forget rule, which this logging inherits
 * ahead of Phase 3's capture wiring).
 */

function isDebugEnabled(): boolean {
  return process.env["EIR_DEBUG"] === "1";
}

export function logCaptured(selector: string, route: string): void {
  if (!isDebugEnabled()) return;
  console.log(`[eir] captured: ${selector} on ${route}`);
}

export type OutcomeStatus = "OK" | "FAILED";

export function logOutcome(method: string, status: OutcomeStatus, detail?: string): void {
  if (!isDebugEnabled()) return;
  const suffix = detail !== undefined ? `: ${detail}` : "";
  console.log(`[eir] outcome: ${method} ${status}${suffix}`);
}

/** Uses the normalized selector key (the actual store key), not the raw one-off selector. */
export function logFingerprinted(selectorKey: string, route: string): void {
  if (!isDebugEnabled()) return;
  console.log(`[eir] fingerprinted: ${selectorKey} on ${route}`);
}

export function logMatchResult(selectorKey: string, resultKind: string): void {
  if (!isDebugEnabled()) return;
  console.log(`[eir] match: ${selectorKey} -> ${resultKind}`);
}

/** The heal path's own observability-must-never-fail-the-test catch (see EirLocator#attemptHeal) still gets a visible trace under EIR_DEBUG. */
export function logHealError(selectorKey: string, error: unknown): void {
  if (!isDebugEnabled()) return;
  const message = error instanceof Error ? error.message : String(error);
  console.log(`[eir] heal attempt errored: ${selectorKey}: ${message}`);
}

/** Phase 6: retry-once's final disposition — "healed", "heal-rejected-post-condition-mismatch", or "heal-attempted-retry-failed". */
export function logHealOutcome(selectorKey: string, outcome: string): void {
  if (!isDebugEnabled()) return;
  console.log(`[eir] heal outcome: ${selectorKey} -> ${outcome}`);
}

/** Mechanism B (NOTE-001/RISK-009): an ordinary success whose fresh capture scored suspiciously unlike its own last-known-good baseline. */
export function logDriftSuspected(selectorKey: string, score: number): void {
  if (!isDebugEnabled()) return;
  console.log(`[eir] drift suspected: ${selectorKey} (self-similarity ${score.toFixed(4)})`);
}
