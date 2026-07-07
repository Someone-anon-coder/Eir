import { MUTATION_CLASSES } from "./mutationClasses.js";
import type { MutationClass } from "./mutationClasses.js";
import { assertNeverOutcome } from "./outcome.js";
import type { BenchRunResult, TargetOutcome } from "./runner.js";

/**
 * Generic grouping — the report aggregator groups outcomes by mutation
 * class, but the same function works for anything keyed by a string (the
 * fingerprint store could group by route the same way). One function,
 * `<T, K extends string>`, no `any`.
 */
export function groupBy<T, K extends string>(items: readonly T[], key: (item: T) => K): Record<K, T[]> {
  const result = {} as Record<K, T[]>;
  for (const item of items) {
    const groupKey = key(item);
    const group = result[groupKey];
    if (group === undefined) {
      result[groupKey] = [item];
    } else {
      group.push(item);
    }
  }
  return result;
}

export interface ClassAggregate {
  readonly mutationClass: MutationClass;
  readonly totalAffected: number;
  readonly healedCorrect: number;
  readonly healedWrong: number;
  readonly suggested: number;
  readonly missed: number;
  /** Should always be 0 — a nonzero count is a target-registry defect (see outcome.ts), never folded into the rates below. */
  readonly mutationIneffective: number;
  readonly healRate: number;
  readonly falseHealRate: number;
  readonly suggestionRate: number;
  readonly missRate: number;
}

function aggregateOutcomes(
  mutationClass: MutationClass,
  outcomes: readonly TargetOutcome[],
): ClassAggregate {
  let healedCorrect = 0;
  let healedWrong = 0;
  let suggested = 0;
  let missed = 0;
  let mutationIneffective = 0;

  for (const outcome of outcomes) {
    if (outcome.probeOutcome.status === "mutation-ineffective") {
      mutationIneffective++;
      continue;
    }
    switch (outcome.probeOutcome.outcome.kind) {
      case "healed-correct":
        healedCorrect++;
        break;
      case "healed-wrong":
        healedWrong++;
        break;
      case "suggested":
        suggested++;
        break;
      case "missed":
        missed++;
        break;
      default:
        assertNeverOutcome(outcome.probeOutcome.outcome);
    }
  }

  const totalAffected = outcomes.length;
  const denominator = totalAffected > 0 ? totalAffected : 1;

  return {
    mutationClass,
    totalAffected,
    healedCorrect,
    healedWrong,
    suggested,
    missed,
    mutationIneffective,
    healRate: healedCorrect / denominator,
    falseHealRate: healedWrong / denominator,
    suggestionRate: suggested / denominator,
    missRate: missed / denominator,
  };
}

export function aggregateRuns(runs: readonly BenchRunResult[]): readonly ClassAggregate[] {
  const allOutcomes = runs.flatMap((run) => run.outcomes);
  const grouped = groupBy(allOutcomes, (outcome) => outcome.mutationClass);
  return MUTATION_CLASSES.filter((mutationClass) => grouped[mutationClass] !== undefined).map(
    (mutationClass) => {
      const outcomes = grouped[mutationClass];
      if (outcomes === undefined) {
        throw new Error(`Unreachable: filtered for presence of ${mutationClass}`);
      }
      return aggregateOutcomes(mutationClass, outcomes);
    },
  );
}

export interface BaselineReport {
  readonly generatedAt: string;
  readonly aggregates: readonly ClassAggregate[];
}

export function buildBaselineReport(runs: readonly BenchRunResult[]): BaselineReport {
  return { generatedAt: new Date().toISOString(), aggregates: aggregateRuns(runs) };
}

function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

export function renderMarkdownTable(aggregates: readonly ClassAggregate[]): string {
  const header =
    "| Mutation Class | Affected | Heal Rate | False-Heal Rate | Suggestion Rate | Miss Rate |\n" +
    "|---|---:|---:|---:|---:|---:|";
  const rows = aggregates.map(
    (aggregate) =>
      `| ${aggregate.mutationClass} | ${aggregate.totalAffected} | ${formatPercent(aggregate.healRate)} | ` +
      `${formatPercent(aggregate.falseHealRate)} | ${formatPercent(aggregate.suggestionRate)} | ` +
      `${formatPercent(aggregate.missRate)} |`,
  );
  return [header, ...rows].join("\n");
}
