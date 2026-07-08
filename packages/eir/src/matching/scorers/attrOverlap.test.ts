import { describe, expect, it } from "vitest";
import { makeCandidate, makeFingerprint } from "../testFixtures.js";
import { scoreAttrOverlap } from "./attrOverlap.js";

describe("scoreAttrOverlap", () => {
  it("scores identical attrs as 1", () => {
    const fp = makeFingerprint();
    const cand = makeCandidate();
    expect(scoreAttrOverlap(fp, cand)).toBeCloseTo(1);
  });

  it("scores completely different attrs as 0", () => {
    const fp = makeFingerprint({ attrs: { "data-testid": "device-row-remove" } });
    const cand = makeCandidate({ attrs: { "data-testid": "unrelated" } });
    expect(scoreAttrOverlap(fp, cand)).toBe(0);
  });

  it("weights id/data-testid/name above role/aria-*", () => {
    const fp = makeFingerprint({ attrs: { "data-testid": "x", role: "button" } });
    const highValueMiss = makeCandidate({ attrs: { "data-testid": "y", role: "button" } });
    const lowValueMiss = makeCandidate({ attrs: { "data-testid": "x", role: "link" } });
    expect(scoreAttrOverlap(fp, lowValueMiss)).toBeGreaterThan(scoreAttrOverlap(fp, highValueMiss));
  });

  it("returns 0 (not NaN) when the fingerprint has no captured attrs", () => {
    const fp = makeFingerprint({ attrs: {} });
    const cand = makeCandidate({ attrs: { id: "anything" } });
    expect(scoreAttrOverlap(fp, cand)).toBe(0);
  });

  it("is blind to attrs the candidate has that the fingerprint never captured (extra attrs don't inflate score)", () => {
    const fp = makeFingerprint({ attrs: { "data-testid": "x" } });
    const cand = makeCandidate({ attrs: { "data-testid": "x", id: "extra", role: "button" } });
    expect(scoreAttrOverlap(fp, cand)).toBeCloseTo(1);
  });
});
