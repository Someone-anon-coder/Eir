import { describe, expect, it } from "vitest";
import {
  FLOW_CHANGE_TARGETS,
  REAL_REGRESSION_TARGETS,
  NEW_KIND_CLASSES,
  buildNewKindRun,
  isNewKindClass,
} from "./comparisonTargets.js";
import { MUTATION_CLASSES } from "../mutationClasses.js";
import { draftFor } from "./specDrafts.js";

describe("new mutation kinds", () => {
  it("are not part of the committed 8-class baseline list", () => {
    for (const kind of NEW_KIND_CLASSES) {
      expect((MUTATION_CLASSES as readonly string[]).includes(kind)).toBe(false);
    }
  });

  it.each([
    ["real-regression", 7, "regress"],
    ["flow-change", 5, "flow"],
  ] as const)("%s run has %i targets, all in the %s payload key only", (cls, count, key) => {
    const run = buildNewKindRun(cls, 42);
    expect(run.targets).toHaveLength(count);
    const payload = run.overridePayload;
    expect(payload[key]).toHaveLength(count);
    expect(payload.attrs).toEqual({});
    expect(payload.text).toEqual({});
    expect(payload.tags).toEqual({});
    expect(payload.wrap).toEqual([]);
    expect(payload.order).toEqual({});
  });

  it.each(NEW_KIND_CLASSES)("%s: same (class, seed) twice is byte-identical", (cls) => {
    expect(JSON.stringify(buildNewKindRun(cls, 42))).toBe(JSON.stringify(buildNewKindRun(cls, 42)));
  });

  it("the seed only reorders the pool (nothing is dropped)", () => {
    const ids = (seed: number) =>
      buildNewKindRun("real-regression", seed)
        .targets.map((t) => t.id)
        .sort();
    expect(ids(1)).toEqual(ids(2));
  });

  it("every target has a draft, and each payload key matches its target id", () => {
    for (const t of [...REAL_REGRESSION_TARGETS, ...FLOW_CHANGE_TARGETS]) {
      expect(draftFor(t.id)).toBeDefined();
      const key = (t.payload.regress ?? t.payload.flow ?? [])[0];
      expect(t.id.endsWith(`.${key}`) || t.id === `${t.mutationClass}.${key}`).toBe(true);
    }
  });

  it.each([
    ["real-regression", true],
    ["flow-change", true],
    ["id-rename", false],
    ["nonsense", false],
  ])("isNewKindClass(%s) = %s", (value, expected) => {
    expect(isNewKindClass(value)).toBe(expected);
  });
});
