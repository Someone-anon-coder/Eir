import { describe, expect, it } from "vitest";
import {
  aggregateToolClass,
  complementarityMatrix,
  costStats,
  eirRepeatIdentical,
  percentile,
  targetStabilities,
} from "./aggregate.js";
import type { HealerOutcome } from "./classify.js";
import type { RunRecord } from "./runRecord.js";
import type { Tool } from "./resume.js";

function rec(
  tool: Tool,
  targetId: string,
  run: number,
  outcome: HealerOutcome,
  extra: { cost?: number; wallMs?: number; locator?: string; cls?: string } = {},
): RunRecord {
  return {
    schema: 1,
    tool,
    targetId,
    mutationClass: extra.cls ?? "id-rename",
    run,
    seed: 42,
    expectation: "heal",
    startedAt: "2026-11-18T00:00:00.000Z",
    outcome,
    specOutcome: undefined,
    reasons: [],
    actedOn: [],
    retried: false,
    adjudicated: false,
    healer:
      tool === "healer"
        ? {
            model: "m",
            modelsInUsage: [],
            cliVersion: "v",
            turns: 5,
            assistantEvents: 5,
            costUsd: extra.cost,
            wallMs: extra.wallMs ?? 1000,
            durationMs: undefined,
            apiDurationMs: undefined,
            usage: undefined,
            stoppedBy: "completed",
            terminalReason: undefined,
            permissionDenials: 0,
            rateLimitStatuses: [],
            toolCalls: [],
            linesAdded: 1,
            linesRemoved: 1,
            finalLocators: extra.locator === undefined ? [] : [extra.locator],
            tamper: [],
            editedOutside: [],
            newComments: [],
            transcriptFile: undefined,
            finalSpecFile: undefined,
          }
        : undefined,
    eir: undefined,
  };
}

describe("percentile (nearest rank)", () => {
  it.each([
    [[], 50, undefined],
    [[5], 90, 5],
    [[1, 2, 3, 4], 50, 2],
    [[1, 2, 3, 4], 90, 4],
    [[10, 1, 5], 50, 5],
  ])("%j p%i -> %s", (values, p, expected) => {
    expect(percentile(values, p)).toBe(expected);
  });
});

