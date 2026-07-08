import type { Locator, Page } from "@playwright/test";
import { describe, expect, it, vi } from "vitest";
import type { Fingerprint } from "../fingerprint.js";
import type { FingerprintReader } from "../store/fingerprintReader.js";
import { attemptMatch, type MatcherInput } from "./matcher.js";

const SAMPLE_FINGERPRINT: Fingerprint = {
  v: 1,
  tag: "button",
  attrs: { "data-testid": "device-row-remove" },
  text: "Remove",
  label: null,
  ancestors: [],
  siblingIndex: 0,
  siblingCount: 1,
  bbox: { x: 100, y: 200, w: 64, h: 32 },
};

function makeReader(entries: Readonly<Record<string, Fingerprint>> = {}): FingerprintReader {
  return { lookup: (route, selectorKey) => entries[`${route}::${selectorKey}`] };
}

function makeHandle(marker: string) {
  return {
    marker,
    evaluate: vi.fn(async (_fn: unknown, other: { marker: string }) => other.marker === marker),
    dispose: vi.fn().mockResolvedValue(undefined),
  };
}

/** A page whose `.locator(...).nth(...)` always resolves to itself (so the structural suggestion tier always succeeds), and whose `evaluate()` returns the given raw candidates array. */
function makePage(rawCandidates: unknown[]): Page {
  const handle = makeHandle("self");
  const selfLocator = {
    count: vi.fn().mockResolvedValue(1),
    elementHandle: vi.fn().mockResolvedValue(handle),
  } as unknown as Locator;
  const noMatchLocator = {
    count: vi.fn().mockResolvedValue(0),
    elementHandle: vi.fn().mockResolvedValue(null),
  } as unknown as Locator;

  return {
    evaluate: vi.fn().mockResolvedValue(rawCandidates),
    locator: vi.fn().mockReturnValue({ nth: vi.fn().mockReturnValue(selfLocator) }),
    getByTestId: vi.fn().mockReturnValue(noMatchLocator),
    getByRole: vi.fn().mockReturnValue(noMatchLocator),
    getByLabel: vi.fn().mockReturnValue(noMatchLocator),
  } as unknown as Page;
}

function rawCandidate(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    domIndex: 0,
    tag: "button",
    attrs: { "data-testid": "device-row-remove" },
    text: "Remove",
    label: null,
    ancestors: [],
    siblingIndex: 0,
    siblingCount: 1,
    bbox: { x: 100, y: 200, width: 64, height: 32 },
    ...overrides,
  };
}

function baseInput(overrides: Partial<MatcherInput> = {}): MatcherInput {
  return {
    route: "/dashboard/devices",
    selectorKey: 'getByTestId("device-row-remove")',
    reader: makeReader({
      '/dashboard/devices::getByTestId("device-row-remove")': SAMPLE_FINGERPRINT,
    }),
    routeAtCreation: "/dashboard/devices",
    currentRoute: "/dashboard/devices",
    documentReady: true,
    errorMessage: "locator.click: Timeout 1500ms exceeded.\nCall log:\n  - waiting for locator('#x')",
    isImperativeMethod: true,
    page: makePage([rawCandidate()]),
    ...overrides,
  };
}

describe("attemptMatch", () => {
  it("returns rejected when a triage gate fails, without ever touching the page", async () => {
    const page = makePage([rawCandidate()]);
    const result = await attemptMatch(baseInput({ reader: makeReader({}), page }));
    expect(result).toEqual({
      kind: "rejected",
      reason: "no-fingerprint",
      detail: expect.stringContaining("no baseline fingerprint") as unknown as string,
    });
    expect(page.evaluate).not.toHaveBeenCalled();
  });

  it("returns no-candidates when the transient capture finds nothing rendered", async () => {
    const result = await attemptMatch(baseInput({ page: makePage([]) }));
    expect(result).toEqual({ kind: "no-candidates", fingerprint: SAMPLE_FINGERPRINT });
  });

  it("returns a matched result with score breakdown, margin, and a suggestion when a candidate is found", async () => {
    const result = await attemptMatch(baseInput());
    expect(result.kind).toBe("matched");
    if (result.kind !== "matched") throw new Error("expected matched");
    expect(result.candidateCount).toBe(1);
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.margin).toBe(result.confidence); // only one candidate — margin equals its own total
    expect(result.suggestion).not.toBeNull();
    expect(result.breakdown.attrOverlap).toBeCloseTo(1);
  });

  it("picks the higher-scoring of two candidates and reports a real margin between them", async () => {
    const page = makePage([
      rawCandidate(), // identical to the fingerprint
      rawCandidate({ attrs: {}, text: "Unrelated", domIndex: 1 }), // clearly worse
    ]);
    const result = await attemptMatch(baseInput({ page }));
    expect(result.kind).toBe("matched");
    if (result.kind !== "matched") throw new Error("expected matched");
    expect(result.margin).toBeGreaterThan(0);
  });
});
