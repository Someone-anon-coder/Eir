import { appendFile } from "node:fs/promises";
import type { MatchLogEntry } from "./matchLog.js";

/**
 * Opt-in JSONL sink for the benchmark harness only — real users never set
 * `EIR_MATCH_LOG_FILE`, so this is a no-op (zero footprint, per Blueprint
 * P7's "never persisted" for anything beyond the fingerprint store) in
 * every normal test run. One line per test, tagged with the test's own
 * title so `packages/benchmark` can correlate entries back to a
 * `targetId` without relying on execution order or stdout interleaving.
 */
export interface MatchLogLine {
  readonly testTitle: string;
  readonly attempts: readonly MatchLogEntry[];
}

export async function appendMatchLogFile(testTitle: string, attempts: readonly MatchLogEntry[]): Promise<void> {
  const filePath = process.env["EIR_MATCH_LOG_FILE"];
  if (filePath === undefined || filePath.length === 0) return;
  if (attempts.length === 0) return;

  const line: MatchLogLine = { testTitle, attempts };
  await appendFile(filePath, `${JSON.stringify(line)}\n`, "utf8");
}
