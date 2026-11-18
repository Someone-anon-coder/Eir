import type { HealerOutcome } from "./classify.js";
import type { RunRecord } from "./runRecord.js";

/** Counts of each outcome among a target's healer runs in one dataset. */
export type OutcomeTally = Readonly<Partial<Record<HealerOutcome, number>>>;

export interface TargetVerification {
  readonly runClass: string;
  readonly targetId: string;
  readonly original: OutcomeTally;
  readonly originalRuns: number;
  readonly rerun: OutcomeTally;
  readonly rerunRuns: number;
  /** Anchored-variant runs, reported beside the originals and never instead of them. */
  readonly anchored: OutcomeTally | undefined;
  readonly anchoredRuns: number;
  readonly eirOriginal: string | undefined;
  readonly eirRerun: string | undefined;
  /** Eir's rerun outcome equals its original (it is deterministic, so anything else is a finding). */
  readonly eirReproduces: boolean | undefined;
  readonly eirAnchored: string | undefined;
}

function tally(records: readonly RunRecord[]): { tally: OutcomeTally; runs: number } {
  const t: Partial<Record<HealerOutcome, number>> = {};
  let runs = 0;
  for (const r of records) {
    if (r.outcome === "infra-error") continue;
    t[r.outcome] = (t[r.outcome] ?? 0) + 1;
    runs++;
  }
  return { tally: t, runs };
}

const key = (r: RunRecord): string => `${r.mutationClass}\u0000${r.targetId}`;

function group(records: readonly RunRecord[], tool: "healer" | "eir"): Map<string, RunRecord[]> {
  const m = new Map<string, RunRecord[]>();
  for (const r of records.filter((x) => x.tool === tool))
    m.set(key(r), [...(m.get(key(r)) ?? []), r]);
  return m;
}

/**
 * Original-dataset runs of each rerun target beside its verification reruns
 * and, where one exists, its anchored-variant runs. Only targets present in
 * the rerun (or anchored) dataset appear; the original dataset is read, never
 * modified.
 */
export function compareReruns(
  original: readonly RunRecord[],
  rerun: readonly RunRecord[],
  anchored: readonly RunRecord[],
): TargetVerification[] {
  const keys = new Set([...group(rerun, "healer").keys(), ...group(anchored, "healer").keys()]);
  const origH = group(original, "healer");
  const rerunH = group(rerun, "healer");
  const anchH = group(anchored, "healer");
  const origE = group(original, "eir");
  const rerunE = group(rerun, "eir");
  const anchE = group(anchored, "eir");
  const eirFirst = (m: Map<string, RunRecord[]>, k: string): string | undefined =>
    [...(m.get(k) ?? [])].sort((a, b) => a.run - b.run)[0]?.outcome;

  return [...keys].sort().map((k) => {
    const [runClass = "", targetId = ""] = k.split("\u0000");
    const o = tally(origH.get(k) ?? []);
    const r = tally(rerunH.get(k) ?? []);
    const a = anchH.has(k) ? tally(anchH.get(k) ?? []) : undefined;
    const eirOriginal = eirFirst(origE, k);
    const eirRerun = eirFirst(rerunE, k);
    return {
      runClass,
      targetId,
      original: o.tally,
      originalRuns: o.runs,
      rerun: r.tally,
      rerunRuns: r.runs,
      anchored: a?.tally,
      anchoredRuns: a?.runs ?? 0,
      eirOriginal,
      eirRerun,
      eirReproduces:
        eirOriginal === undefined || eirRerun === undefined ? undefined : eirOriginal === eirRerun,
      eirAnchored: eirFirst(anchE, k),
    };
  });
}

export interface FalseHealSummary {
  /** Healed-wrong runs and total runs over the compared targets, in the original dataset and the rerun dataset. */
  readonly originalWrong: number;
  readonly originalRuns: number;
  readonly rerunWrong: number;
  readonly rerunRuns: number;
  readonly anchoredWrong: number;
  readonly anchoredRuns: number;
  /** The same figures restricted to targets that had at least one false heal in the original dataset. */
  readonly onWrongTargets: {
    readonly targets: number;
    readonly originalWrong: number;
    readonly originalRuns: number;
    readonly rerunWrong: number;
    readonly rerunRuns: number;
  };
}

export function summarizeFalseHeals(rows: readonly TargetVerification[]): FalseHealSummary {
  const sum = (
    pick: (r: TargetVerification) => number,
    from: readonly TargetVerification[] = rows,
  ): number => from.reduce((a, r) => a + pick(r), 0);
  const wrongTargets = rows.filter((r) => (r.original["healed-wrong"] ?? 0) > 0);
  return {
    originalWrong: sum((r) => r.original["healed-wrong"] ?? 0),
    originalRuns: sum((r) => r.originalRuns),
    rerunWrong: sum((r) => r.rerun["healed-wrong"] ?? 0),
    rerunRuns: sum((r) => r.rerunRuns),
    anchoredWrong: sum((r) => r.anchored?.["healed-wrong"] ?? 0),
    anchoredRuns: sum((r) => r.anchoredRuns),
    onWrongTargets: {
      targets: wrongTargets.length,
      originalWrong: sum((r) => r.original["healed-wrong"] ?? 0, wrongTargets),
      originalRuns: sum((r) => r.originalRuns, wrongTargets),
      rerunWrong: sum((r) => r.rerun["healed-wrong"] ?? 0, wrongTargets),
      rerunRuns: sum((r) => r.rerunRuns, wrongTargets),
    },
  };
}

export const formatTally = (t: OutcomeTally | undefined): string =>
  t === undefined
    ? "n/a"
    : Object.entries(t)
        .filter(([, n]) => n > 0)
        .map(([o, n]) => `${n} ${o}`)
        .join(", ") || "none";
