import { describe, expect, it } from "vitest";
import type { HealerOutcome } from "./classify.js";
import { buildReport, renderMarkdown, type ReportMeta } from "./report.js";
import type { Tool } from "./resume.js";
import type { RunRecord } from "./runRecord.js";

const META: ReportMeta = {
  generatedAt: "2026-11-18T00:00:00.000Z",
  playwrightVersion: "1.65.1",
  claudeCodeVersions: ["2.1.318"],
  modelIds: ["claude-sonnet-5-5"],
  healerAgentSha256: "abc123",
  seed: 42,
  healerRunsPerTarget: 3,
  mutationIneffective: { "id-rename": [] },
  effectiveTargets: { "id-rename": 2 },
};

function rec(
  tool: Tool,
  targetId: string,
  run: number,
  outcome: HealerOutcome,
  cls = "id-rename",
): RunRecord {
  return {
    schema: 1,
    tool,
    targetId,
    mutationClass: cls,
    run,
    seed: 42,
    expectation: "heal",
    startedAt: "x",
    outcome,
    specOutcome: undefined,
    reasons: [],
    actedOn: [],
    retried: false,
    adjudicated: false,
    healer:
      tool === "healer"
        ? {
            model: "claude-sonnet-5-5",
            modelsInUsage: [],
            cliVersion: "2.1.318",
            turns: 5,
            assistantEvents: 5,
            costUsd: 0.02,
            wallMs: 20_000,
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
            finalLocators: ["x"],
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

const RECORDS = [
  rec("healer", "t1", 1, "healed-correct"),
  rec("healer", "t1", 2, "healed-correct"),
  rec("healer", "t1", 3, "tampered-green"),
  rec("healer", "t2", 1, "still-failing"),
  rec("eir", "t1", 1, "healed-correct"),
  rec("eir", "t2", 1, "still-failing"),
  // The same target id in the compound-release run is a different measurement.
  rec("healer", "compound-release/t1", 1, "healed-wrong", "compound-release"),
  rec("eir", "compound-release/t1", 1, "still-failing", "compound-release"),
];

describe("buildReport", () => {
  const report = buildReport(RECORDS, META);

  it("keeps a class's rows separate from compound-release rows for the same target id", () => {
    const idRename = report.perClass.find(
      (a) => a.tool === "healer" && a.mutationClass === "id-rename",
    );
    const compound = report.perClass.find(
      (a) => a.tool === "healer" && a.mutationClass === "compound-release",
    );
    expect(idRename?.runs).toBe(4);
    expect(compound?.runs).toBe(1);
    expect(compound?.counts["healed-wrong"]).toBe(1);
  });

  it("has an overall row per tool covering every class", () => {
    expect(report.overall.map((o) => o.tool).sort()).toEqual(["eir", "healer"]);
    expect(report.overall.find((o) => o.tool === "healer")?.runs).toBe(5);
  });

  it("carries every run record through unchanged", () => {
    expect(report.runs).toHaveLength(RECORDS.length);
  });
});

describe("renderMarkdown", () => {
  const md = renderMarkdown(buildReport(RECORDS, META));

  it("puts the versions, model, agent hash, seed and runs per target in the header", () => {
    for (const needle of [
      "1.65.1",
      "2.1.318",
      "claude-sonnet-5-5",
      "abc123",
      "| Seed | 42 |",
      "3 (Eir: 1",
    ]) {
      expect(md).toContain(needle);
    }
  });

  it("shows a count beside every percentage", () => {
    expect(md).toContain("50.0% (2)");
    expect(md).not.toMatch(/\d%(?! \()/);
  });

  it("says when nothing was re-judged", () => {
    expect(md).toContain("No run was re-judged or adjudicated.");
  });

  it("lists re-judged and adjudicated runs with the first judge's outcome", () => {
    const adjudicated = {
      ...rec("healer", "t9", 1, "tampered-green", "class-shuffle"),
      previousOutcome: "needs-human-review" as const,
      rejudgedBy: "action-removed rule",
      adjudicated: true,
      adjudicatedBy: "Aayush",
      adjudicationVerdict: "tampered-green" as const,
      adjudicationReason: "action-removed",
    };
    const text = renderMarkdown(buildReport([adjudicated], META));
    expect(text).toContain(
      "| class-shuffle | t9 | 1 | needs-human-review | tampered-green | action-removed rule | yes, by Aayush (tampered-green: action-removed) |",
    );
  });

  it("labels cost as CLI-reported", () => {
    expect(md).toContain("CLI-reported");
  });

  it("includes the complementarity matrix", () => {
    expect(md).toContain("Complementarity matrix");
  });
});

describe("strict reading of class-shuffle", () => {
  const T = "class-shuffle.devices.pageClassName";
  const CS = (tool: Tool, run: number, outcome: HealerOutcome = "healed-correct"): RunRecord =>
    rec(tool, T, run, outcome, "class-shuffle");
  const records = [CS("healer", 1), CS("healer", 2), CS("healer", 3), CS("eir", 1)];
  const strictRows = [
    {
      tool: "healer" as const,
      runClass: "class-shuffle",
      targetId: T,
      run: 1,
      resolved: "devices.pageClassName",
      resolvedIsTarget: true,
    },
    {
      tool: "healer" as const,
      runClass: "class-shuffle",
      targetId: T,
      run: 2,
      resolved: "unmarked MAIN",
      resolvedIsTarget: false,
    },
    {
      tool: "healer" as const,
      runClass: "class-shuffle",
      targetId: T,
      run: 3,
      resolved: "unmarked MAIN",
      resolvedIsTarget: false,
    },
    {
      tool: "eir" as const,
      runClass: "class-shuffle",
      targetId: T,
      run: 1,
      resolved: "devices.pageClassName",
      resolvedIsTarget: true,
    },
  ];
  const report = buildReport(records, META, strictRows);
  const healer = report.perClass.find(
    (a) => a.tool === "healer" && a.mutationClass === "class-shuffle",
  );

  it("counts strict as the primary healed-correct and keeps the path-only credit separate", () => {
    expect(healer?.counts["healed-correct"]).toBe(1);
    expect(healer?.counts["correct-path-only"]).toBe(2);
    expect(healer?.runs).toBe(3);
  });

  it("applies the same rule to Eir", () => {
    const eir = report.perClass.find(
      (a) => a.tool === "eir" && a.mutationClass === "class-shuffle",
    );
    expect(eir?.counts["healed-correct"]).toBe(1);
    expect(eir?.counts["correct-path-only"]).toBe(0);
  });

  it("reports lenient beside strict, for the class and overall", () => {
    const row = report.strictRule.lenientVsStrict.find(
      (a) => a.tool === "healer" && a.mutationClass === "class-shuffle",
    );
    expect(row).toMatchObject({ strictCorrect: 1, lenientCorrect: 3, runs: 3 });
    const all = report.strictRule.lenientVsStrict.find(
      (a) => a.tool === "healer" && a.mutationClass === "all",
    );
    expect(all).toMatchObject({ strictCorrect: 1, lenientCorrect: 3 });
  });

  it("leaves the per-run records exactly as the judge wrote them", () => {
    expect(report.runs.map((r) => r.outcome)).toEqual([
      "healed-correct",
      "healed-correct",
      "healed-correct",
      "healed-correct",
    ]);
  });

  it("the complementarity matrix uses the strict label (per-target majority)", () => {
    // 2 of the 3 healer runs are path-only, so the strict majority for this target is path-only.
    expect(report.matrix).toContainEqual({
      eir: "healed-correct",
      healer: "correct-path-only",
      targets: [T],
    });
  });

  it("renders strict first and lenient beside it, and lists the path-only runs with what Playwright resolved", () => {
    const md = renderMarkdown(report);
    expect(md).toContain("healed-correct (strict, primary)");
    expect(md).toContain("healed-correct (lenient)");
    expect(md).toContain("| class-shuffle | healer | 3 | 33.3% (1) | 100.0% (3) | 66.7% (2) |");
    expect(md).toContain("| healer | class-shuffle.devices.pageClassName | 2 | unmarked MAIN |");
  });

  it("a path-credited run without trace evidence is an error, not a silent lenient count", () => {
    expect(() => buildReport(records, META, strictRows.slice(1))).toThrow(/No trace evidence/);
  });
});
