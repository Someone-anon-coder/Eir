import { describe, expect, it } from "vitest";
import { makeCandidate, makeFingerprint } from "./testFixtures.js";
import { decideMargin, INITIAL_WEIGHTS, scoreCandidate, scoreCandidates } from "./aggregate.js";

describe("scoreCandidate", () => {
  it("scores an identical candidate near 1", () => {
    // `label` set explicitly (unlike the fixture default) so all six
    // scorers have something to measure — a real button with no
    // for=/wrapping label would correctly score labelMatch at 0 even
    // against itself, which is not what this test is demonstrating.
    const fp = makeFingerprint({ label: "Remove this device" });
    const cand = makeCandidate({ label: "Remove this device" });
    const { total } = scoreCandidate(fp, cand, INITIAL_WEIGHTS);
    expect(total).toBeCloseTo(1, 1);
  });

  it("returns a breakdown with every feature present", () => {
    const fp = makeFingerprint();
    const cand = makeCandidate();
    const { breakdown } = scoreCandidate(fp, cand, INITIAL_WEIGHTS);
    expect(Object.keys(breakdown).sort()).toEqual(
      [
        "ancestorChain",
        "attrOverlap",
        "bboxProximity",
        "labelMatch",
        "siblingPosition",
        "textSimilarity",
      ].sort(),
    );
  });
});

describe("scoreCandidates", () => {
  it("sorts highest score first", () => {
    const fp = makeFingerprint();
    const strong = makeCandidate();
    const weak = makeCandidate({ attrs: {}, text: "Unrelated", ancestors: [] });
    const scored = scoreCandidates(fp, [weak, strong], INITIAL_WEIGHTS);
    expect(scored[0]?.index).toBe(1);
    expect(scored[1]?.index).toBe(0);
  });
});

describe("decideMargin", () => {
  it("returns null when there are no candidates", () => {
    expect(decideMargin([])).toBeNull();
  });

  it("uses the winner's own total as margin when there is no runner-up", () => {
    const fp = makeFingerprint();
    const scored = scoreCandidates(fp, [makeCandidate()], INITIAL_WEIGHTS);
    const decision = decideMargin(scored);
    expect(decision?.runnerUp).toBeNull();
    expect(decision?.margin).toBeCloseTo(decision?.winner.total ?? -1);
  });

  it(
    "two-similar-tables / near-dup.table-row: identical candidates on every scorer but bbox " +
      "produce a real, measured thin margin — not a wide, confident one",
    () => {
      // Fingerprint captured against the Active table's "Front Desk Tablet"
      // Remove button.
      const fp = makeFingerprint({
        attrs: { "data-testid": "device-row-remove", type: "button" },
        text: "Remove",
        ancestors: [
          { tag: "td", id: null, classes: [] },
          { tag: "tr", id: null, classes: [] },
          { tag: "tbody", id: null, classes: [] },
        ],
        siblingIndex: 1,
        siblingCount: 2,
        bbox: { x: 480, y: 320, w: 64, h: 32 },
      });

      // The correct candidate: the same Active-table row, post-mutation
      // (only the table's own testid changed — invisible to every scorer
      // here — so its live features are otherwise unchanged).
      const correctCandidate = makeCandidate({
        attrs: { "data-testid": "device-row-remove", type: "button" },
        text: "Remove",
        ancestors: [
          { tag: "td", id: null, classes: [] },
          { tag: "tr", id: null, classes: [] },
          { tag: "tbody", id: null, classes: [] },
        ],
        siblingIndex: 1,
        siblingCount: 2,
        bbox: { x: 480, y: 320, w: 64, h: 32 },
      });

      // The distractor: the Archived table's own "Front Desk Tablet" row's
      // Remove button — identical on every scorer except bbox Y, since the
      // Archived table renders below the Active one.
      const distractorCandidate = makeCandidate({
        attrs: { "data-testid": "device-row-remove", type: "button" },
        text: "Remove",
        ancestors: [
          { tag: "td", id: null, classes: [] },
          { tag: "tr", id: null, classes: [] },
          { tag: "tbody", id: null, classes: [] },
        ],
        siblingIndex: 1,
        siblingCount: 2,
        bbox: { x: 480, y: 900, w: 64, h: 32 },
      });

      const scored = scoreCandidates(fp, [correctCandidate, distractorCandidate], INITIAL_WEIGHTS);
      const decision = decideMargin(scored);

      expect(decision?.winner.index).toBe(0); // the correct, same-position candidate wins
      // Only bboxProximity (weight 0.08) differs between the two candidates,
      // so the margin is real but thin — nowhere near the ~1.0 gap a
      // multi-scorer-agreement case produces.
      expect(decision?.margin).toBeGreaterThan(0);
      expect(decision?.margin).toBeLessThan(0.1);
    },
  );
});
