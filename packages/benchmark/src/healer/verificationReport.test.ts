import { describe, expect, it } from "vitest";
import type { HealerOutcome } from "./classify.js";
import type { ReportMeta } from "./report.js";
import type { Tool } from "./resume.js";
import type { RunRecord } from "./runRecord.js";
import {
  buildVerificationReport,
  renderFixmeAppendix,
  renderVerificationMarkdown,
  type VerificationInput,
} from "./verificationReport.js";

const META: ReportMeta = {
  generatedAt: "2026-11-18T00:00:00.000Z",
  playwrightVersion: "1.65.1",
  claudeCodeVersions: ["2.1.318"],
  modelIds: ["claude-sonnet-5-5"],
  healerAgentSha256: "abc123",
  seed: 42,
  healerRunsPerTarget: 5,
  mutationIneffective: {},
  effectiveTargets: {},
};

function rec(tool: Tool, id: string, run: number, outcome: HealerOutcome, cost = 0.03): RunRecord {
  return {
    schema: 1,
    tool,
    targetId: id,
    mutationClass: "sibling-reorder",
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
            model: "m",
            modelsInUsage: [],
            cliVersion: "v",
            turns: 1,
            assistantEvents: 1,
            costUsd: cost,
            wallMs: 1,
            durationMs: undefined,
            apiDurationMs: undefined,
            usage: undefined,
            stoppedBy: "completed",
            terminalReason: undefined,
            permissionDenials: 0,
            rateLimitStatuses: [],
            toolCalls: [],
            linesAdded: 0,
            linesRemoved: 0,
            finalLocators: [],
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

const INPUT: VerificationInput = {
  meta: META,
  original: [
    rec("healer", "t1", 1, "healed-wrong"),
    rec("healer", "t1", 2, "healed-correct"),
    rec("healer", "t1", 3, "healed-correct"),
    rec("eir", "t1", 1, "still-failing"),
  ],
  rerun: [1, 2, 3, 4, 5]
    .map((n) => rec("healer", "t1", n, n === 1 ? "healed-wrong" : "healed-correct"))
    .concat([rec("eir", "t1", 1, "still-failing")]),
  anchored: [],
  traceFalseHeals: [],
  traceControl: [],
  classShuffleStrict: {
    replayed: 19,
    resolvedIsTarget: 6,
    resolvedIsOther: 13,
    others: [{ targetId: "class-shuffle.x", run: 1, resolved: "unmarked MAIN" }],
  },
  audit: [],
  fixme: [
    {
      runClass: "real-regression",
      targetId: "real-regression.account.confirmDoesNothing",
      run: 1,
      commentLines: [
        '// FIXME: App regression. Clicking "Confirm Delete" does nothing',
        "test.fixme();",
      ],
      injectedBug: "the confirm click is swallowed.",
      injectedBugSource: "pages/AccountPage.tsx (comment)",
    },
  ],
  transcripts: [],
  experiment: undefined,
  versionCheck: { Playwright: "1.65.1 (same)" },
};

describe("buildVerificationReport", () => {
  const report = buildVerificationReport(INPUT);
  it("keeps original and rerun false-heal figures separate", () => {
    expect(report.falseHeals).toMatchObject({
      originalWrong: 1,
      originalRuns: 3,
      rerunWrong: 1,
      rerunRuns: 5,
    });
  });
  it("sums CLI-reported spend per dataset, not across them", () => {
    expect(report.spendUsd.rerun).toBeCloseTo(0.15, 10);
    expect(report.spendUsd.anchored).toBe(0);
  });
});

describe("renderVerificationMarkdown", () => {
  const md = renderVerificationMarkdown(buildVerificationReport(INPUT));
  it("states that the original dataset is not replaced", () => {
    expect(md).toContain("nothing here replaces it");
  });
  it("shows original and rerun rates on separate terms", () => {
    expect(md).toContain("original 33.3% (1/3)");
    expect(md).toContain("rerun 20.0% (1/5)");
  });
  it("header carries versions, model, agent hash and the version check", () => {
    for (const needle of [
      "1.65.1",
      "2.1.318",
      "claude-sonnet-5-5",
      "abc123",
      "Version check: Playwright",
    ])
      expect(md).toContain(needle);
  });
  it("reports the class-shuffle strict reading beside the original, as counts", () => {
    expect(md).toContain(
      "**6** resolved the target container itself and **13** resolved a different element",
    );
  });
  it("includes the fixme appendix", () => {
    expect(md).toContain("## Appendix: all `fixme` comments");
  });
});

describe("renderFixmeAppendix", () => {
  const lines = renderFixmeAppendix(INPUT.fixme).join("\n");
  it("quotes comments verbatim, beside the injected bug and its source", () => {
    expect(lines).toContain('`// FIXME: App regression. Clicking "Confirm Delete" does nothing`');
    expect(lines).toContain("the confirm click is swallowed. (pages/AccountPage.tsx (comment))");
  });
  it("does not judge whether a comment names the cause", () => {
    expect(lines).toContain("No judgement is made here");
    expect(lines).not.toMatch(/names the (real )?cause: (yes|no)/i);
  });
});
