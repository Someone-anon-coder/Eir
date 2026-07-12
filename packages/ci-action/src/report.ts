import { readFile } from "node:fs/promises";
import type { HealAction, ReportRow } from "playwright-eir/reporter";

export interface EirReport {
  readonly rows: readonly ReportRow[];
}

const HEAL_ACTIONS: ReadonlySet<HealAction> = new Set([
  "healed",
  "suggested",
  "missed",
  "heal-rejected",
  "heal-attempt-failed",
  "drift-suspected",
]);

function isHealAction(value: unknown): value is HealAction {
  return typeof value === "string" && HEAL_ACTIONS.has(value as HealAction);
}

function isReportRow(value: unknown): value is ReportRow {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate["testTitle"] === "string" &&
    typeof candidate["method"] === "string" &&
    typeof candidate["route"] === "string" &&
    typeof candidate["selectorKey"] === "string" &&
    isHealAction(candidate["action"]) &&
    (candidate["confidence"] === null || typeof candidate["confidence"] === "number") &&
    (candidate["suggestion"] === null || typeof candidate["suggestion"] === "string") &&
    (candidate["screenshotFile"] === null || typeof candidate["screenshotFile"] === "string")
  );
}

function isEirReport(value: unknown): value is EirReport {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return Array.isArray(candidate["rows"]) && candidate["rows"].every(isReportRow);
}

export class InvalidReportError extends Error {}

/** Reads and validates `eir-report.json` — boundary data enters as `unknown` and is narrowed, never cast (CLAUDE.md §7.1). */
export async function readEirReport(reportPath: string): Promise<EirReport> {
  const text = await readFile(reportPath, "utf8");
  const parsed: unknown = JSON.parse(text);
  if (!isEirReport(parsed)) {
    throw new InvalidReportError(`${reportPath} does not match the expected eir-report.json shape`);
  }
  return parsed;
}
