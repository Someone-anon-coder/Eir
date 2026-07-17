import { describe, expect, it } from "vitest";
import type { ReportRow } from "playwright-eir/reporter";
import { hasFindings } from "./findings.js";

function row(overrides: Partial<ReportRow>): ReportRow {
  return {
    testTitle: "a test",
    method: "click",
    route: "/dashboard/devices",
    selectorKey: 'getByTestId("device-row-edit")',
    action: "missed",
    confidence: null,
    suggestion: null,
    screenshotFile: null,
    fallback: null,
    postConditionVerification: null,
    ...overrides,
  };
}

describe("hasFindings", () => {
  it("is false for an empty report", () => {
    expect(hasFindings([])).toBe(false);
  });

  it("is false when every row is missed or drift-suspected", () => {
    expect(hasFindings([row({ action: "missed" }), row({ action: "drift-suspected" })])).toBe(false);
  });

  // §13 #5 / A2 — the exact bug: a genuine heal whose suggestion generation
  // itself failed (suggestSelector's own documented null case) must still
  // count as a finding.
  it("is true for a healed row even when suggestion is null", () => {
    expect(hasFindings([row({ action: "healed", suggestion: null })])).toBe(true);
  });

  it("is true for a suggested row with a real suggestion", () => {
    expect(
      hasFindings([row({ action: "suggested", suggestion: 'getByTestId("device-row-edit-v2")' })]),
    ).toBe(true);
  });

  it("is true for a heal-rejected row", () => {
    expect(hasFindings([row({ action: "heal-rejected" })])).toBe(true);
  });

  it("is true for a heal-attempt-failed row", () => {
    expect(hasFindings([row({ action: "heal-attempt-failed" })])).toBe(true);
  });

  it("is true when at least one row in a mixed set qualifies", () => {
    expect(hasFindings([row({ action: "missed" }), row({ action: "healed", suggestion: null })])).toBe(
      true,
    );
  });
});
