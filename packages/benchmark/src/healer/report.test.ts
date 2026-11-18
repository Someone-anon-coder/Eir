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
