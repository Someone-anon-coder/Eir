import { describe, expect, it } from "vitest";
import { planScreenshotInlining, type ScreenshotCandidate } from "./screenshotBudget.js";

describe("planScreenshotInlining", () => {
  it("inlines everything when well under budget", () => {
    const candidates: ScreenshotCandidate[] = [
      { rowIndex: 0, base64: "AAAA" },
      { rowIndex: 1, base64: "BBBB" },
    ];
    const plan = planScreenshotInlining(candidates, 10_000);
    expect(plan.dataUriByRowIndex.size).toBe(2);
    expect(plan.omittedCount).toBe(0);
    expect(plan.dataUriByRowIndex.get(0)).toBe("data:image/png;base64,AAAA");
  });

  it("stops inlining once the budget is spent, never truncating an image", () => {
    // Each data URI here is 23 ("data:image/png;base64," ) + 10 chars = 33 chars.
    const candidates: ScreenshotCandidate[] = [
      { rowIndex: 0, base64: "A".repeat(10) },
      { rowIndex: 1, base64: "B".repeat(10) },
      { rowIndex: 2, base64: "C".repeat(10) },
    ];
    // Budget for exactly two images.
    const plan = planScreenshotInlining(candidates, 33 * 2);
    expect(plan.dataUriByRowIndex.size).toBe(2);
    expect(plan.dataUriByRowIndex.has(2)).toBe(false);
    expect(plan.omittedCount).toBe(1);
  });

  it("omits everything when the budget is zero", () => {
    const candidates: ScreenshotCandidate[] = [{ rowIndex: 0, base64: "AAAA" }];
    const plan = planScreenshotInlining(candidates, 0);
    expect(plan.dataUriByRowIndex.size).toBe(0);
    expect(plan.omittedCount).toBe(1);
  });

  it("handles no candidates", () => {
    const plan = planScreenshotInlining([], 1_000);
    expect(plan.dataUriByRowIndex.size).toBe(0);
    expect(plan.omittedCount).toBe(0);
  });

  it("keeps trying later candidates that fit after an earlier one is skipped", () => {
    const candidates: ScreenshotCandidate[] = [
      { rowIndex: 0, base64: "X".repeat(100) },
      { rowIndex: 1, base64: "Y".repeat(1) },
    ];
    // Too small for row 0's huge image, but row 1's tiny one fits.
    const plan = planScreenshotInlining(candidates, 30);
    expect(plan.dataUriByRowIndex.has(0)).toBe(false);
    expect(plan.dataUriByRowIndex.has(1)).toBe(true);
    expect(plan.omittedCount).toBe(1);
  });
});
