import { describe, expect, it } from "vitest";
import type { Fingerprint } from "../fingerprint.js";
import type { FingerprintReader } from "../store/fingerprintReader.js";
import { runTriageGates, type TriageInput } from "./gates.js";

const SAMPLE_FINGERPRINT: Fingerprint = {
  v: 1,
  tag: "button",
  attrs: {},
  text: "Remove",
  label: null,
  ancestors: [],
  siblingIndex: 0,
  siblingCount: 1,
  bbox: { x: 0, y: 0, w: 32, h: 32 },
};

const ZERO_MATCH_MESSAGE = "locator.click: Timeout 1500ms exceeded.\nCall log:\n  - waiting for locator('#x')";
const FOUND_NOT_VISIBLE_MESSAGE =
  "locator.click: Timeout 1500ms exceeded.\nCall log:\n  - locator resolved to <button>\n  - element is not visible";

function makeReader(entries: Readonly<Record<string, Fingerprint>> = {}): FingerprintReader {
  return {
    lookup: (route, selectorKey) => entries[`${route}::${selectorKey}`],
  };
}

function baseInput(overrides: Partial<TriageInput> = {}): TriageInput {
  return {
    route: "/dashboard/devices",
    selectorKey: 'getByTestId("device-row-remove")',
    reader: makeReader({
      '/dashboard/devices::getByTestId("device-row-remove")': SAMPLE_FINGERPRINT,
    }),
    routeAtCreation: "/dashboard/devices",
    currentRoute: "/dashboard/devices",
    documentReady: true,
    errorMessage: ZERO_MATCH_MESSAGE,
    isImperativeMethod: true,
    ...overrides,
  };
}

describe("runTriageGates", () => {
  it("is eligible when every gate passes", () => {
    const decision = runTriageGates(baseInput());
    expect(decision).toEqual({ kind: "eligible", fingerprint: SAMPLE_FINGERPRINT });
  });

  it("Gate 1 rejects when no baseline fingerprint exists (record-mode onboarding)", () => {
    const decision = runTriageGates(baseInput({ reader: makeReader({}) }));
    expect(decision).toEqual({
      kind: "rejected",
      reason: "no-fingerprint",
      detail: expect.stringContaining("no baseline fingerprint") as unknown as string,
    });
  });

  it("Gate 2 rejects when the document isn't ready", () => {
    const decision = runTriageGates(baseInput({ documentReady: false }));
    expect(decision.kind).toBe("rejected");
    expect((decision as { reason: string }).reason).toBe("page-not-sane");
  });

  it("Gate 2 rejects on an unexpected route change (e.g. redirected to /login)", () => {
    const decision = runTriageGates(baseInput({ currentRoute: "/login" }));
    expect(decision.kind).toBe("rejected");
    expect((decision as { reason: string }).reason).toBe("page-not-sane");
  });

  it("Gate 3 rejects found-but-never-visible (likely an application bug, not drift)", () => {
    const decision = runTriageGates(baseInput({ errorMessage: FOUND_NOT_VISIBLE_MESSAGE }));
    expect(decision.kind).toBe("rejected");
    expect((decision as { reason: string }).reason).toBe("failure-species-not-heal-eligible");
  });

  it("Gate 3 accepts detached as heal-eligible", () => {
    const decision = runTriageGates(
      baseInput({ errorMessage: "Element is not attached to the DOM" }),
    );
    expect(decision.kind).toBe("eligible");
  });

  it("Gate 4 rejects a non-imperative method (defense in depth; structurally unreachable in production)", () => {
    const decision = runTriageGates(baseInput({ isImperativeMethod: false }));
    expect(decision.kind).toBe("rejected");
    expect((decision as { reason: string }).reason).toBe("method-not-imperative");
  });

  it("evaluates gates in order — a Gate 1 rejection is reported even if Gate 2 would also fail", () => {
    const decision = runTriageGates(
      baseInput({ reader: makeReader({}), currentRoute: "/login" }),
    );
    expect((decision as { reason: string }).reason).toBe("no-fingerprint");
  });
});
