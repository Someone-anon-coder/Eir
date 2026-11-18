import { describe, expect, it } from "vitest";
import type { HealerOutcome } from "./classify.js";
import type { Tool } from "./resume.js";
import type { RunRecord } from "./runRecord.js";
import { applyStrictRule, isPathAttributed, strictRowFrom, type StrictRow } from "./strict.js";
import type { TracedAction } from "./traceRead.js";

const CS = "class-shuffle.devices.pageClassName";

function rec(
  tool: Tool,
  targetId: string,
  outcome: HealerOutcome,
  cls = "class-shuffle",
  run = 1,
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

const row = (
  tool: Tool,
  resolvedIsTarget: boolean,
  targetId = CS,
  run = 1,
  runClass = "class-shuffle",
): StrictRow => ({
  tool,
  runClass,
  targetId,
  run,
  resolved: resolvedIsTarget ? "devices.pageClassName" : "unmarked MAIN",
  resolvedIsTarget,
});

describe("isPathAttributed", () => {
  it.each([
    [CS, true],
    ["class-shuffle.nav.layoutClassName", true],
    ["id-rename.account.openDeleteButton", false],
    ["sibling-reorder.devices.row.dev-2.actionsOrder", false],
    ["compound-release/id-rename.login.usernameInput", false],
  ])("%s -> %s", (id, expected) => {
    expect(isPathAttributed({ targetId: id })).toBe(expected);
  });
});

describe("applyStrictRule", () => {
  it("keeps a path-credited run that resolved the target container itself", () => {
    const [r] = applyStrictRule([rec("healer", CS, "healed-correct")], [row("healer", true)]);
    expect(r?.outcome).toBe("healed-correct");
  });

  it("relabels a run credited only by ancestor path, for the healer and for Eir alike", () => {
    const out = applyStrictRule(
      [rec("healer", CS, "healed-correct"), rec("eir", CS, "healed-correct")],
      [row("healer", false), row("eir", false)],
    );
    expect(out.map((r) => r.outcome)).toEqual(["correct-path-only", "correct-path-only"]);
  });

  it("applies per run: the same target can have both kinds", () => {
    const out = applyStrictRule(
      [
        rec("healer", CS, "healed-correct", "class-shuffle", 1),
        rec("healer", CS, "healed-correct", "class-shuffle", 2),
      ],
      [row("healer", true, CS, 1), row("healer", false, CS, 2)],
    );
    expect(out.map((r) => r.outcome)).toEqual(["healed-correct", "correct-path-only"]);
  });

  it("leaves every other outcome on a path-attributed target alone", () => {
    const outcomes: HealerOutcome[] = [
      "healed-wrong",
      "tampered-green",
      "fixme",
      "still-failing",
      "needs-human-review",
    ];
    const out = applyStrictRule(
      outcomes.map((o) => rec("healer", CS, o)),
      [],
    );
    expect(out.map((r) => r.outcome)).toEqual(outcomes);
  });

  it("never touches a target that is not path-attributed, and needs no evidence for it", () => {
    const r = rec("healer", "id-rename.account.openDeleteButton", "healed-correct", "id-rename");
    expect(applyStrictRule([r], [])[0]?.outcome).toBe("healed-correct");
  });

  it("a missing trace row is an error, never a silent fall-back to the lenient reading", () => {
    expect(() => applyStrictRule([rec("healer", CS, "healed-correct")], [])).toThrow(
      /No trace evidence/,
    );
  });

  it("does not match evidence from another tool, class or run", () => {
    const evidence = [
      row("eir", true),
      row("healer", true, CS, 2),
      row("healer", true, CS, 1, "compound-release"),
    ];
    expect(() => applyStrictRule([rec("healer", CS, "healed-correct")], evidence)).toThrow(
      /No trace evidence/,
    );
  });

  it("does not mutate the stored record", () => {
    const original = rec("healer", CS, "healed-correct");
    applyStrictRule([original], [row("healer", false)]);
    expect(original.outcome).toBe("healed-correct");
  });
});

describe("strictRowFrom", () => {
  const act = (ownMarker: string | undefined, tag = "DIV"): TracedAction => ({
    callId: "c",
    method: "click",
    tag,
    ownMarker,
    nearestMarker: ownMarker,
    markedAncestors: [],
  });

  it.each([
    [
      "first interaction decides for the healer",
      [act("devices.pageClassName"), act("x")],
      "first",
      true,
      "devices.pageClassName",
    ],
    [
      "last interaction decides for Eir (the retry)",
      [act("x"), act("devices.pageClassName")],
      "last",
      true,
      "devices.pageClassName",
    ],
    [
      "an unmarked element is reported by tag and is not the target",
      [act(undefined, "MAIN")],
      "first",
      false,
      "unmarked MAIN",
    ],
    ["no traced interaction is not the target", [], "first", false, "(no traced interaction)"],
  ] as const)("%s", (_n, traced, which, isTarget, resolved) => {
    expect(
      strictRowFrom("healer", "class-shuffle", CS, 1, traced, "devices.pageClassName", which),
    ).toMatchObject({ resolvedIsTarget: isTarget, resolved });
  });
});
