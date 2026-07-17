import type { ReportRow } from "playwright-eir/reporter";

/**
 * §13 #new (1.0.0 closure, A3): a Playwright test attempt that CI retries
 * (a real `retries` config, or a transient infra rerun) re-runs Eir's
 * whole triage→match→policy pipeline and appends its own `ReportRow` for
 * the same underlying selector — 3 genuinely distinct broken selectors
 * across 2 retried attempts becomes 6 rows in `eir-report.json`. Grouping
 * key is `(route, selectorKey, suggestion)`: the same broken selector,
 * matched against the same live DOM, reliably produces the same
 * suggestion across retries even when confidence drifts slightly.
 *
 * Deliberately renderer-only — `eir-report.json`/`.md` (the reporter's
 * own artifact) keeps every real attempt untouched; that file is the raw
 * evidence trail, and if retries genuinely produced *different*
 * confidence scores, that's itself diagnostic information worth
 * preserving. The PR comment is the human-facing summary layer
 * (Blueprint §7.7) — noise reduction belongs there, not in the artifact.
 */
export interface DedupedRow {
  readonly row: ReportRow;
  /** Total rows collapsed into this one, including itself. 1 = no duplicates. */
  readonly seenCount: number;
}

function dedupeKey(row: ReportRow): string {
  return JSON.stringify([row.route, row.selectorKey, row.suggestion]);
}

/**
 * The representative row per group is the one with the highest
 * confidence (`null` sorts lowest — no confidence to prefer over any real
 * number), ties broken by first-seen order.
 */
export function dedupeReportRows(rows: readonly ReportRow[]): readonly DedupedRow[] {
  // Map preserves insertion order, so iterating `.values()` below yields
  // groups in first-seen order — no separate ordering bookkeeping needed.
  const groupsByKey = new Map<string, ReportRow[]>();

  for (const row of rows) {
    const key = dedupeKey(row);
    const group = groupsByKey.get(key);
    if (group === undefined) {
      groupsByKey.set(key, [row]);
    } else {
      group.push(row);
    }
  }

  return [...groupsByKey.values()].map((members) => {
    const representative = members.reduce((best, candidate) =>
      (candidate.confidence ?? -Infinity) > (best.confidence ?? -Infinity) ? candidate : best,
    );
    return { row: representative, seenCount: members.length };
  });
}
