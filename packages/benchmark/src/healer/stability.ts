import { normalizeText } from "./specFacts.js";

export interface StabilityInput {
  readonly outcome: string;
  /** The target step's final locator expression(s); `undefined` when none could be read. */
  readonly finalLocator: string | undefined;
}

export interface Stability {
  readonly runs: number;
  readonly outcomesMatch: boolean;
  readonly locatorsMatch: boolean;
  readonly distinctOutcomes: readonly string[];
  readonly distinctLocators: readonly string[];
}

export function normalizeLocator(locator: string): string {
  return normalizeText(locator)
    .replace(/\s*\.\s*/g, ".")
    .replace(/\s*,\s*/g, ", ");
}

/** Do repeated runs of one target agree on what happened, and on how they fixed it? */
export function computeStability(runs: readonly StabilityInput[]): Stability {
  const distinctOutcomes = [...new Set(runs.map((r) => r.outcome))].sort();
  const distinctLocators = [
    ...new Set(
      runs.map((r) => (r.finalLocator === undefined ? "(none)" : normalizeLocator(r.finalLocator))),
    ),
  ].sort();
  return {
    runs: runs.length,
    outcomesMatch: distinctOutcomes.length <= 1,
    locatorsMatch: distinctLocators.length <= 1,
    distinctOutcomes,
    distinctLocators,
  };
}

/** The most common outcome; a tie has no majority, reported as such rather than resolved by order. */
export function majorityOutcome(outcomes: readonly string[]): string {
  const counts = new Map<string, number>();
  for (const o of outcomes) counts.set(o, (counts.get(o) ?? 0) + 1);
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const first = ranked[0];
  if (first === undefined) return "no-runs";
  const second = ranked[1];
  return second !== undefined && second[1] === first[1] ? "no-majority" : first[0];
}
