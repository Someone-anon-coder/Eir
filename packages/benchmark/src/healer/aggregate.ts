import { FALSE_GREEN_OUTCOMES, HEALER_OUTCOMES, type HealerOutcome } from "./classify.js";
import type { Tool } from "./resume.js";
import type { RunRecord } from "./runRecord.js";
import { computeStability, majorityOutcome, type Stability } from "./stability.js";

/** infra-error runs are excluded from every rate and reported as a count. */
export type OutcomeCounts = Readonly<Record<HealerOutcome, number>>;

export interface ToolClassAggregate {
  readonly tool: Tool;
  readonly mutationClass: string;
  readonly targets: number;
  /** Runs counted in the denominator (infra-error excluded). */
  readonly runs: number;
  readonly infraErrors: number;
  readonly counts: OutcomeCounts;
  /** counts / runs, as fractions; 0 when there are no runs. */
  readonly rates: OutcomeCounts;
  /** `healed-wrong` + `tampered-green`: a green test that is wrong. */
  readonly falseGreens: number;
}

export interface CostStats {
  /** Runs whose CLI printed a cost. Killed or crashed runs print none and are not counted here. */
  readonly runsWithCost: number;
  readonly runsWithoutCost: number;
  readonly totalUsd: number;
  readonly medianUsd: number | undefined;
  readonly p90Usd: number | undefined;
  readonly totalWallMs: number;
  readonly medianWallMs: number | undefined;
  readonly p90WallMs: number | undefined;
}

export interface TargetStability {
  readonly targetId: string;
  readonly majority: string;
  readonly stability: Stability;
}

export interface MatrixCell {
  readonly eir: string;
  readonly healer: string;
  readonly targets: readonly string[];
}

function zeroCounts(): Record<HealerOutcome, number> {
  return Object.fromEntries(HEALER_OUTCOMES.map((o) => [o, 0])) as Record<HealerOutcome, number>;
}

/** Nearest-rank percentile; the sample is small, so no interpolation pretends to precision it lacks. */
export function percentile(values: readonly number[], p: number): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.max(1, Math.ceil((p / 100) * sorted.length));
  return sorted[rank - 1];
}

export function aggregateToolClass(
  records: readonly RunRecord[],
  tool: Tool,
  mutationClass: string,
): ToolClassAggregate {
  const mine = records.filter((r) => r.tool === tool && r.mutationClass === mutationClass);
  const counts = zeroCounts();
  let infraErrors = 0;
  for (const r of mine) {
    if (r.outcome === "infra-error") infraErrors++;
    else counts[r.outcome]++;
  }
  const runs = mine.length - infraErrors;
  const rates = zeroCounts();
  for (const o of HEALER_OUTCOMES) rates[o] = runs === 0 ? 0 : counts[o] / runs;
  return {
    tool,
    mutationClass,
    targets: new Set(mine.map((r) => r.targetId)).size,
    runs,
    infraErrors,
    counts,
    rates,
    falseGreens: FALSE_GREEN_OUTCOMES.reduce((sum, o) => sum + counts[o], 0),
  };
}

export function costStats(records: readonly RunRecord[]): CostStats {
  const healer = records.filter(
    (r) => r.tool === "healer" && r.healer !== undefined && r.outcome !== "infra-error",
  );
  const costs = healer.flatMap((r) => (r.healer?.costUsd === undefined ? [] : [r.healer.costUsd]));
  const walls = healer.flatMap((r) => (r.healer === undefined ? [] : [r.healer.wallMs]));
  return {
    runsWithCost: costs.length,
    runsWithoutCost: healer.length - costs.length,
    totalUsd: costs.reduce((a, b) => a + b, 0),
    medianUsd: percentile(costs, 50),
    p90Usd: percentile(costs, 90),
    totalWallMs: walls.reduce((a, b) => a + b, 0),
    medianWallMs: percentile(walls, 50),
    p90WallMs: percentile(walls, 90),
  };
}

function healerRunsFor(records: readonly RunRecord[], targetId: string): RunRecord[] {
  return records.filter(
    (r) => r.tool === "healer" && r.targetId === targetId && r.outcome !== "infra-error",
  );
}

export function targetStabilities(records: readonly RunRecord[]): TargetStability[] {
  const ids = [
    ...new Set(records.filter((r) => r.tool === "healer").map((r) => r.targetId)),
  ].sort();
  return ids.flatMap((targetId) => {
    const runs = healerRunsFor(records, targetId);
    if (runs.length === 0) return [];
    return [
      {
        targetId,
        majority: majorityOutcome(runs.map((r) => r.outcome)),
        stability: computeStability(
          runs.map((r) => ({
            outcome: r.outcome,
            finalLocator:
              r.healer === undefined || r.healer.finalLocators.length === 0
                ? undefined
                : r.healer.finalLocators.join(" ; "),
          })),
        ),
      },
    ];
  });
}

/** Eir's result (its first run; it is deterministic) crossed with the healer's majority result, per target. */
export function complementarityMatrix(records: readonly RunRecord[]): MatrixCell[] {
  const cells = new Map<string, string[]>();
  const stabilities = new Map(
    targetStabilities(records).map((t) => [t.targetId, t.majority] as const),
  );
  const eirByTarget = new Map(
    records
      .filter((r) => r.tool === "eir" && r.run === 1 && r.outcome !== "infra-error")
      .map((r) => [r.targetId, r.outcome] as const),
  );
  for (const [targetId, healer] of stabilities) {
    const eir = eirByTarget.get(targetId);
    if (eir === undefined) continue;
    const key = `${eir}\u0000${healer}`;
    cells.set(key, [...(cells.get(key) ?? []), targetId]);
  }
  return [...cells.entries()]
    .map(([key, targets]) => {
      const [eir = "", healer = ""] = key.split("\u0000");
      return { eir, healer, targets: targets.sort() };
    })
    .sort((a, b) => a.eir.localeCompare(b.eir) || a.healer.localeCompare(b.healer));
}

/** Do an Eir repeat's outcomes match run 1's, target by target? */
export function eirRepeatIdentical(records: readonly RunRecord[]): {
  readonly compared: number;
  readonly identical: number;
} {
  const eir = records.filter((r) => r.tool === "eir" && r.outcome !== "infra-error");
  const byTarget = new Map<string, Map<number, string>>();
  for (const r of eir) {
    const runs = byTarget.get(r.targetId) ?? new Map<number, string>();
    runs.set(r.run, r.outcome);
    byTarget.set(r.targetId, runs);
  }
  let compared = 0;
  let identical = 0;
  for (const runs of byTarget.values()) {
    const first = runs.get(1);
    const second = runs.get(2);
    if (first === undefined || second === undefined) continue;
    compared++;
    if (first === second) identical++;
  }
  return { compared, identical };
}
