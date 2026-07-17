import type { HealAction, ReportRow } from "playwright-eir/reporter";

/**
 * §13 #5 (1.0.0 closure, A2): whether a run is worth a brand-new PR
 * comment must be keyed off what Eir *did* (`action`), not whether
 * `suggestion` happens to be populated. A genuinely `"healed"` row can
 * carry `suggestion: null` — `suggestSelector` itself documents this as a
 * real, if rare, case (e.g. the page navigated away between matching and
 * suggesting) — and that row is still a real finding: a retry actually
 * ran and passed. `"missed"` (nothing found at all) and
 * `"drift-suspected"` (a routine note on an otherwise-passing action)
 * stay excluded on their own, matching `upsertEirComment`'s existing
 * anti-spam intent: don't create a fresh comment on a PR Eir had nothing
 * actionable to say about.
 */
const HEAL_FAMILY_ACTIONS: ReadonlySet<HealAction> = new Set([
  "healed",
  "suggested",
  "heal-rejected",
  "heal-attempt-failed",
]);

export function hasFindings(rows: readonly ReportRow[]): boolean {
  return rows.some((row) => HEAL_FAMILY_ACTIONS.has(row.action));
}
