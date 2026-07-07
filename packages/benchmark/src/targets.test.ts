import { describe, expect, it } from "vitest";
import { MUTATION_CLASSES } from "./mutationClasses.js";
import { ALL_MUTATION_TARGETS, BASE_MUTATION_TARGETS, nearDuplicatePairs, targetsForClass } from "./targets.js";

const NON_COMPOUND_CLASSES = MUTATION_CLASSES.filter((c) => c !== "compound-release");

describe("target registry integrity", () => {
  it.each(NON_COMPOUND_CLASSES)("%s has at least 8 registered targets", (mutationClass) => {
    expect(targetsForClass(mutationClass).length).toBeGreaterThanOrEqual(8);
  });

  it("every target id is unique", () => {
    const ids = ALL_MUTATION_TARGETS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("compound-release draws only from the six base classes, never near-dup", () => {
    const compoundPool = targetsForClass("compound-release");
    expect(compoundPool).toBe(BASE_MUTATION_TARGETS);
    for (const target of compoundPool) {
      expect(target.mutationClass).not.toBe("near-duplicate-sibling-swap");
      expect(target.mutationClass).not.toBe("compound-release");
    }
  });

  it("BASE_MUTATION_TARGETS excludes near-duplicate-sibling-swap targets", () => {
    for (const target of BASE_MUTATION_TARGETS) {
      expect(target.mutationClass).not.toBe("near-duplicate-sibling-swap");
    }
  });

  it("every near-duplicate-sibling-swap target has a distractor, and the pairing is symmetric", () => {
    const nearDupTargets = targetsForClass("near-duplicate-sibling-swap");
    expect(nearDupTargets.length).toBeGreaterThanOrEqual(8);
    for (const target of nearDupTargets) {
      expect(target.distractorId).toBeDefined();
      const distractor = nearDupTargets.find((t) => t.id === target.distractorId);
      expect(distractor).toBeDefined();
      expect(distractor?.distractorId).toBe(target.id);
    }
  });

  it("no non-near-dup target declares a distractor", () => {
    for (const target of BASE_MUTATION_TARGETS) {
      expect(target.distractorId).toBeUndefined();
    }
  });

  it("nearDuplicatePairs flattens to exactly the near-dup target set", () => {
    const fromPairs = nearDuplicatePairs.flatMap(([a, b]) => [a.id, b.id]).sort();
    const fromRegistry = targetsForClass("near-duplicate-sibling-swap")
      .map((t) => t.id)
      .sort();
    expect(fromPairs).toEqual(fromRegistry);
  });

  it("every target's payload contributes at least one override key", () => {
    for (const target of ALL_MUTATION_TARGETS) {
      const { attrs, text, tags, wrap, order } = target.payload;
      const keyCount =
        Object.keys(attrs ?? {}).length +
        Object.keys(text ?? {}).length +
        Object.keys(tags ?? {}).length +
        (wrap ?? []).length +
        Object.keys(order ?? {}).length;
      expect(keyCount).toBeGreaterThan(0);
    }
  });
});
