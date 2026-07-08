import { describe, expect, it } from "vitest";
import { makeCandidate, makeFingerprint } from "../testFixtures.js";
import { scoreSiblingPosition } from "./siblingPosition.js";

describe("scoreSiblingPosition", () => {
  it("scores an exact index match as 1", () => {
    const fp = makeFingerprint({ siblingIndex: 1, siblingCount: 5 });
    const cand = makeCandidate({ siblingIndex: 1, siblingCount: 5 });
    expect(scoreSiblingPosition(fp, cand)).toBeCloseTo(1);
  });

  it("gives partial credit for an off-by-one shift", () => {
    const fp = makeFingerprint({ siblingIndex: 0, siblingCount: 5 });
    const cand = makeCandidate({ siblingIndex: 1, siblingCount: 5 });
    const score = scoreSiblingPosition(fp, cand);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });

  it("degrades an off-by-one shift faster in a small group than a large one", () => {
    const smallGroup = scoreSiblingPosition(
      makeFingerprint({ siblingIndex: 0, siblingCount: 2 }),
      makeCandidate({ siblingIndex: 1, siblingCount: 2 }),
    );
    const largeGroup = scoreSiblingPosition(
      makeFingerprint({ siblingIndex: 0, siblingCount: 30 }),
      makeCandidate({ siblingIndex: 1, siblingCount: 30 }),
    );
    expect(largeGroup).toBeGreaterThan(smallGroup);
  });

  it("never goes negative for a far-off index", () => {
    const fp = makeFingerprint({ siblingIndex: 0, siblingCount: 3 });
    const cand = makeCandidate({ siblingIndex: 2, siblingCount: 3 });
    expect(scoreSiblingPosition(fp, cand)).toBeGreaterThanOrEqual(0);
  });
});
