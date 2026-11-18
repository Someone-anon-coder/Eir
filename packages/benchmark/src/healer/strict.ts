import type { ReportingRecord } from "./reporting.js";
import type { Tool } from "./resume.js";
import type { RunRecord } from "./runRecord.js";
import { draftFor } from "./specDrafts.js";
import type { TracedAction } from "./traceRead.js";

/**
 * Strict reading of path-attributed targets (class-shuffle). The judge's first
 * rule credits a click whose marked-ancestor path contains the target
 * container ("lenient"). The strict rule asks what Playwright actually
 * resolved, from the trace: only the target container itself counts. Strict is
 * the primary figure in reports and the lenient one sits beside it. This is a
 * reporting rule: the per-run records are not changed.
 */
export interface StrictRow {
  readonly tool: Tool;
  readonly runClass: string;
  readonly targetId: string;
  readonly run: number;
  /** The element key Playwright resolved (or `unmarked TAG` / `(no traced interaction)`). */
  readonly resolved: string;
  readonly resolvedIsTarget: boolean;
}

/** One traced run, healer or Eir, reduced to the element that carried the interaction. */
export function strictRowFrom(
  tool: Tool,
  runClass: string,
  targetId: string,
  run: number,
  traced: readonly TracedAction[],
  groundTruthElement: string,
  which: "first" | "last",
): StrictRow {
  const action = which === "first" ? traced[0] : traced[traced.length - 1];
  const resolved =
    action === undefined
      ? "(no traced interaction)"
      : (action.ownMarker ?? `unmarked ${action.tag}`);
  return {
    tool,
    runClass,
    targetId,
    run,
    resolved,
    resolvedIsTarget: action?.ownMarker === groundTruthElement,
  };
}

/** Is this record's target judged by marked-ancestor path (and so subject to the strict rule)? */
export function isPathAttributed(record: Pick<RunRecord, "targetId">): boolean {
  return draftFor(record.targetId.replace(/^compound-release\//, ""))?.actedBy === "path";
}

const rowKey = (r: { tool: string; runClass: string; targetId: string; run: number }): string =>
  `${r.tool}\u0000${r.runClass}\u0000${r.targetId}\u0000${r.run}`;

/**
 * Relabels path-credited runs for reporting. A `healed-correct` run on a
 * path-attributed target becomes `correct-path-only` unless the trace shows it
 * resolved the target container. Every such run must have trace evidence; a
 * missing one is an error, never a silent fall-back to the lenient reading.
 */
export function applyStrictRule(
  records: readonly RunRecord[],
  rows: readonly StrictRow[],
): ReportingRecord[] {
  const byKey = new Map(rows.map((r) => [rowKey(r), r] as const));
  return records.map((r) => {
    if (r.outcome !== "healed-correct" || !isPathAttributed(r)) return r;
    const evidence = byKey.get(
      rowKey({ tool: r.tool, runClass: r.mutationClass, targetId: r.targetId, run: r.run }),
    );
    if (evidence === undefined) {
      throw new Error(
        `No trace evidence for ${r.tool} ${r.mutationClass} ${r.targetId} run ${r.run}; run the trace checks first`,
      );
    }
    return evidence.resolvedIsTarget ? r : { ...r, outcome: "correct-path-only" };
  });
}
