import { describe, expect, it } from "vitest";
import { aggregateRuns, buildBaselineReport, groupBy, renderMarkdownTable } from "./report.js";
import type { BenchRunResult, TargetOutcome } from "./runner.js";

function outcome(mutationClass: TargetOutcome["mutationClass"], overrides: Partial<TargetOutcome> = {}): TargetOutcome {
  return {
    targetId: "t",
    mutationClass,
    sourceClass: mutationClass,
    route: "/x",
    frozenSelectorKey: "getByTestId(\"x\")",
    controlPassed: true,
    probeOutcome: { status: "mutation-effective", outcome: { kind: "missed" }, error: "" },
    ...overrides,
  };
}

function run(mutationClass: TargetOutcome["mutationClass"], outcomes: TargetOutcome[]): BenchRunResult {
  return { mutationClass, seed: 1, generatedAt: "2026-01-01T00:00:00.000Z", outcomes };
}

describe("groupBy", () => {
  it("groups items by the key function, preserving order within a group", () => {
    const grouped = groupBy([1, 2, 3, 4, 5], (n) => (n % 2 === 0 ? "even" : "odd"));
    expect(grouped["odd"]).toEqual([1, 3, 5]);
    expect(grouped["even"]).toEqual([2, 4]);
  });

  it("works for strings just as well as numbers", () => {
    const grouped = groupBy(["apple", "avocado", "banana"], (s) => s[0] as string);
    expect(grouped["a"]).toEqual(["apple", "avocado"]);
    expect(grouped["b"]).toEqual(["banana"]);
  });

  it("returns an empty object for an empty input", () => {
    expect(groupBy([], (n: number) => String(n))).toEqual({});
  });
});

describe("aggregateRuns", () => {
  it("an all-missed class reports 0% heal / 100% miss — the expected Phase 4 result", () => {
    const outcomes = [outcome("id-rename"), outcome("id-rename"), outcome("id-rename")];
    const [aggregate] = aggregateRuns([run("id-rename", outcomes)]);
    expect(aggregate).toMatchObject({
      mutationClass: "id-rename",
      totalAffected: 3,
      healedCorrect: 0,
      healedWrong: 0,
      suggested: 0,
      missed: 3,
      mutationIneffective: 0,
      healRate: 0,
      falseHealRate: 0,
      suggestionRate: 0,
      missRate: 1,
    });
  });

  it("mutation-ineffective anomalies are counted separately, never folded into a rate", () => {
    const outcomes = [
      outcome("tag-swap"),
      outcome("tag-swap", { probeOutcome: { status: "mutation-ineffective" } }),
    ];
    const [aggregate] = aggregateRuns([run("tag-swap", outcomes)]);
    expect(aggregate?.totalAffected).toBe(2);
    expect(aggregate?.mutationIneffective).toBe(1);
    expect(aggregate?.missed).toBe(1);
    // missRate is a fraction of totalAffected (2), not of only the valid outcomes.
    expect(aggregate?.missRate).toBe(0.5);
  });

  it("merges outcomes for the same class across multiple runs", () => {
    const a = run("sibling-reorder", [outcome("sibling-reorder")]);
    const b = run("sibling-reorder", [outcome("sibling-reorder"), outcome("sibling-reorder")]);
    const [aggregate] = aggregateRuns([a, b]);
    expect(aggregate?.totalAffected).toBe(3);
  });

  it("orders aggregates by the taxonomy's own class order, not input order", () => {
    const runs = [run("compound-release", [outcome("compound-release")]), run("id-rename", [outcome("id-rename")])];
    const aggregates = aggregateRuns(runs);
    expect(aggregates.map((a) => a.mutationClass)).toEqual(["id-rename", "compound-release"]);
  });

  it("produces no aggregate for a class with zero runs", () => {
    const aggregates = aggregateRuns([run("id-rename", [outcome("id-rename")])]);
    expect(aggregates.some((a) => a.mutationClass === "text-change")).toBe(false);
  });

  it("regression: compound-release outcomes report under compound-release, never under their sourceClass", () => {
    // A compound-release run draws targets from several base classes, so
    // each outcome's sourceClass legitimately differs from the run's own
    // mutationClass — aggregation must key off mutationClass (the run),
    // not sourceClass (the target's origin), or a base class's own direct
    // run would silently get inflated by every compound run that happens
    // to reuse one of its targets (and compound-release itself would
    // never appear in the report at all).
    const compoundOutcomes = [
      outcome("compound-release", { sourceClass: "id-rename" }),
      outcome("compound-release", { sourceClass: "text-change" }),
      outcome("compound-release", { sourceClass: "sibling-reorder" }),
    ];
    const idRenameOutcomes = [outcome("id-rename", { sourceClass: "id-rename" })];
    const aggregates = aggregateRuns([
      run("compound-release", compoundOutcomes),
      run("id-rename", idRenameOutcomes),
    ]);

    const compoundAggregate = aggregates.find((a) => a.mutationClass === "compound-release");
    const idRenameAggregate = aggregates.find((a) => a.mutationClass === "id-rename");

    expect(compoundAggregate?.totalAffected).toBe(3);
    // Not 4 — the compound run's id-rename-sourced outcome must not bleed
    // into id-rename's own direct-run aggregate.
    expect(idRenameAggregate?.totalAffected).toBe(1);
    expect(aggregates.some((a) => a.mutationClass === "text-change")).toBe(false);
    expect(aggregates.some((a) => a.mutationClass === "sibling-reorder")).toBe(false);
  });
});

describe("buildBaselineReport / renderMarkdownTable", () => {
  it("renders a markdown table with one row per class and a header", () => {
    const report = buildBaselineReport([run("id-rename", [outcome("id-rename"), outcome("id-rename")])]);
    const table = renderMarkdownTable(report.aggregates);
    expect(table).toContain("| Mutation Class | Affected | Heal Rate | False-Heal Rate | Suggestion Rate | Miss Rate |");
    expect(table).toContain("| id-rename | 2 | 0.0% | 0.0% | 0.0% | 100.0% |");
  });

  it("generatedAt is a real ISO timestamp, not fixed to the input runs' own timestamps", () => {
    const report = buildBaselineReport([run("id-rename", [outcome("id-rename")])]);
    expect(() => new Date(report.generatedAt).toISOString()).not.toThrow();
  });
});