describe("aggregateToolClass", () => {
  const records = [
    rec("healer", "t1", 1, "healed-correct"),
    rec("healer", "t1", 2, "healed-correct"),
    rec("healer", "t1", 3, "tampered-green"),
    rec("healer", "t2", 1, "still-failing"),
    rec("healer", "t2", 2, "infra-error"),
    rec("healer", "t2", 3, "healed-wrong"),
    rec("eir", "t1", 1, "healed-correct"),
    rec("healer", "x", 1, "fixme", { cls: "other" }),
  ];

  it("counts outcomes, excludes infra-error from the denominator and reports it separately", () => {
    const a = aggregateToolClass(records, "healer", "id-rename");
    expect(a.runs).toBe(5);
    expect(a.infraErrors).toBe(1);
    expect(a.counts["healed-correct"]).toBe(2);
    expect(a.counts["tampered-green"]).toBe(1);
    expect(a.counts["healed-wrong"]).toBe(1);
    expect(a.counts["still-failing"]).toBe(1);
    expect(a.targets).toBe(2);
  });

  it("rates are counts over the non-infra runs", () => {
    const a = aggregateToolClass(records, "healer", "id-rename");
    expect(a.rates["healed-correct"]).toBeCloseTo(2 / 5, 10);
    const total = Object.values(a.rates).reduce((x, y) => x + y, 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it("false greens are wrong heals plus tampering", () => {
    expect(aggregateToolClass(records, "healer", "id-rename").falseGreens).toBe(2);
  });

  it("Eir tampering is 0, not missing", () => {
    const a = aggregateToolClass(records, "eir", "id-rename");
    expect(a.counts["tampered-green"]).toBe(0);
    expect(a.counts["out-of-bounds"]).toBe(0);
    expect(a.counts["fixme"]).toBe(0);
  });

  it("an empty class has zero rates, not NaN", () => {
    const a = aggregateToolClass([], "healer", "id-rename");
    expect(a.runs).toBe(0);
    expect(a.rates["healed-correct"]).toBe(0);
  });
});

describe("costStats", () => {
  it("uses CLI-reported cost only and counts runs that printed none", () => {
    const s = costStats([
      rec("healer", "a", 1, "healed-correct", { cost: 0.02, wallMs: 10_000 }),
      rec("healer", "a", 2, "healed-correct", { cost: 0.04, wallMs: 20_000 }),
      rec("healer", "b", 1, "still-failing", { cost: 0.1, wallMs: 30_000 }),
      rec("healer", "b", 2, "still-failing", { wallMs: 40_000 }),
      rec("healer", "b", 3, "infra-error", { cost: 9 }),
    ]);
    expect(s.runsWithCost).toBe(3);
    expect(s.runsWithoutCost).toBe(1);
    expect(s.totalUsd).toBeCloseTo(0.16, 10);
    expect(s.medianUsd).toBe(0.04);
    expect(s.p90Usd).toBe(0.1);
    expect(s.totalWallMs).toBe(100_000);
  });
});

describe("targetStabilities and complementarityMatrix", () => {
  const records = [
    rec("healer", "t1", 1, "healed-correct", { locator: 'page.getByLabel("A")' }),
    rec("healer", "t1", 2, "healed-correct", { locator: "page.getByLabel('A')" }),
    rec("healer", "t1", 3, "healed-correct", { locator: 'page.getByRole("textbox")' }),
    rec("healer", "t2", 1, "tampered-green"),
    rec("healer", "t2", 2, "tampered-green"),
    rec("healer", "t2", 3, "still-failing"),
    rec("healer", "t3", 1, "healed-correct"),
    rec("healer", "t3", 2, "tampered-green"),
    rec("healer", "t3", 3, "still-failing"),
    rec("eir", "t1", 1, "healed-correct"),
    rec("eir", "t2", 1, "still-failing"),
    rec("eir", "t3", 1, "still-failing"),
  ];

  it("majority per target; a three-way split has no majority", () => {
    const m = new Map(targetStabilities(records).map((t) => [t.targetId, t.majority] as const));
    expect(m.get("t1")).toBe("healed-correct");
    expect(m.get("t2")).toBe("tampered-green");
    expect(m.get("t3")).toBe("no-majority");
  });

  it("same outcome but different locators is reported as unstable on locators only", () => {
    const t1 = targetStabilities(records).find((t) => t.targetId === "t1");
    expect(t1?.stability.outcomesMatch).toBe(true);
    expect(t1?.stability.locatorsMatch).toBe(false);
  });

  it("crosses Eir's result with the healer majority", () => {
    const cells = complementarityMatrix(records);
    expect(cells).toContainEqual({
      eir: "healed-correct",
      healer: "healed-correct",
      targets: ["t1"],
    });
    expect(cells).toContainEqual({
      eir: "still-failing",
      healer: "tampered-green",
      targets: ["t2"],
    });
    expect(cells).toContainEqual({ eir: "still-failing", healer: "no-majority", targets: ["t3"] });
  });

  it("a target with no Eir record is left out of the matrix, not guessed", () => {
    const onlyHealer = records.filter((r) => !(r.tool === "eir" && r.targetId === "t1"));
    expect(complementarityMatrix(onlyHealer).flatMap((c) => c.targets)).not.toContain("t1");
  });
});

describe("eirRepeatIdentical", () => {
  it("compares run 2 to run 1 per target", () => {
    const r = eirRepeatIdentical([
      rec("eir", "a", 1, "healed-correct"),
      rec("eir", "a", 2, "healed-correct"),
      rec("eir", "b", 1, "still-failing"),
      rec("eir", "b", 2, "healed-correct"),
      rec("eir", "c", 1, "still-failing"),
    ]);
    expect(r).toEqual({ compared: 2, identical: 1 });
  });
});
