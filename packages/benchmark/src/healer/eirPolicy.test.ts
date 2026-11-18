import { describe, expect, it } from "vitest";
import type {
  PolicyHealAttemptEntry,
  PolicyLogEntry,
  PolicyRetryOutcomeKind,
} from "../policyLog.js";
import { mapEirPolicy } from "./eirPolicy.js";

const attempt = (
  actionKind: PolicyHealAttemptEntry["actionKind"],
  retryOutcomeKind: PolicyRetryOutcomeKind,
): PolicyLogEntry => ({
  kind: "heal-attempt",
  method: "fill",
  route: "/x",
  selectorKey: "k",
  actionKind,
  retryOutcomeKind,
  confidence: 0.8,
  margin: 0.2,
  fallback: null,
});
const drift: PolicyLogEntry = {
  kind: "drift-suspected",
  method: "click",
  route: "/x",
  selectorKey: "k",
  score: 0.9,
};

describe("mapEirPolicy", () => {
  const cases: ReadonlyArray<readonly [string, readonly PolicyLogEntry[], string]> = [
    ["a verified heal", [attempt("heal-and-continue", "healed")], "healed"],
    [
      "heal beats a later rejection",
      [attempt("heal-and-continue", "healed"), attempt("fail-with-suggestion", "not-attempted")],
      "healed",
    ],
    [
      "post-condition mismatch",
      [attempt("heal-and-continue", "heal-rejected-post-condition-mismatch")],
      "heal-rejected",
    ],
    [
      "retry failed",
      [attempt("heal-and-continue", "heal-attempted-retry-failed")],
      "heal-rejected",
    ],
    ["drift flag", [drift], "drift-suspected"],
    ["suggest-only failure", [attempt("fail-with-suggestion", "not-attempted")], "suggest-only"],
    ["triage rejected (fail normally)", [attempt("fail-normally", "not-attempted")], "no-attempt"],
    ["no events at all", [], "no-attempt"],
  ];
  it.each(cases)("%s", (_name, events, expected) => {
    expect(mapEirPolicy(events).kind).toBe(expected);
  });
});
