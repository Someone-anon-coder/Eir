import { describe, expect, it } from "vitest";
import type { QuantizedBoundingBox } from "./groundTruthFile.js";
import type { MatchLogEntry, MatchLogFeatures } from "./matchLog.js";
import {
  classifyProbeRun,
  classifyUnhealedFailure,
  MEASUREMENT_HIGH_CONFIDENCE_THRESHOLD,
  MEASUREMENT_MIN_MARGIN,
} from "./outcome.js";

function features(overrides: Partial<MatchLogFeatures> = {}): MatchLogFeatures {
  return {
    tag: "button",
    attrs: { "data-testid": "device-row-remove" },
    text: "Remove",
    label: null,
    ancestors: [],
    siblingIndex: 0,
    siblingCount: 1,
    bbox: { x: 100, y: 200, w: 64, h: 32 },
    ...overrides,
  };
}

function rejectedEntry(): MatchLogEntry {
  return {
    method: "click",
    route: "/dashboard/devices",
    selectorKey: 'getByTestId("x")',
    result: { kind: "rejected", reason: "no-fingerprint", detail: "no baseline" },
  };
}

function noCandidatesEntry(): MatchLogEntry {
  return {
    method: "click",
    route: "/dashboard/devices",
    selectorKey: 'getByTestId("x")',
    result: { kind: "no-candidates", fingerprint: features() },
  };
}

function matchedEntry(overrides: {
  confidence: number;
  margin?: number;
  winner?: Partial<MatchLogFeatures>;
  fingerprint?: Partial<MatchLogFeatures>;
}): MatchLogEntry {
  return {
    method: "click",
    route: "/dashboard/devices",
    selectorKey: 'getByTestId("x")',
    result: {
      kind: "matched",
      fingerprint: features(overrides.fingerprint),
      candidateCount: 2,
      winner: features(overrides.winner),
      breakdown: { attrOverlap: 1, textSimilarity: 1, labelMatch: 0, ancestorChain: 1, siblingPosition: 1, bboxProximity: 1 },
      confidence: overrides.confidence,
      margin: overrides.margin ?? overrides.confidence,
      suggestion: { kind: "data-testid", description: 'getByTestId("device-row-remove")' },
    },
  };
}

