import type { PolicyLogEntry } from "../policyLog.js";
import type { EirPolicyResult } from "./classify.js";

/**
 * Reduces one test's policy-log events to what Eir actually did, in this
 * precedence: a heal that executed and was verified, a heal that was
 * attempted but rejected or failed, a drift flag, a suggest-only failure,
 * and finally "never got involved".
 */
export function mapEirPolicy(events: readonly PolicyLogEntry[]): EirPolicyResult {
  const attempts = events.flatMap((e) => (e.kind === "heal-attempt" ? [e] : []));
  if (attempts.some((a) => a.retryOutcomeKind === "healed")) return { kind: "healed" };
  if (
    attempts.some(
      (a) =>
        a.retryOutcomeKind === "heal-rejected-post-condition-mismatch" ||
        a.retryOutcomeKind === "heal-attempted-retry-failed",
    )
  ) {
    return { kind: "heal-rejected" };
  }
  if (events.some((e) => e.kind === "drift-suspected")) return { kind: "drift-suspected" };
  if (attempts.some((a) => a.actionKind === "fail-with-suggestion"))
    return { kind: "suggest-only" };
  return { kind: "no-attempt" };
}
