import { describe, expect, it } from "vitest";
import type { Fingerprint } from "../fingerprint.js";
import type { MatchAttempt } from "../matching/matcher.js";
import { DEFAULT_HEAL_THRESHOLD, DEFAULT_MIN_MARGIN } from "../policy/thresholds.js";
import { isFormallyUncertain } from "./trigger.js";

const WINNER = {
  tag: "button",
  attrs: { "data-testid": "wizard-next" },
  text: "Next",
  label: null,
  ancestors: [],
  siblingIndex: 0,
  siblingCount: 2,
  bbox: { x: 0, y: 0, w: 64, h: 32 },
} as const;

const FINGERPRINT: Fingerprint = { v: 1, ...WINNER };

function matched(confidence: number, margin: number): MatchAttempt {
  return {
    kind: "matched",
    fingerprint: FINGERPRINT,
    candidateCount: 3,
    winner: WINNER,
    breakdown: {
      attrOverlap: 1,
      textSimilarity: 1,
      labelMatch: 1,
      ancestorChain: 1,
      siblingPosition: 1,
      bboxProximity: 1,
    },
    confidence,
    margin,
    suggestion: null,
    winnerLocator: { selector: "button", domIndex: 0 },
    shortlist: [],
  };
}

/**
 * The DoD's own checkbox, as a table: the fallback provably never fires
 * above the uncertainty predicate. Heal-qualified numbers (confidence ≥
 * heal bar AND margin ≥ margin bar) must never trigger — including both
 * exact-boundary cases, since qualification is `>=` on both bars.
 */
describe("isFormallyUncertain — never fires above the predicate", () => {
  it.each([
    ["comfortably heal-qualified", 0.95, 0.4],
    ["exactly at both bars (>= qualifies)", DEFAULT_HEAL_THRESHOLD, DEFAULT_MIN_MARGIN],
    ["at heal bar, margin above", DEFAULT_HEAL_THRESHOLD, 0.2],
    ["above heal bar, at margin bar", 0.9, DEFAULT_MIN_MARGIN],
    ["the tag-swap/wrapper-inject shape (measured 100% heal classes)", 0.85, 0.3],
  ])("%s → no fallback", (_desc, confidence, margin) => {
    expect(isFormallyUncertain(matched(confidence, margin))).toBe(false);
  });

  it.each([
    ["rejected — no funnel ran, no shortlist exists", { kind: "rejected", reason: "no-fingerprint", detail: "" } satisfies MatchAttempt],
    ["no-candidates — an empty shortlist cannot be judged", { kind: "no-candidates", fingerprint: FINGERPRINT } satisfies MatchAttempt],
  ])("%s → no fallback", (_desc, attempt) => {
    expect(isFormallyUncertain(attempt)).toBe(false);
  });
});

describe("isFormallyUncertain — fires on exactly the formal admissions of uncertainty", () => {
  it.each([
    ["the measured near-dup knife-edge: 0.8457 confidence, 0.0085 margin", 0.8457, 0.0085],
    ["low confidence, healthy margin (class-shuffle container shape)", 0.45, 0.45],
    ["below the suggest floor entirely (missed-with-candidates)", 0.1, 0.1],
    ["just under the heal bar", DEFAULT_HEAL_THRESHOLD - 0.0001, 0.2],
    ["just under the margin bar", 0.9, DEFAULT_MIN_MARGIN - 0.0001],
  ])("%s → fallback fires", (_desc, confidence, margin) => {
    expect(isFormallyUncertain(matched(confidence, margin))).toBe(true);
  });
});
