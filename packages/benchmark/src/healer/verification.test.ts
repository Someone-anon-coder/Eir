import { describe, expect, it } from "vitest";
import type { HealerOutcome } from "./classify.js";
import type { Tool } from "./resume.js";
import type { RunRecord } from "./runRecord.js";
import { compareReruns, formatTally, summarizeFalseHeals } from "./verification.js";

function rec(
  tool: Tool,
  targetId: string,
  run: number,
  outcome: HealerOutcome,
  cls = "sibling-reorder",
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
    healer: undefined,
    eir: undefined,
  };
}

const ORIGINAL = [
  rec("healer", "t1", 1, "healed-wrong"),
  rec("healer", "t1", 2, "healed-correct"),
  rec("healer", "t1", 3, "healed-wrong"),
  rec("eir", "t1", 1, "still-failing"),
  rec("healer", "t2", 1, "healed-correct"),
  rec("healer", "t2", 2, "healed-correct"),
  rec("healer", "t2", 3, "healed-correct"),
  rec("eir", "t2", 1, "healed-correct"),
  // Same id in another class's run is a different measurement.
  rec("healer", "t1", 1, "healed-correct", "compound-release"),
];
const RERUN = [
  ...[1, 2, 3, 4, 5].map((n) => rec("healer", "t1", n, n <= 2 ? "healed-wrong" : "healed-correct")),
  rec("eir", "t1", 1, "still-failing"),
];
const ANCHORED = [
  ...[1, 2, 3, 4, 5].map((n) => rec("healer", "t1", n, "healed-correct")),
  rec("eir", "t1", 1, "still-failing"),
];

describe("compareReruns", () => {
  const [row] = compareReruns(ORIGINAL, RERUN, ANCHORED);

  it("compares only targets that were rerun, per class", () => {
    expect(compareReruns(ORIGINAL, RERUN, ANCHORED)).toHaveLength(1);
    expect(row?.targetId).toBe("t1");
    expect(row?.originalRuns).toBe(3);
  });

  it("keeps original, rerun and anchored tallies side by side", () => {
    expect(row?.original).toEqual({ "healed-wrong": 2, "healed-correct": 1 });
    expect(row?.rerun).toEqual({ "healed-wrong": 2, "healed-correct": 3 });
    expect(row?.anchored).toEqual({ "healed-correct": 5 });
    expect(row?.rerunRuns).toBe(5);
    expect(row?.anchoredRuns).toBe(5);
  });

  it("flags whether Eir reproduced", () => {
    expect(row?.eirReproduces).toBe(true);
    const changed = compareReruns(
      ORIGINAL,
      [...RERUN.slice(0, 5), rec("eir", "t1", 1, "healed-correct")],
      [],
    );
    expect(changed[0]?.eirReproduces).toBe(false);
  });

  it("a target with no anchored runs has no anchored tally", () => {
    expect(compareReruns(ORIGINAL, RERUN, [])[0]?.anchored).toBeUndefined();
  });

  it("never reads the original dataset's other-class rows into a target", () => {
    expect(row?.original["healed-correct"]).toBe(1);
  });

  it("infra-error runs are excluded from every tally", () => {
    const withInfra = [...RERUN, rec("healer", "t1", 6, "infra-error")];
    expect(compareReruns(ORIGINAL, withInfra, [])[0]?.rerunRuns).toBe(5);
  });
});

describe("summarizeFalseHeals", () => {
  it("reports original and verified figures separately, never merged", () => {
    const s = summarizeFalseHeals(compareReruns(ORIGINAL, RERUN, ANCHORED));
    expect(s).toEqual({
      originalWrong: 2,
      originalRuns: 3,
      rerunWrong: 2,
      rerunRuns: 5,
      anchoredWrong: 0,
      anchoredRuns: 5,
      onWrongTargets: {
        targets: 1,
        originalWrong: 2,
        originalRuns: 3,
        rerunWrong: 2,
        rerunRuns: 5,
      },
    });
  });
});

describe("summarizeFalseHeals: restriction to targets that had a false heal", () => {
  it("leaves out targets with no original false heal, so they cannot dilute the rate", () => {
    const original = [
      rec("healer", "bad", 1, "healed-wrong"),
      rec("healer", "bad", 2, "healed-correct"),
      rec("healer", "fine", 1, "healed-correct"),
      rec("healer", "fine", 2, "healed-correct"),
    ];
    const rerun = [
      rec("healer", "bad", 1, "healed-wrong"),
      rec("healer", "fine", 1, "healed-correct"),
    ];
    const s = summarizeFalseHeals(compareReruns(original, rerun, []));
    expect(s.originalRuns).toBe(4);
    expect(s.onWrongTargets).toEqual({
      targets: 1,
      originalWrong: 1,
      originalRuns: 2,
      rerunWrong: 1,
      rerunRuns: 1,
    });
  });
});

describe("formatTally", () => {
  it.each([
    [{ "healed-wrong": 2, "healed-correct": 1 }, "2 healed-wrong, 1 healed-correct"],
    [{}, "none"],
    [undefined, "n/a"],
  ])("%j", (t, expected) => {
    expect(formatTally(t)).toBe(expected);
  });
});
