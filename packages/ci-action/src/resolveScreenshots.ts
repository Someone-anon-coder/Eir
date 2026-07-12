import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ReportRow } from "playwright-eir/reporter";
import {
  planScreenshotInlining,
  type ScreenshotCandidate,
  type ScreenshotPlan,
} from "./screenshotBudget.js";

/** Headroom under GitHub's 65,536-char comment body cap — the rest of the table/prose needs room too. */
const TOTAL_SCREENSHOT_BUDGET_CHARS = 40_000;

/**
 * I/O shell around the pure budget policy: reads each row's screenshot
 * (path is relative to the report's own output directory, per
 * `ReportRow.screenshotFile`'s doc comment), base64-encodes it, and hands
 * the raw sizes to `planScreenshotInlining`. A row whose screenshot can't
 * be read (never captured, or lost between the test run and this action
 * run) is skipped rather than failing the whole comment — reporting is
 * presentation, not a gate.
 */
export async function resolveScreenshotDataUris(
  rows: readonly ReportRow[],
  reportDir: string,
): Promise<ScreenshotPlan> {
  const candidates: ScreenshotCandidate[] = [];

  for (const [rowIndex, row] of rows.entries()) {
    if (row.screenshotFile === null) continue;
    try {
      const bytes = await readFile(path.join(reportDir, row.screenshotFile));
      candidates.push({ rowIndex, base64: bytes.toString("base64") });
    } catch {
      // Fire-and-forget capture (Blueprint P1) means a missing screenshot
      // file is expected, not exceptional — the row still renders, just
      // without an image.
    }
  }

  return planScreenshotInlining(candidates, TOTAL_SCREENSHOT_BUDGET_CHARS);
}
