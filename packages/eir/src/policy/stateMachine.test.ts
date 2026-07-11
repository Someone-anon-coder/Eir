import { describe, expect, it } from "vitest";
import type { Fingerprint } from "../fingerprint.js";
import type { MatchAttempt } from "../matching/matcher.js";
import type { CandidateFeatures } from "../matching/types.js";
import { decidePolicyAction } from "./stateMachine.js";
import type { EirMode } from "./eirMode.js";

const FINGERPRINT: Fingerprint = {
  v: 1,
  tag: "button",
  attrs: {},
  text: "Remove",
  label: null,
  ancestors: [],
  siblingIndex: 0,
  siblingCount: 1,
  bbox: { x: 0, y: 0, w: 32, h: 32 },
};

const WINNER: CandidateFeatures = {
  tag: "button",
  attrs: {},
  text: "Remove",
  label: null,
  ancestors: [],
  siblingIndex: 0,
  siblingCount: 1,
  bbox: { x: 0, y: 0, w: 32, h: 32 },
};

const HEAL_MODE: EirMode = { mode: "heal", healThreshold: 0.7, suggestThreshold: 0.3 };
const SUGGEST_ONLY: EirMode = { mode: "suggest-only" };

function matched(confidence: number, margin: number): MatchAttempt {
  return {
    kind: "matched",
    fingerprint: FINGERPRINT,
    candidateCount: 2,
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
    winnerLocator: { selector: "tr", domIndex: 0 },
  };
}

describe("decidePolicyAction — truth table", () => {
  it.each([
    // [description, attempt, mode, expectedKind]
    ["rejected → fail-normally regardless of mode", { kind: "rejected", reason: "no-fingerprint", detail: "" } satisfies MatchAttempt, HEAL_MODE, "fail-normally"],
    ["no-candidates → fail-normally regardless of mode", { kind: "no-candidates", fingerprint: FINGERPRINT } satisfies MatchAttempt, SUGGEST_ONLY, "fail-normally"],
    ["heal mode, confidence high + margin clears → heal-and-continue", matched(0.9, 0.2), HEAL_MODE, "heal-and-continue"],
    ["heal mode, confidence high but margin thin (near-dup knife-edge) → fail-with-suggestion", matched(0.9, 0.01), HEAL_MODE, "fail-with-suggestion"],
    ["heal mode, confidence below heal bar but above suggest floor → fail-with-suggestion", matched(0.5, 0.2), HEAL_MODE, "fail-with-suggestion"],
    ["heal mode, confidence below suggest floor → fail-normally", matched(0.1, 0.2), HEAL_MODE, "fail-normally"],
    ["suggest-only, confidence high + margin clears → still only fail-with-suggestion (never retries)", matched(0.95, 0.5), SUGGEST_ONLY, "fail-with-suggestion"],
    ["suggest-only, confidence below the default suggest floor → fail-normally", matched(0.1, 0.5), SUGGEST_ONLY, "fail-normally"],
  ] as const)("%s", (_description, attempt, mode, expectedKind) => {
    expect(decidePolicyAction(attempt, mode).kind).toBe(expectedKind);
  });
});