describe("classifyUnhealedFailure", () => {
  it("classifies as missed when no match attempt was recorded at all", () => {
    expect(classifyUnhealedFailure(undefined, undefined)).toEqual({ kind: "missed" });
  });

  it("classifies as missed when a triage gate rejected the attempt", () => {
    expect(classifyUnhealedFailure(rejectedEntry(), undefined)).toEqual({ kind: "missed" });
  });

  it("classifies as missed when no live candidates were found", () => {
    expect(classifyUnhealedFailure(noCandidatesEntry(), undefined)).toEqual({ kind: "missed" });
  });

  it("classifies as healed-correct when confidence clears the measurement threshold and there's no distractor evidence", () => {
    const entry = matchedEntry({ confidence: MEASUREMENT_HIGH_CONFIDENCE_THRESHOLD + 0.1 });
    expect(classifyUnhealedFailure(entry, undefined)).toEqual({
      kind: "healed-correct",
      confidence: MEASUREMENT_HIGH_CONFIDENCE_THRESHOLD + 0.1,
    });
  });

  it("classifies as suggested when confidence is below the measurement threshold", () => {
    const entry = matchedEntry({ confidence: MEASUREMENT_HIGH_CONFIDENCE_THRESHOLD - 0.1 });
    expect(classifyUnhealedFailure(entry, undefined)).toEqual({
      kind: "suggested",
      confidence: MEASUREMENT_HIGH_CONFIDENCE_THRESHOLD - 0.1,
    });
  });

  it(
    "classifies as suggested — not healed-correct — when confidence clears the bar but margin " +
      "doesn't (the real near-dup.table-row shape: 0.8457 confidence, 0.0085 margin)",
    () => {
      const entry = matchedEntry({
        confidence: 0.8457,
        margin: MEASUREMENT_MIN_MARGIN - 0.01,
      });
      expect(classifyUnhealedFailure(entry, undefined)).toEqual({
        kind: "suggested",
        confidence: 0.8457,
      });
    },
  );

  it("classifies as healed-correct when both confidence and margin clear their bars", () => {
    const entry = matchedEntry({
      confidence: MEASUREMENT_HIGH_CONFIDENCE_THRESHOLD + 0.1,
      margin: MEASUREMENT_MIN_MARGIN + 0.1,
    });
    expect(classifyUnhealedFailure(entry, undefined).kind).toBe("healed-correct");
  });

  describe("near-dup precision check (distractorBBox present)", () => {
    const correctBBox: QuantizedBoundingBox = { x: 480, y: 320, w: 64, h: 32 };
    const distractorBBox: QuantizedBoundingBox = { x: 480, y: 900, w: 64, h: 32 };

    it("healed-correct when the winner's position is close to the fingerprint's, not the distractor's", () => {
      const entry = matchedEntry({
        confidence: 0.9,
        fingerprint: { bbox: correctBBox },
        winner: { bbox: correctBBox },
      });
      expect(classifyUnhealedFailure(entry, distractorBBox)).toEqual({
        kind: "healed-correct",
        confidence: 0.9,
      });
    });

    it("healed-wrong when the winner's position is closer to the distractor than to the fingerprint (a real false heal)", () => {
      const entry = matchedEntry({
        confidence: 0.9,
        fingerprint: { bbox: correctBBox },
        winner: { bbox: distractorBBox, attrs: { "data-testid": "table-archived-devices-mut" } },
      });
      const result = classifyUnhealedFailure(entry, distractorBBox);
      expect(result.kind).toBe("healed-wrong");
      if (result.kind === "healed-wrong") {
        expect(result.matchedWrong).toContain("table-archived-devices-mut");
      }
    });

    it("a low-confidence match closer to the distractor is still suggested, not healed-wrong (confidence gate applies first)", () => {
      const entry = matchedEntry({
        confidence: MEASUREMENT_HIGH_CONFIDENCE_THRESHOLD - 0.05,
        fingerprint: { bbox: correctBBox },
        winner: { bbox: distractorBBox },
      });
      expect(classifyUnhealedFailure(entry, distractorBBox).kind).toBe("suggested");
    });

    it("a null distractorBBox (locate failed) never counts as evidence of a wrong match", () => {
      const entry = matchedEntry({ confidence: 0.9, fingerprint: { bbox: correctBBox }, winner: { bbox: correctBBox } });
      expect(classifyUnhealedFailure(entry, null).kind).toBe("healed-correct");
    });
  });
});

describe("classifyProbeRun", () => {
  it("an unexpectedly passing probe is flagged mutation-ineffective, never a Blueprint outcome", () => {
    const result = classifyProbeRun(true, undefined, undefined, undefined);
    expect(result).toEqual({ status: "mutation-ineffective" });
  });

  it("a failed probe with no recorded match attempt classifies as mutation-effective/missed", () => {
    const result = classifyProbeRun(false, "locator.click: Timeout 5000ms exceeded", undefined, undefined);
    expect(result).toEqual({
      status: "mutation-effective",
      outcome: { kind: "missed" },
      error: "locator.click: Timeout 5000ms exceeded",
    });
  });

  it("a failed probe with no error message still classifies, with an empty error string", () => {
    const result = classifyProbeRun(false, undefined, undefined, undefined);
    expect(result).toEqual({
      status: "mutation-effective",
      outcome: { kind: "missed" },
      error: "",
    });
  });

  it("a failed probe with a confident matched attempt classifies as healed-correct", () => {
    const entry = matchedEntry({ confidence: 0.95 });
    const result = classifyProbeRun(false, "some error", entry, undefined);
    expect(result).toEqual({
      status: "mutation-effective",
      outcome: { kind: "healed-correct", confidence: 0.95 },
      error: "some error",
    });
  });
});
