import { describe, expect, it } from "vitest";
import { buildFallbackPrompt } from "./prompt.js";
import type { FallbackContext } from "./verdict.js";

const CTX: FallbackContext = {
  fingerprint: {
    v: 1,
    tag: "button",
    attrs: { "data-testid": "wizard-next", type: "submit" },
    text: "Next Step",
    label: null,
    ancestors: [
      { tag: "div", id: "wizard", classes: ["wizard-nav"] },
      { tag: "section", id: null, classes: [] },
    ],
    siblingIndex: 1,
    siblingCount: 2,
    bbox: { x: 320, y: 640, w: 96, h: 32 },
  },
  candidates: [
    {
      features: {
        tag: "button",
        attrs: { "data-testid": "wizard-continue", type: "submit" },
        text: "Next Step",
        label: null,
        ancestors: [{ tag: "div", id: "wizard", classes: ["wizard-nav"] }],
        siblingIndex: 1,
        siblingCount: 2,
        bbox: { x: 320, y: 640, w: 96, h: 32 },
      },
      breakdown: { attrOverlap: 0.2, textSimilarity: 1, labelMatch: 0, ancestorChain: 0.9, siblingPosition: 1, bboxProximity: 1 },
      total: 0.68,
      selector: "button",
      domIndex: 3,
    },
  ],
  confidence: 0.68,
  margin: 0.03,
};

describe("buildFallbackPrompt", () => {
  it("is a pure function: identical context → byte-identical prompt", () => {
    expect(buildFallbackPrompt(CTX)).toBe(buildFallbackPrompt(CTX));
  });

  it("contains the fingerprint, every candidate's features and heuristic scores, and the JSON contract", () => {
    const prompt = buildFallbackPrompt(CTX);
    expect(prompt).toContain('data-testid="wizard-next"');
    expect(prompt).toContain('data-testid="wizard-continue"');
    expect(prompt).toContain("Candidate 0 (heuristic total 0.6800)");
    expect(prompt).toContain("attrOverlap=0.200");
    expect(prompt).toContain("div#wizard.wizard-nav");
    expect(prompt).toContain('"chosenCandidateIndex"');
    expect(prompt).toContain("confidence was 0.6800");
    expect(prompt).toContain("margin over the runner-up was 0.0300");
  });

  it("mentions no candidate the context does not contain (nothing beyond the capture pipeline's data)", () => {
    const prompt = buildFallbackPrompt(CTX);
    // The context has exactly one candidate; there is no Candidate 1.
    expect(prompt).not.toContain("Candidate 1");
  });
});
