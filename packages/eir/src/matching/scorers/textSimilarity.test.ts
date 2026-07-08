import { describe, expect, it } from "vitest";
import { makeCandidate, makeFingerprint } from "../testFixtures.js";
import { scoreTextSimilarity } from "./textSimilarity.js";

describe("scoreTextSimilarity", () => {
  it("scores identical text as 1", () => {
    const fp = makeFingerprint({ text: "Log Out" });
    const cand = makeCandidate({ text: "Log Out" });
    expect(scoreTextSimilarity(fp, cand)).toBeCloseTo(1);
  });

  it("gives partial credit for reworded text (text-change class)", () => {
    const fp = makeFingerprint({ text: "Log Out" });
    const cand = makeCandidate({ text: "Sign Out" });
    const score = scoreTextSimilarity(fp, cand);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });

  it("returns 0 when the fingerprint has no text (nothing to compare)", () => {
    const fp = makeFingerprint({ text: null });
    const cand = makeCandidate({ text: "Remove" });
    expect(scoreTextSimilarity(fp, cand)).toBe(0);
  });

  it("returns 0 when the candidate has no text, even if the fingerprint does", () => {
    const fp = makeFingerprint({ text: "Remove" });
    const cand = makeCandidate({ text: null });
    expect(scoreTextSimilarity(fp, cand)).toBe(0);
  });

  it("does not treat two textless elements as a match", () => {
    const fp = makeFingerprint({ text: null });
    const cand = makeCandidate({ text: null });
    expect(scoreTextSimilarity(fp, cand)).toBe(0);
  });
});
