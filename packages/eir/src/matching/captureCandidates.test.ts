import type { Page } from "@playwright/test";
import { describe, expect, it, vi } from "vitest";
import { captureCandidates } from "./captureCandidates.js";

function pageReturning(value: unknown): Page {
  return { evaluate: vi.fn().mockResolvedValue(value) } as unknown as Page;
}

function pageRejecting(error: unknown): Page {
  return { evaluate: vi.fn().mockRejectedValue(error) } as unknown as Page;
}

function rawCandidate(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    domIndex: 0,
    tag: "button",
    attrs: { id: "x", class: "flex p-4" },
    text: "  Remove  ",
    label: null,
    ancestors: [{ tag: "div", id: null, classes: ["flex", "data-table"] }],
    siblingIndex: 0,
    siblingCount: 2,
    bbox: { x: 10, y: 20, width: 64, height: 32 },
    ...overrides,
  };
}

describe("captureCandidates", () => {
  it("shapes every well-formed raw candidate through the same pipeline as a stored fingerprint", async () => {
    const page = pageReturning([rawCandidate({ domIndex: 3 })]);
    const result = await captureCandidates(page, "button", undefined);
    expect(result).toEqual([
      {
        domIndex: 3,
        selector: expect.any(String) as unknown as string,
        features: {
          tag: "button",
          attrs: { id: "x" },
          text: "Remove",
          label: null,
          ancestors: [{ tag: "div", id: null, classes: ["data-table"] }],
          siblingIndex: 0,
          siblingCount: 2,
          bbox: { x: 0, y: 32, w: 64, h: 32 },
        },
      },
    ]);
  });

  it("skips a candidate with an unmeasurable bbox rather than including a partial shape", async () => {
    const page = pageReturning([rawCandidate({ bbox: null })]);
    expect(await captureCandidates(page, "button", undefined)).toEqual([]);
  });

  it("skips malformed entries (missing domIndex) instead of throwing", async () => {
    const page = pageReturning([rawCandidate(), { tag: "button" }]);
    const result = await captureCandidates(page, "button", undefined);
    expect(result).toHaveLength(1);
  });

  it("returns an empty array when evaluate() returns something other than an array", async () => {
    const page = pageReturning("not an array");
    expect(await captureCandidates(page, "button", undefined)).toEqual([]);
  });

  it("returns an empty array (never throws) when evaluate() rejects", async () => {
    const page = pageRejecting(new Error("navigation in progress"));
    await expect(captureCandidates(page, "button", undefined)).resolves.toEqual([]);
  });

  it("passes the tag-swap-expanded selector to evaluate for a button, and carries it on each candidate", async () => {
    const evaluateSpy = vi.fn().mockResolvedValue([rawCandidate()]);
    const page = { evaluate: evaluateSpy } as unknown as Page;
    const result = await captureCandidates(page, "button", undefined);
    expect(evaluateSpy).toHaveBeenCalledWith(expect.any(Function), expect.stringContaining("a"));
    expect(result[0]?.selector).toContain("a");
  });

  it(
    "passes a plain 'input' selector (never expanded to button/a) for a text input — " +
      "the real bug found via a live benchmark run",
    async () => {
      const evaluateSpy = vi.fn().mockResolvedValue([]);
      const page = { evaluate: evaluateSpy } as unknown as Page;
      await captureCandidates(page, "input", "text");
      expect(evaluateSpy).toHaveBeenCalledWith(expect.any(Function), "input");
    },
  );

  it("expands to the button-like group for an input[type=submit]", async () => {
    const evaluateSpy = vi.fn().mockResolvedValue([]);
    const page = { evaluate: evaluateSpy } as unknown as Page;
    await captureCandidates(page, "input", "submit");
    expect(evaluateSpy).toHaveBeenCalledWith(expect.any(Function), expect.stringContaining("button"));
  });
});
