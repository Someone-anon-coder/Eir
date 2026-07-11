import { describe, expect, it } from "vitest";
import type { Fingerprint } from "../fingerprint.js";
import { INITIAL_WEIGHTS } from "../matching/aggregate.js";
import { checkSelfSimilarity } from "./driftCheck.js";

function fp(overrides: Partial<Fingerprint> = {}): Fingerprint {
  return {
    v: 1,
    tag: "button",
    attrs: { id: "edit-btn", "data-testid": "device-row-edit" },
    text: "Edit",
    label: null,
    ancestors: [{ tag: "td", id: null, classes: [] }, { tag: "tr", id: null, classes: [] }],
    siblingIndex: 0,
    siblingCount: 2,
    bbox: { x: 100, y: 200, w: 64, h: 32 },
    ...overrides,
  };
}

describe("checkSelfSimilarity", () => {
  it("is not suspected when the fresh capture is identical to the stored baseline", () => {
    const result = checkSelfSimilarity(fp(), fp(), INITIAL_WEIGHTS, 0.7);
    expect(result.suspected).toBe(false);
    expect(result.score).toBeCloseTo(1);
  });

  it("is not suspected for a harmless text-only evolution on an id/testid-anchored selector (attrOverlap dominates)", () => {
    const result = checkSelfSimilarity(fp(), fp({ text: "Edit Device" }), INITIAL_WEIGHTS, 0.7);
    expect(result.suspected).toBe(false);
  });

  it("is suspected when the resolved element looks like a different logical element entirely (RISK-009 shape)", () => {
    const driftedFingerprint = fp({
      attrs: { id: "remove-btn", "data-testid": "device-row-remove" },
      text: "Remove",
      siblingIndex: 1,
    });
    const result = checkSelfSimilarity(fp(), driftedFingerprint, INITIAL_WEIGHTS, 0.7);
    expect(result.suspected).toBe(true);
    expect(result.score).toBeLessThan(0.7);
  });

  it("respects a custom threshold", () => {
    const slightlyDifferent = fp({ text: "Edit Device", siblingIndex: 1 });
    const lenient = checkSelfSimilarity(fp(), slightlyDifferent, INITIAL_WEIGHTS, 0.1);
    const strict = checkSelfSimilarity(fp(), slightlyDifferent, INITIAL_WEIGHTS, 0.99);
    expect(lenient.suspected).toBe(false);
    expect(strict.suspected).toBe(true);
  });
});
