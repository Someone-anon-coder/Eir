import { describe, expect, it } from "vitest";
import { MUTATION_CLASSES } from "./mutationClasses.js";
import { buildMutationRun, mergePayloads } from "./groundTruth.js";

describe("buildMutationRun determinism", () => {
  it.each(MUTATION_CLASSES)("%s: same (class, seed) twice is byte-identical JSON", (mutationClass) => {
    const a = buildMutationRun(mutationClass, 42);
    const b = buildMutationRun(mutationClass, 42);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it.each(MUTATION_CLASSES)("%s: seed is part of the output", (mutationClass) => {
    const run = buildMutationRun(mutationClass, 7);
    expect(run.seed).toBe(7);
    expect(run.mutationClass).toBe(mutationClass);
  });
});

describe("buildMutationRun: near-duplicate-sibling-swap", () => {
  it("exercises exactly one direction per pair, never both", () => {
    const run = buildMutationRun("near-duplicate-sibling-swap", 42);
    // 8 pairs registered (see targets.ts) -> exactly 8 live entries.
    expect(run.groundTruth.length).toBe(8);
  });

  it("every entry carries a distractor", () => {
    const run = buildMutationRun("near-duplicate-sibling-swap", 3);
    for (const entry of run.groundTruth) {
      expect(entry.distractorId).toBeDefined();
      expect(entry.distractorFrozenSelectorKey).toBeDefined();
      // The distractor's own selector must not be the one mutated this run.
      expect(entry.distractorId).not.toBe(entry.targetId);
    }
  });

  it("a different seed can choose a different direction for at least one pair", () => {
    const seeds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const targetIdSets = seeds.map(
      (seed) => new Set(buildMutationRun("near-duplicate-sibling-swap", seed).groundTruth.map((e) => e.targetId)),
    );
    const allIdentical = targetIdSets.every((set, i) => i === 0 || setsEqual(set, targetIdSets[0]!));
    expect(allIdentical).toBe(false);
  });
});

describe("buildMutationRun: compound-release", () => {
  it("mixes targets from exactly 3 of the six base classes", () => {
    const run = buildMutationRun("compound-release", 42);
    const classesUsed = new Set(run.groundTruth.map((e) => e.mutationClass));
    expect(classesUsed.size).toBe(3);
    for (const usedClass of classesUsed) {
      expect(usedClass).not.toBe("near-duplicate-sibling-swap");
      expect(usedClass).not.toBe("compound-release");
    }
  });

  it("no ground truth entry carries a distractor (compound never mixes near-dup)", () => {
    const run = buildMutationRun("compound-release", 5);
    for (const entry of run.groundTruth) {
      expect(entry.distractorId).toBeUndefined();
    }
  });
});

describe("buildMutationRun: the other five single classes", () => {
  const SINGLE_CLASSES = [
    "id-rename",
    "text-change",
    "tag-swap",
    "class-shuffle",
    "sibling-reorder",
    "wrapper-inject",
  ] as const;

  it.each(SINGLE_CLASSES)("%s is seed-invariant (every registered target runs every time)", (mutationClass) => {
    const a = buildMutationRun(mutationClass, 1);
    const b = buildMutationRun(mutationClass, 999999);
    expect(a.groundTruth.map((e) => e.targetId).sort()).toEqual(b.groundTruth.map((e) => e.targetId).sort());
    expect(a.groundTruth.length).toBeGreaterThanOrEqual(8);
  });
});

describe("mergePayloads", () => {
  it("merges attrs/text/tags/order across payloads and dedupes wrap", () => {
    const merged = mergePayloads([
      { attrs: { a: "1" }, wrap: ["w1"] },
      { text: { b: "2" }, wrap: ["w1", "w2"] },
      { tags: { c: "button" } },
      { order: { d: [1, 0] } },
    ]);
    expect(merged).toEqual({
      attrs: { a: "1" },
      text: { b: "2" },
      tags: { c: "button" },
      wrap: ["w1", "w2"],
      order: { d: [1, 0] },
    });
  });

  it("returns empty-but-present fields for an empty input", () => {
    expect(mergePayloads([])).toEqual({ attrs: {}, text: {}, tags: {}, wrap: [], order: {} });
  });
});

function setsEqual<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) return false;
  for (const item of a) if (!b.has(item)) return false;
  return true;
}
