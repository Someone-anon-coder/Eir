import type { ReportRow } from "playwright-eir/reporter";
import { describe, expect, it } from "vitest";
import { dedupeReportRows } from "./dedupe.js";

function row(
  overrides: Partial<ReportRow> & Pick<ReportRow, "route" | "selectorKey" | "action">,
): ReportRow {
  return {
    testTitle: "a test",
    method: "click",
    confidence: null,
    suggestion: null,
    screenshotFile: null,
    fallback: null,
    postConditionVerification: null,
    ...overrides,
  };
}

describe("dedupeReportRows", () => {
  it("returns one entry per row when nothing repeats", () => {
    const rows = [
      row({ route: "/x", selectorKey: 'getByTestId("a")', action: "suggested", suggestion: "a-mut" }),
      row({ route: "/y", selectorKey: 'getByTestId("b")', action: "suggested", suggestion: "b-mut" }),
    ];

    const deduped = dedupeReportRows(rows);

    expect(deduped).toHaveLength(2);
    expect(deduped.every((entry) => entry.seenCount === 1)).toBe(true);
  });

  // The exact bug this closes: CI's per-spec retries produce duplicate
  // rows for the same broken selector — 3 unique selectors across 2
  // retried attempts becomes 6 raw rows.
  it("collapses retried rows sharing (route, selectorKey, suggestion) into one entry", () => {
    const attempt1 = row({
      route: "/x",
      selectorKey: 'getByTestId("a")',
      action: "suggested",
      suggestion: "a-mut",
      confidence: 0.72,
    });
    const attempt2 = row({
      route: "/x",
      selectorKey: 'getByTestId("a")',
      action: "suggested",
      suggestion: "a-mut",
      confidence: 0.72,
    });

    const deduped = dedupeReportRows([attempt1, attempt2]);

    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.seenCount).toBe(2);
  });

  it("the 3-unique-selectors-across-2-retries scenario collapses 6 rows to 3 entries", () => {
    const selectors = ["a", "b", "c"];
    const rows = selectors.flatMap((id) => [
      row({ route: "/x", selectorKey: `getByTestId("${id}")`, action: "suggested", suggestion: `${id}-mut` }),
      row({ route: "/x", selectorKey: `getByTestId("${id}")`, action: "suggested", suggestion: `${id}-mut` }),
    ]);

    expect(rows).toHaveLength(6);
    const deduped = dedupeReportRows(rows);
    expect(deduped).toHaveLength(3);
    expect(deduped.every((entry) => entry.seenCount === 2)).toBe(true);
  });

  it("picks the highest-confidence row as the representative when duplicates disagree", () => {
    const low = row({
      route: "/x",
      selectorKey: 'getByTestId("a")',
      action: "suggested",
      suggestion: "a-mut",
      confidence: 0.5,
    });
    const high = row({
      route: "/x",
      selectorKey: 'getByTestId("a")',
      action: "suggested",
      suggestion: "a-mut",
      confidence: 0.81,
    });

    const deduped = dedupeReportRows([low, high]);

    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.row.confidence).toBe(0.81);
    expect(deduped[0]?.seenCount).toBe(2);
  });

  it("ties on confidence break toward the first-seen row", () => {
    const first = row({
      route: "/x",
      selectorKey: 'getByTestId("a")',
      action: "suggested",
      suggestion: "a-mut",
      confidence: 0.7,
      testTitle: "first attempt",
    });
    const second = row({
      route: "/x",
      selectorKey: 'getByTestId("a")',
      action: "suggested",
      suggestion: "a-mut",
      confidence: 0.7,
      testTitle: "second attempt",
    });

    const deduped = dedupeReportRows([first, second]);

    expect(deduped[0]?.row.testTitle).toBe("first attempt");
  });

  it("does not collapse rows with a null confidence over a row with a real one", () => {
    const noConfidence = row({
      route: "/x",
      selectorKey: 'getByTestId("a")',
      action: "missed",
      suggestion: null,
      confidence: null,
    });
    const withConfidence = row({
      route: "/x",
      selectorKey: 'getByTestId("a")',
      action: "missed",
      suggestion: null,
      confidence: 0.1,
    });

    const deduped = dedupeReportRows([noConfidence, withConfidence]);

    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.row.confidence).toBe(0.1);
  });

  it("does not merge rows for the same selector with a different suggestion", () => {
    const rows = [
      row({ route: "/x", selectorKey: 'getByTestId("a")', action: "suggested", suggestion: "a-mut-1" }),
      row({ route: "/x", selectorKey: 'getByTestId("a")', action: "suggested", suggestion: "a-mut-2" }),
    ];

    expect(dedupeReportRows(rows)).toHaveLength(2);
  });

  it("does not merge the same selector across different routes", () => {
    const rows = [
      row({ route: "/x", selectorKey: 'getByTestId("a")', action: "suggested", suggestion: "a-mut" }),
      row({ route: "/y", selectorKey: 'getByTestId("a")', action: "suggested", suggestion: "a-mut" }),
    ];

    expect(dedupeReportRows(rows)).toHaveLength(2);
  });

  it("preserves first-seen order across groups", () => {
    const rows = [
      row({ route: "/z", selectorKey: 'getByTestId("z")', action: "suggested", suggestion: "z-mut" }),
      row({ route: "/a", selectorKey: 'getByTestId("a")', action: "suggested", suggestion: "a-mut" }),
      row({ route: "/z", selectorKey: 'getByTestId("z")', action: "suggested", suggestion: "z-mut" }),
    ];

    const deduped = dedupeReportRows(rows);

    expect(deduped.map((entry) => entry.row.route)).toEqual(["/z", "/a"]);
  });
});
