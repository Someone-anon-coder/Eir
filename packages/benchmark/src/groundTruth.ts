import { createPrng } from "./prng.js";
import { BASE_MUTATION_TARGETS, nearDuplicatePairs, targetById, targetsForClass } from "./targets.js";
import type { MutationTarget, OverridePayload } from "./targets.js";
import type { MutationClass } from "./mutationClasses.js";

export interface GroundTruthEntry {
  readonly targetId: string;
  readonly mutationClass: MutationClass;
  readonly route: string;
  readonly frozenSelectorKey: string;
  readonly distractorId?: string;
  readonly distractorFrozenSelectorKey?: string;
}

export interface MutationRun {
  readonly mutationClass: MutationClass;
  readonly seed: number;
  readonly overridePayload: OverridePayload;
  readonly groundTruth: readonly GroundTruthEntry[];
}

/**
 * Merges each live target's override fragment into one payload — the exact
 * JSON that becomes `VITE_EIR_MUTATIONS`. Pure and order-sensitive only in
 * the sense that later entries win on key collision (none occur across
 * today's registry; every override key is independently owned by exactly
 * one target), so the result is a deterministic function of `payloads`.
 */
export function mergePayloads(payloads: readonly OverridePayload[]): OverridePayload {
  const attrs: Record<string, string> = {};
  const text: Record<string, string> = {};
  const tags: Record<string, "button" | "a"> = {};
  const wrapSet = new Set<string>();
  const order: Record<string, readonly number[]> = {};

  for (const payload of payloads) {
    if (payload.attrs !== undefined) Object.assign(attrs, payload.attrs);
    if (payload.text !== undefined) Object.assign(text, payload.text);
    if (payload.tags !== undefined) Object.assign(tags, payload.tags);
    if (payload.wrap !== undefined) for (const key of payload.wrap) wrapSet.add(key);
    if (payload.order !== undefined) Object.assign(order, payload.order);
  }

  return { attrs, text, tags, wrap: [...wrapSet], order };
}

function groundTruthEntryFor(target: MutationTarget): GroundTruthEntry {
  const distractor = target.distractorId !== undefined ? targetById(target.distractorId) : undefined;
  return {
    targetId: target.id,
    mutationClass: target.mutationClass,
    route: target.route,
    frozenSelectorKey: target.frozenSelectorKey,
    ...(distractor !== undefined
      ? { distractorId: distractor.id, distractorFrozenSelectorKey: distractor.frozenSelectorKey }
      : {}),
  };
}

const COMPOUND_SOURCE_CLASSES: readonly MutationClass[] = [
  "id-rename",
  "text-change",
  "tag-swap",
  "class-shuffle",
  "sibling-reorder",
  "wrapper-inject",
];

/** How many of the six base classes `compound-release` mixes into one run. */
const COMPOUND_CLASS_COUNT = 3;

function selectLiveTargets(mutationClass: MutationClass, seed: number): readonly MutationTarget[] {
  const prng = createPrng(seed);

  if (mutationClass === "near-duplicate-sibling-swap") {
    // Exactly one direction per pair — mutating both would destroy the
    // live, valid distractor the pair exists to demonstrate.
    return nearDuplicatePairs.map(([a, b]) => (prng.nextInt(2) === 0 ? a : b));
  }

  if (mutationClass === "compound-release") {
    const chosenClasses = prng.shuffle(COMPOUND_SOURCE_CLASSES).slice(0, COMPOUND_CLASS_COUNT);
    return chosenClasses.flatMap((sourceClass) => targetsForClass(sourceClass));
  }

  // The other six classes are deterministic by construction: every
  // registered target for the class is live, every run, seed-invariant.
  // `BASE_MUTATION_TARGETS` filtering happens inside `targetsForClass`.
  return targetsForClass(mutationClass);
}

export function buildMutationRun(mutationClass: MutationClass, seed: number): MutationRun {
  const liveTargets = selectLiveTargets(mutationClass, seed);
  const overridePayload = mergePayloads(liveTargets.map((target) => target.payload));
  const groundTruth = liveTargets.map(groundTruthEntryFor);
  return { mutationClass, seed, overridePayload, groundTruth };
}

export { BASE_MUTATION_TARGETS };
