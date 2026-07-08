import { describe, expect, it } from "vitest";
import { makeCandidate, makeFingerprint } from "../testFixtures.js";
import { MAX_DISTANCE_PX, scoreBboxProximity } from "./bboxProximity.js";

describe("scoreBboxProximity", () => {
  it("scores an identical bbox as 1", () => {
    const fp = makeFingerprint({ bbox: { x: 100, y: 200, w: 64, h: 32 } });
    const cand = makeCandidate({ bbox: { x: 100, y: 200, w: 64, h: 32 } });
    expect(scoreBboxProximity(fp, cand)).toBeCloseTo(1);
  });

  it("scores a far-away element near 0", () => {
    const fp = makeFingerprint({ bbox: { x: 0, y: 0, w: 64, h: 32 } });
    const cand = makeCandidate({ bbox: { x: 0, y: MAX_DISTANCE_PX * 2, w: 64, h: 32 } });
    expect(scoreBboxProximity(fp, cand)).toBe(0);
  });

  it("is the deciding signal for two structurally-identical rows stacked vertically (near-dup.table-row)", () => {
    // Active table renders above Archived; same row content, same
    // attrs/text/ancestors/sibling-index — only Y differs.
    const fp = makeFingerprint({ bbox: { x: 480, y: 320, w: 64, h: 32 } });
    const sameTableRow = makeCandidate({ bbox: { x: 480, y: 320, w: 64, h: 32 } });
    const otherTableRow = makeCandidate({ bbox: { x: 480, y: 900, w: 64, h: 32 } });
    expect(scoreBboxProximity(fp, sameTableRow)).toBeGreaterThan(
      scoreBboxProximity(fp, otherTableRow),
    );
  });

  it("tolerates small reflow-scale offsets without collapsing to 0", () => {
    const fp = makeFingerprint({ bbox: { x: 100, y: 200, w: 64, h: 32 } });
    const cand = makeCandidate({ bbox: { x: 100, y: 232, w: 64, h: 32 } });
    expect(scoreBboxProximity(fp, cand)).toBeGreaterThan(0.5);
  });
});
