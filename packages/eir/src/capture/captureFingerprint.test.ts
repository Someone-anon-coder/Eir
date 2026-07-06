import type { Locator } from "@playwright/test";
import { describe, expect, it, vi } from "vitest";
import { captureFingerprint } from "./captureFingerprint.js";

function locatorReturning(value: unknown): Locator {
  return { evaluate: vi.fn().mockResolvedValue(value) } as unknown as Locator;
}

function locatorRejecting(error: unknown): Locator {
  return { evaluate: vi.fn().mockRejectedValue(error) } as unknown as Locator;
}

describe("captureFingerprint", () => {
  it("shapes a well-formed raw capture into a Fingerprint", async () => {
    const real = locatorReturning({
      tag: "button",
      attrs: { id: "save-btn", class: "flex p-4", type: "submit" },
      text: "  Save   changes  ",
      label: null,
      ancestors: [{ tag: "div", id: null, classes: ["flex", "wizard-step"] }],
      siblingIndex: 1,
      siblingCount: 3,
      bbox: { x: 100, y: 15, width: 200, height: 17 },
    });

    const result = await captureFingerprint(real);

    expect(result).toEqual({
      v: 1,
      tag: "button",
      attrs: { id: "save-btn", type: "submit" },
      text: "Save changes",
      label: null,
      ancestors: [{ tag: "div", id: null, classes: ["wizard-step"] }],
      siblingIndex: 1,
      siblingCount: 3,
      bbox: { x: 96, y: 0, w: 192, h: 32 },
    });
  });

  it("returns null when the bbox is unmeasurable (detached/zero rect)", async () => {
    const real = locatorReturning({
      tag: "button",
      attrs: {},
      text: "Save",
      label: null,
      ancestors: [],
      siblingIndex: 0,
      siblingCount: 1,
      bbox: null,
    });

    expect(await captureFingerprint(real)).toBeNull();
  });

  it("returns null on a malformed raw shape instead of throwing", async () => {
    const real = locatorReturning({ tag: "button" });
    expect(await captureFingerprint(real)).toBeNull();
  });

  it("returns null when evaluate() rejects (mid-capture navigation, etc.)", async () => {
    const real = locatorRejecting(new Error("element detached"));
    expect(await captureFingerprint(real)).toBeNull();
  });

  it("returns null when evaluate() returns a primitive", async () => {
    const real = locatorReturning("not an object");
    expect(await captureFingerprint(real)).toBeNull();
  });
});
