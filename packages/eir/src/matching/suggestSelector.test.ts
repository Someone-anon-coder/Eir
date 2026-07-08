import type { Locator, Page } from "@playwright/test";
import { describe, expect, it, vi } from "vitest";
import type { CapturedCandidate } from "./captureCandidates.js";
import { suggestSelector } from "./suggestSelector.js";

function target(overrides: Partial<CapturedCandidate["features"]> = {}): CapturedCandidate {
  return {
    domIndex: 2,
    selector: "button, a, input[type=submit], input[type=button]",
    features: {
      tag: "button",
      attrs: {},
      text: null,
      label: null,
      ancestors: [],
      siblingIndex: 0,
      siblingCount: 1,
      bbox: { x: 0, y: 0, w: 32, h: 32 },
      ...overrides,
    },
  };
}

/**
 * Models Playwright's real element-identity check
 * (`targetHandle.evaluate((el, other) => el === other, candidateHandle)`)
 * without a real browser: every handle carries a `marker`, and the shared
 * `sameElementMarker` decides which marker counts as "the real target" —
 * `targetHandle.evaluate` (always the target's own handle, regardless of
 * which candidate is being checked) looks up the *other* handle's marker
 * against it.
 */
function makeHandle(marker: string, sameElementMarker: string) {
  return {
    marker,
    evaluate: vi.fn(async (_fn: unknown, other: { marker: string }) => other.marker === sameElementMarker),
    dispose: vi.fn().mockResolvedValue(undefined),
  };
}

function locatorWith(count: number, marker: string | null): Locator {
  return {
    count: vi.fn().mockResolvedValue(count),
    elementHandle: vi.fn().mockResolvedValue(marker === null ? null : { marker, dispose: vi.fn().mockResolvedValue(undefined) }),
  } as unknown as Locator;
}

/** `sameElementMarker`: whichever candidate locator's handle carries this marker is treated as the real match. */
function makePage(sameElementMarker: string, overrides: Partial<Record<keyof Page, unknown>> = {}): Page {
  const targetHandle = makeHandle("target", sameElementMarker);
  // Default `.locator(...).nth(...)`: doubles as both the internal target
  // reference (needs `elementHandle`) *and*, for the structural-fallback
  // candidate specifically, the candidate locator itself (needs `count`).
  const defaultNthResult = {
    count: vi.fn().mockResolvedValue(1),
    elementHandle: vi.fn().mockResolvedValue(targetHandle),
  };
  return {
    locator: vi.fn().mockReturnValue({
      nth: vi.fn().mockReturnValue(defaultNthResult),
    }),
    getByTestId: vi.fn().mockReturnValue(locatorWith(0, null)),
    getByRole: vi.fn().mockReturnValue(locatorWith(0, null)),
    getByLabel: vi.fn().mockReturnValue(locatorWith(0, null)),
    ...overrides,
  } as unknown as Page;
}

describe("suggestSelector", () => {
  it("prefers data-testid when it resolves uniquely to the matched element", async () => {
    const page = makePage("testid-match", {
      getByTestId: vi.fn().mockReturnValue(locatorWith(1, "testid-match")),
    });
    const result = await suggestSelector(page, target({ attrs: { "data-testid": "device-row-remove" } }));
    expect(result?.kind).toBe("data-testid");
    expect(result?.description).toContain("device-row-remove");
  });

  it("falls through to id when data-testid isn't unique/correct", async () => {
    const page = makePage("id-match", {
      getByTestId: vi.fn().mockReturnValue(locatorWith(1, "wrong-element")),
      locator: vi.fn((selector: string) => {
        if (selector === '[id="save-btn"]') return locatorWith(1, "id-match");
        return {
          nth: vi.fn().mockReturnValue({
            elementHandle: vi.fn().mockResolvedValue(makeHandle("target", "id-match")),
          }),
        };
      }),
    });
    const result = await suggestSelector(
      page,
      target({ attrs: { "data-testid": "wrong-match", id: "save-btn" } }),
    );
    expect(result?.kind).toBe("id");
  });

  it("falls through to role+accessible-name using the tag's implicit role when no attrs match", async () => {
    const page = makePage("role-match", {
      getByRole: vi.fn().mockReturnValue(locatorWith(1, "role-match")),
    });
    const result = await suggestSelector(page, target({ text: "Remove" }));
    expect(result?.kind).toBe("role");
    expect(result?.description).toContain("Remove");
  });

  it("falls through to label association when role doesn't uniquely resolve", async () => {
    const page = makePage("label-match", {
      getByLabel: vi.fn().mockReturnValue(locatorWith(1, "label-match")),
    });
    const result = await suggestSelector(page, target({ label: "Requested By" }));
    expect(result?.kind).toBe("label");
  });

  it("falls all the way back to a structural path when nothing else matches uniquely", async () => {
    const page = makePage("target"); // the structural query IS the target reference itself
    const result = await suggestSelector(page, target());
    expect(result?.kind).toBe("structural");
    expect(result?.description).toContain(".nth(2)");
  });

  it("skips a candidate that resolves to more than one element (not unique)", async () => {
    const page = makePage("testid-match", {
      getByTestId: vi.fn().mockReturnValue(locatorWith(2, "testid-match")),
    });
    const result = await suggestSelector(page, target({ attrs: { "data-testid": "shared" } }));
    expect(result?.kind).not.toBe("data-testid");
  });
});
