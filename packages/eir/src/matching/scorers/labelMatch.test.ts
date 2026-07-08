import { describe, expect, it } from "vitest";
import { makeCandidate, makeFingerprint } from "../testFixtures.js";
import { scoreLabelMatch } from "./labelMatch.js";

describe("scoreLabelMatch", () => {
  it("scores identical labels as 1", () => {
    const fp = makeFingerprint({ label: "Requested By" });
    const cand = makeCandidate({ label: "Requested By" });
    expect(scoreLabelMatch(fp, cand)).toBeCloseTo(1);
  });

  it("gives partial credit for a relabeled field", () => {
    const fp = makeFingerprint({ label: "Request Title" });
    const cand = makeCandidate({ label: "Title" });
    const score = scoreLabelMatch(fp, cand);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });

  it("returns 0 when either side has no label (e.g. a button with no for=/wrapping label)", () => {
    const fp = makeFingerprint({ label: "Requested By" });
    const cand = makeCandidate({ label: null });
    expect(scoreLabelMatch(fp, cand)).toBe(0);
  });

  it("scores two unrelated field labels low", () => {
    const fp = makeFingerprint({ label: "Requested By" });
    const cand = makeCandidate({ label: "Duration" });
    expect(scoreLabelMatch(fp, cand)).toBeLessThan(0.5);
  });
});
