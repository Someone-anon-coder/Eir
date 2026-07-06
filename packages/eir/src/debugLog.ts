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
