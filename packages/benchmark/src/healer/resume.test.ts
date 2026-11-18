import { describe, expect, it } from "vitest";
import { BudgetGuard, turnCapReached } from "./budget.js";
import { planRuns, runFilePath, runKeyString, type RunKey } from "./resume.js";

describe("run keys", () => {
  it("are stable strings and filesystem-safe paths", () => {
    const key: RunKey = { tool: "healer", targetId: "near-dup.editRemove.dev-4.edit", run: 2 };
    expect(runKeyString(key)).toBe("healer__near-dup.editRemove.dev-4.edit__run2");
    expect(runFilePath("/out", key)).toBe("/out/healer/near-dup.editRemove.dev-4.edit.run2.json");
    expect(runFilePath("/out", { ...key, targetId: "a/b c" })).toBe("/out/healer/a_b_c.run2.json");
  });
});

describe("planRuns", () => {
  const targetIds = ["t1", "t2"];

  it("plans 3 healer runs and 1 Eir run per target", () => {
    const plan = planRuns({
      targetIds,
      tools: ["healer", "eir"],
      healerRuns: 3,
      eirRuns: 1,
      exists: () => false,
    });
    expect(plan.pending).toHaveLength(2 * (3 + 1));
    expect(plan.skipped).toHaveLength(0);
  });

  it("skips runs whose JSON already exists, so an interrupted job resumes", () => {
    const done = new Set(["healer__t1__run1", "healer__t1__run2", "eir__t2__run1"]);
    const plan = planRuns({
      targetIds,
      tools: ["healer", "eir"],
      healerRuns: 3,
      eirRuns: 1,
      exists: (k) => done.has(runKeyString(k)),
    });
    expect(plan.skipped.map(runKeyString).sort()).toEqual([...done].sort());
    expect(plan.pending.map(runKeyString)).not.toContain("healer__t1__run1");
    expect(plan.pending).toHaveLength(8 - 3);
  });

  it("honours --tool: only the requested tool is planned", () => {
    const plan = planRuns({
      targetIds,
      tools: ["eir"],
      healerRuns: 3,
      eirRuns: 1,
      exists: () => false,
    });
    expect(plan.pending.every((k) => k.tool === "eir")).toBe(true);
  });

  it("a Eir repeat is just eirRuns = 2", () => {
    const plan = planRuns({
      targetIds: ["t1"],
      tools: ["eir"],
      healerRuns: 3,
      eirRuns: 2,
      exists: () => false,
    });
    expect(plan.pending.map((k) => k.run)).toEqual([1, 2]);
  });
});

describe("BudgetGuard", () => {
  it("never trips without a limit", () => {
    const g = new BudgetGuard(undefined);
    g.record(1000);
    expect(g.exceeded).toBe(false);
  });

  it("trips when recorded CLI-reported spend reaches the limit", () => {
    const g = new BudgetGuard(1);
    g.record(0.4);
    expect(g.exceeded).toBe(false);
    g.record(0.6);
    expect(g.exceeded).toBe(true);
    expect(g.totalUsd).toBeCloseTo(1, 10);
  });

  it.each([undefined, NaN, -1, 0])("ignores a non-cost value (%s)", (bad) => {
    const g = new BudgetGuard(1);
    g.record(bad);
    expect(g.totalUsd).toBe(0);
  });
});

describe("turnCapReached", () => {
  it.each([
    [0, 20, false],
    [19, 20, false],
    [20, 20, true],
    [21, 20, true],
  ])("%i assistant events, cap %i -> %s", (events, cap, expected) => {
    expect(turnCapReached(events, cap)).toBe(expected);
  });
});
