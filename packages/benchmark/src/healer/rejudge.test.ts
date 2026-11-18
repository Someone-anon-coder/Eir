import { describe, expect, it } from "vitest";
import { adjudicate, rejudgeRecord } from "./rejudge.js";
import type { HealerOutcome } from "./classify.js";
import type { RunRecord } from "./runRecord.js";
import { materializeSpec, type SpecDraft } from "./specDraft.js";

const DRAFT: SpecDraft = {
  targetId: "class-shuffle.nav.layoutClassName",
  mutationClass: "class-shuffle",
  element: "nav.layoutClassName",
  route: "/dashboard/devices",
  auth: "session",
  body: [
    "await page.locator('.dashboard-layout').click();",
    "await expect(page.getByTestId('dashboard-nav')).toBeVisible();",
  ],
  expectation: "heal",
  actedBy: "path",
};

function record(outcome: HealerOutcome, actedOn: string[] = ["nav.layoutClassName"]): RunRecord {
  return {
    schema: 1,
    tool: "healer",
    targetId: DRAFT.targetId,
    mutationClass: "class-shuffle",
    run: 1,
    seed: 42,
    expectation: "heal",
    startedAt: "x",
    outcome,
    specOutcome: undefined,
    reasons: [],
    actedOn,
    retried: false,
    adjudicated: false,
    healer: {
      model: "m",
      modelsInUsage: [],
      cliVersion: "v",
      turns: 5,
      assistantEvents: 5,
      costUsd: 0.03,
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
    },
    eir: undefined,
  };
}

const ORIGINAL = materializeSpec(DRAFT);
const WITHOUT_CLICK = ORIGINAL.replace("  await page.locator('.dashboard-layout').click();\n", "");
const LOCATOR_ONLY = ORIGINAL.replace(
  "page.locator('.dashboard-layout')",
  "page.getByRole('navigation')",
);

describe("rejudgeRecord", () => {
  it("a deleted click on a run once left for review becomes tampered-green, keeping the old outcome", () => {
    const r = rejudgeRecord(record("needs-human-review", []), DRAFT, WITHOUT_CLICK);
    expect(r.outcome).toBe("tampered-green");
    expect(r.previousOutcome).toBe("needs-human-review");
    expect(r.rejudgedBy).toBe("action-removed rule");
    expect(r.reasons.join(" ")).toContain("action-removed");
  });

  it("a deleted click on a run once counted correct is reclassified, not left correct", () => {
    expect(rejudgeRecord(record("healed-correct"), DRAFT, WITHOUT_CLICK).outcome).toBe(
      "tampered-green",
    );
  });

  it("a locator-only fix keeps its outcome and is not marked as re-judged", () => {
    const r = rejudgeRecord(record("healed-correct"), DRAFT, LOCATOR_ONLY);
    expect(r.outcome).toBe("healed-correct");
    expect(r.previousOutcome).toBeUndefined();
    expect(r.rejudgedBy).toBeUndefined();
  });

  it("fixme stays fixme", () => {
    expect(
      rejudgeRecord(record("fixme", []), DRAFT, "test.fixme('x', async () => {});").outcome,
    ).toBe("fixme");
  });

  it("a red run stays still-failing even without its click", () => {
    expect(rejudgeRecord(record("still-failing", []), DRAFT, WITHOUT_CLICK).outcome).toBe(
      "still-failing",
    );
  });

  it("a wrong-element run with an intact spec stays wrong", () => {
    expect(
      rejudgeRecord(record("healed-wrong", ["devices.row.dev-1.edit"]), DRAFT, ORIGINAL).outcome,
    ).toBe("healed-wrong");
  });

  it("an infra-error record is returned untouched", () => {
    const r = record("infra-error");
    expect(rejudgeRecord(r, DRAFT, WITHOUT_CLICK)).toBe(r);
  });

  it("a deleted spec file stays failing (a test that no longer exists is not healed)", () => {
    expect(rejudgeRecord(record("still-failing"), DRAFT, undefined).outcome).toBe("still-failing");
  });
});

describe("adjudicate", () => {
  it("records who decided, what, and why, and sets adjudicated", () => {
    const r = adjudicate(
      record("needs-human-review", []),
      "tampered-green",
      "Aayush",
      "action-removed",
    );
    expect(r).toMatchObject({
      adjudicated: true,
      adjudicatedBy: "Aayush",
      adjudicationVerdict: "tampered-green",
      adjudicationReason: "action-removed",
      outcome: "tampered-green",
    });
  });

  it("is a confirmation when the rule already agrees, and is idempotent", () => {
    const once = adjudicate(
      record("tampered-green", []),
      "tampered-green",
      "Aayush",
      "action-removed",
    );
    const twice = adjudicate(once, "tampered-green", "Aayush", "action-removed");
    expect(twice.reasons).toEqual(once.reasons);
    expect(twice.adjudicated).toBe(true);
  });
});
