import { describe, expect, it } from "vitest";
import { makeCandidate, makeFingerprint } from "../testFixtures.js";
import { scoreAncestorChain } from "./ancestorChain.js";

describe("scoreAncestorChain", () => {
  it("scores an identical chain as 1", () => {
    const fp = makeFingerprint();
    const cand = makeCandidate();
    expect(scoreAncestorChain(fp, cand)).toBeCloseTo(1);
  });

  it("scores a completely different chain as 0", () => {
    const fp = makeFingerprint({
      ancestors: [{ tag: "td", id: null, classes: [] }],
    });
    const cand = makeCandidate({
      ancestors: [{ tag: "section", id: "wizard", classes: ["wizard-step"] }],
    });
    expect(scoreAncestorChain(fp, cand)).toBe(0);
  });

  it("rewards a wrapper-inject shift: hop 1 changes, hops 2/3 still line up", () => {
    const fp = makeFingerprint({
      ancestors: [
        { tag: "div", id: null, classes: ["account-page"] },
        { tag: "section", id: null, classes: [] },
        { tag: "body", id: null, classes: [] },
      ],
    });
    const wrapped = makeCandidate({
      ancestors: [
        { tag: "div", id: null, classes: [] }, // newly injected wrapper
        { tag: "div", id: null, classes: ["account-page"] },
        { tag: "section", id: null, classes: [] },
      ],
    });
    const unrelated = makeCandidate({
      ancestors: [
        { tag: "nav", id: null, classes: [] },
        { tag: "header", id: null, classes: [] },
        { tag: "body", id: null, classes: [] },
      ],
    });
    expect(scoreAncestorChain(fp, wrapped)).toBeGreaterThan(scoreAncestorChain(fp, unrelated));
  });

  it("is blind to a distinguishing container beyond the 3-hop window (near-dup.table-row case)", () => {
    // Both rows' Remove buttons share an identical 3-hop chain
    // (button -> td -> tr -> tbody); the <table> that actually
    // distinguishes Active from Archived sits at hop 4, out of range.
    const fp = makeFingerprint({
      ancestors: [
        { tag: "td", id: null, classes: [] },
        { tag: "tr", id: null, classes: [] },
        { tag: "tbody", id: null, classes: [] },
      ],
    });
    const archivedRowCandidate = makeCandidate({
      ancestors: [
        { tag: "td", id: null, classes: [] },
        { tag: "tr", id: null, classes: [] },
        { tag: "tbody", id: null, classes: [] },
      ],
    });
    expect(scoreAncestorChain(fp, archivedRowCandidate)).toBeCloseTo(1);
  });

  it("returns 0 when the fingerprint captured no ancestors", () => {
    const fp = makeFingerprint({ ancestors: [] });
    const cand = makeCandidate();
    expect(scoreAncestorChain(fp, cand)).toBe(0);
  });
});
