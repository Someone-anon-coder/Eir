import { readFile } from "node:fs/promises";
import path from "node:path";
import type { EirTraceEntry } from "./eirTraceCli.js";
import { isPathAttributed, strictRowFrom, type StrictRow } from "./strict.js";
import { draftFor } from "./specDrafts.js";
import type { TraceCheckEntry } from "./traceCheckCli.js";
import { HEALER_ROOT } from "./workspace.js";

const VERIFY = path.join(HEALER_ROOT, "verification");

async function readJson<T>(file: string): Promise<T> {
  // Written by this harness's own trace-check CLIs, so the cast restates the schema they wrote.
  return JSON.parse(await readFile(path.join(VERIFY, file), "utf-8")) as T;
}

/**
 * The trace evidence behind the strict reading: for every path-attributed
 * `healed-correct` run, the element Playwright resolved. The healer's comes
 * from the replay of its final spec (its first interaction); Eir's from the
 * replay of its heal-mode run (the last interaction: the retry, since the
 * failed first attempt resolves nothing).
 */
export async function loadStrictRows(): Promise<StrictRow[]> {
  const rows: StrictRow[] = [];
  const healer = await readJson<TraceCheckEntry[]>("trace-check-healed-correct.json");
  for (const e of healer) {
    const sourceId = e.targetId.replace(/^compound-release\//, "");
    if (!isPathAttributed({ targetId: sourceId })) continue;
    const gt = draftFor(sourceId)?.element;
    if (gt === undefined) continue;
    rows.push(strictRowFrom("healer", e.runClass, e.targetId, e.run, e.traced, gt, "first"));
  }
  const eir = await readJson<EirTraceEntry[]>("trace-check-eir-class-shuffle.json");
  for (const e of eir) {
    rows.push(
      strictRowFrom("eir", e.runClass, e.targetId, e.run, e.traced, e.groundTruthElement, "last"),
    );
  }
  return rows;
}
