import type { ReportRow } from "playwright-eir/reporter";
import { describe, expect, it } from "vitest";
import { REPORT_MARKER } from "./marker.js";
import { renderComment } from "./renderComment.js";

const DOCS_URL = "https://example.invalid/docs/ci.md";

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

const BASE = { screenshotArtifactUrl: null, mode: "suggest-only" as const, docsUrl: DOCS_URL };

describe("renderComment", () => {
  it("renders the no-findings body when there are no rows", () => {
    const body = renderComment({ rows: [], ...BASE });
    expect(body).toContain("No heal-eligible activity this run");
    expect(body).toContain(REPORT_MARKER);
    expect(body).not.toContain("|"); // no table
  });

  it("leads the summary with route count, per sign-off", () => {
    const rows: ReportRow[] = [
      row({
        route: "/dashboard/account",
        selectorKey: 'getByTestId("a")',
        action: "suggested",
        confidence: 0.7353,
        suggestion: 'getByTestId("a-mut")',
      }),
      row({
        route: "/dashboard/provisioning",
        selectorKey: 'getByTestId("b")',
        action: "suggested",
        confidence: 0.8125,
        suggestion: 'getByTestId("b-mut")',
      }),
    ];
    const body = renderComment({ rows, ...BASE });
    expect(body).toContain("**2 routes flagged** · 2 suggested, 0 healed this run.");
  });

  it("singularizes route count", () => {
    const rows: ReportRow[] = [
      row({
        route: "/login",
        selectorKey: 'getByTestId("a")',
        action: "suggested",
        confidence: 0.9,
        suggestion: 'getByTestId("a-mut")',
      }),
    ];
    const body = renderComment({ rows, ...BASE });
    expect(body).toContain("**1 route flagged**");
  });

  it("renders a diff row with old/new selector and confidence", () => {
    const rows: ReportRow[] = [
      row({
        route: "/dashboard/account",
        selectorKey: 'getByTestId("open-delete-account")',
        action: "suggested",
        confidence: 0.7353,
        suggestion: 'getByTestId("open-delete-account-mut")',
      }),
    ];
    const body = renderComment({ rows, ...BASE });
    expect(body).toContain(
      '`- getByTestId("open-delete-account")`<br>`+ getByTestId("open-delete-account-mut")`',
    );
    expect(body).toContain("0.7353");
    expect(body).toContain("SUGGESTED");
  });

  it("never inlines an <img> tag — GitHub strips data: URI image sources from comments", () => {
    const rows: ReportRow[] = [
      row({
        route: "/x",
        selectorKey: 'getByTestId("a")',
        action: "suggested",
        confidence: 0.8,
        suggestion: 'getByTestId("a-mut")',
        screenshotFile: "screenshots/a-0.png",
      }),
    ];
    const body = renderComment({
      rows,
      ...BASE,
      screenshotArtifactUrl: "https://example.invalid/run/1",
    });
    expect(body).not.toContain("<img");
    expect(body).not.toContain("data:image");
  });

  it("links the screenshot artifact when one exists and a row captured a screenshot", () => {
    const rows: ReportRow[] = [
      row({
        route: "/x",
        selectorKey: 'getByTestId("a")',
        action: "suggested",
        confidence: 0.8,
        suggestion: 'getByTestId("a-mut")',
        screenshotFile: "screenshots/a-0.png",
      }),
    ];
    const body = renderComment({
      rows,
      ...BASE,
      screenshotArtifactUrl: "https://example.invalid/run/1",
    });
    expect(body).toContain("[this run's `eir-report` artifact](https://example.invalid/run/1)");
    expect(body).toContain("1 screenshot");
  });

  it("mentions the artifact by name, unlinked, when no artifact URL is available", () => {
    const rows: ReportRow[] = [
      row({
        route: "/x",
        selectorKey: 'getByTestId("a")',
        action: "suggested",
        confidence: 0.8,
        suggestion: 'getByTestId("a-mut")',
        screenshotFile: "screenshots/a-0.png",
      }),
    ];
    const body = renderComment({ rows, ...BASE, screenshotArtifactUrl: null });
    expect(body).toContain("this run's `eir-report` artifact");
    // Unlinked specifically means the artifact mention itself isn't a
    // markdown link — the footer's own docs-url link is unrelated and may
    // still be present.
    expect(body).not.toContain("[this run's `eir-report` artifact](");
  });

  it("says nothing about screenshots when no row captured one", () => {
    const rows: ReportRow[] = [
      row({
        route: "/x",
        selectorKey: 'getByTestId("a")',
        action: "suggested",
        confidence: 0.8,
        suggestion: 'getByTestId("a-mut")',
      }),
    ];
    const body = renderComment({
      rows,
      ...BASE,
      screenshotArtifactUrl: "https://example.invalid/run/1",
    });
    expect(body).not.toContain("screenshot");
  });

  it("NOTE-004: states plainly when a healed row has no prior baseline to verify against", () => {
    const rows: ReportRow[] = [
      row({
        route: "/x",
        selectorKey: 'getByTestId("a")',
        action: "healed",
        confidence: 0.91,
        suggestion: 'getByTestId("a-mut")',
        postConditionVerification: "skipped-no-baseline",
      }),
    ];
    const body = renderComment({ rows, ...BASE, mode: "heal" });
    expect(body).toContain("HEALED");
    expect(body).toContain("no prior baseline existed to verify against");
    expect(body).toContain("Mode: **heal**");
  });

  it("NOTE-004: credits a healed row genuinely verified against a recorded post-condition", () => {
    const rows: ReportRow[] = [
      row({
        route: "/x",
        selectorKey: 'getByTestId("a")',
        action: "healed",
        confidence: 0.91,
        suggestion: 'getByTestId("a-mut")',
        postConditionVerification: "verified",
      }),
    ];
    const body = renderComment({ rows, ...BASE, mode: "heal" });
    expect(body).toContain("genuinely verified against a recorded post-condition");
    expect(body).not.toContain("no prior baseline existed");
  });

  it("NOTE-004: says nothing about verification for non-healed rows", () => {
    const rows: ReportRow[] = [
      row({
        route: "/x",
        selectorKey: 'getByTestId("a")',
        action: "suggested",
        confidence: 0.5,
        suggestion: 'getByTestId("a-mut")',
      }),
    ];
    const body = renderComment({ rows, ...BASE });
    expect(body).not.toContain("HEALED row");
  });

  it("omits the mode line entirely when mode is unknown", () => {
    const rows: ReportRow[] = [
      row({
        route: "/x",
        selectorKey: 'getByTestId("a")',
        action: "suggested",
        confidence: 0.8,
        suggestion: 'getByTestId("a-mut")',
      }),
    ];
    const body = renderComment({ rows, ...BASE, mode: "unknown" });
    expect(body).not.toContain("Mode:");
  });

  it("folds non-actionable rows (missed / drift-suspected) into an honest aside, never a fake diff", () => {
    const rows: ReportRow[] = [
      row({
        route: "/x",
        selectorKey: 'getByTestId("a")',
        action: "suggested",
        confidence: 0.8,
        suggestion: 'getByTestId("a-mut")',
      }),
      row({
        route: "/y",
        selectorKey: 'getByTestId("b")',
        action: "missed",
        confidence: null,
        suggestion: null,
      }),
      row({
        route: "/z",
        selectorKey: 'getByTestId("c")',
        action: "drift-suspected",
        confidence: 0.6,
        suggestion: null,
      }),
    ];
    const body = renderComment({ rows, ...BASE });
    expect(body).toContain("2 other outcomes");
    expect(body).not.toContain('getByTestId("b")');
  });

  it("always ends with the upsert marker on the final line", () => {
    const rows: ReportRow[] = [
      row({
        route: "/x",
        selectorKey: 'getByTestId("a")',
        action: "suggested",
        confidence: 0.8,
        suggestion: 'getByTestId("a-mut")',
      }),
    ];
    const body = renderComment({ rows, ...BASE });
    expect(body.trimEnd().endsWith(REPORT_MARKER)).toBe(true);
  });

  it("marks LLM-assisted rows in the table and explains the suggestion-cap in a dedicated block", () => {
    const rows: ReportRow[] = [
      row({
        route: "/x",
        selectorKey: 'getByTestId("a")',
        action: "suggested",
        confidence: 0.5,
        suggestion: 'getByTestId("a-mut")',
        fallback: { provider: "gemini", verdict: "contradicted", detail: "<button> — button >> nth=2: text matches better" },
      }),
      row({
        route: "/y",
        selectorKey: 'getByTestId("b")',
        action: "suggested",
        confidence: 0.9,
        suggestion: 'getByTestId("b-mut")',
      }),
    ];
    const body = renderComment({ rows, ...BASE });
    expect(body).toContain("SUGGESTED · ⚠ LLM |");
    expect(body).toContain("**LLM-assisted rows**");
    expect(body).toContain("at suggestion strength only");
    expect(body).toContain("gemini: **contradicted** — <button> — button >> nth=2: text matches better");
    // The purely heuristic row carries no marker.
    const lineForB = body.split("\n").find((line) => line.includes('getByTestId("b")') && line.startsWith("|"));
    expect(lineForB).toBeDefined();
    expect(lineForB).not.toContain("LLM");
  });

  it("renders no LLM block at all when no row has fallback data (the default path)", () => {
    const rows: ReportRow[] = [
      row({
        route: "/x",
        selectorKey: 'getByTestId("a")',
        action: "suggested",
        confidence: 0.8,
        suggestion: 'getByTestId("a-mut")',
      }),
    ];
    const body = renderComment({ rows, ...BASE });
    expect(body).not.toContain("LLM");
  });

  it("a no-verdict fallback row shows the verdict but suppresses the raw reason detail", () => {
    const rows: ReportRow[] = [
      row({
        route: "/x",
        selectorKey: 'getByTestId("a")',
        action: "suggested",
        confidence: 0.5,
        suggestion: 'getByTestId("a-mut")',
        fallback: { provider: "gemini", verdict: "no-verdict", detail: "http-429" },
      }),
    ];
    const body = renderComment({ rows, ...BASE });
    expect(body).toContain("gemini: **no-verdict**");
    expect(body).not.toContain("http-429");
  });

  it("A3: collapses retried rows for the same selector into one, headline count reflects unique selectors", () => {
    const rows: ReportRow[] = [
      row({
        route: "/x",
        selectorKey: 'getByTestId("a")',
        action: "suggested",
        confidence: 0.72,
        suggestion: 'getByTestId("a-mut")',
      }),
      row({
        route: "/x",
        selectorKey: 'getByTestId("a")',
        action: "suggested",
        confidence: 0.72,
        suggestion: 'getByTestId("a-mut")',
      }),
    ];
    const body = renderComment({ rows, ...BASE });
    const diffLines = body.split("\n").filter((line) => line.includes('getByTestId("a")'));
    expect(diffLines).toHaveLength(1);
    expect(body).toContain("**1 route flagged** · 1 suggested, 0 healed this run.");
  });

  it("A3: notes the duplicate count and shows the highest confidence when duplicates disagree", () => {
    const rows: ReportRow[] = [
      row({
        route: "/x",
        selectorKey: 'getByTestId("a")',
        action: "suggested",
        confidence: 0.5,
        suggestion: 'getByTestId("a-mut")',
      }),
      row({
        route: "/x",
        selectorKey: 'getByTestId("a")',
        action: "suggested",
        confidence: 0.81,
        suggestion: 'getByTestId("a-mut")',
      }),
    ];
    const body = renderComment({ rows, ...BASE });
    expect(body).toContain("0.8100 (seen 2x)");
    expect(body).not.toContain("0.5000");
  });

  it("A3: does not annotate a selector that was seen only once", () => {
    const rows: ReportRow[] = [
      row({
        route: "/x",
        selectorKey: 'getByTestId("a")',
        action: "suggested",
        confidence: 0.8,
        suggestion: 'getByTestId("a-mut")',
      }),
    ];
    const body = renderComment({ rows, ...BASE });
    expect(body).not.toContain("seen");
  });

  it("A3: dedupes non-actionable (missed/drift-suspected) duplicates in the aside count too", () => {
    const rows: ReportRow[] = [
      row({ route: "/y", selectorKey: 'getByTestId("b")', action: "missed" }),
      row({ route: "/y", selectorKey: 'getByTestId("b")', action: "missed" }),
      row({
        route: "/x",
        selectorKey: 'getByTestId("a")',
        action: "suggested",
        confidence: 0.8,
        suggestion: 'getByTestId("a-mut")',
      }),
    ];
    const body = renderComment({ rows, ...BASE });
    expect(body).toContain("1 other outcome");
  });

  it("carries the RISK-009 scope note honestly limiting coverage claims", () => {
    const rows: ReportRow[] = [
      row({
        route: "/x",
        selectorKey: 'getByTestId("a")',
        action: "suggested",
        confidence: 0.8,
        suggestion: 'getByTestId("a-mut")',
      }),
    ];
    const body = renderComment({ rows, ...BASE });
    expect(body).toContain("not a full audit of every selector on this PR");
  });
});
