import { HEALER_OUTCOMES, type HealerOutcome } from "./classify.js";
import type { RunRecord } from "./runRecord.js";

/**
 * The outcomes a *report* counts. It is the judge's `HealerOutcome` plus one
 * reporting-only label, `correct-path-only`: a `healed-correct` run on a
 * path-attributed target (class-shuffle) whose trace shows Playwright resolved
 * an element other than the target container. The stored per-run record keeps
 * its original outcome; only the report relabels it (see `strict.ts`).
 */
export const REPORT_OUTCOMES = [...HEALER_OUTCOMES, "correct-path-only"] as const;
export type ReportOutcome = (typeof REPORT_OUTCOMES)[number];

export type ReportingRecord = Omit<RunRecord, "outcome"> & { readonly outcome: ReportOutcome };

export const isHealerOutcome = (o: ReportOutcome): o is HealerOutcome => o !== "correct-path-only";
