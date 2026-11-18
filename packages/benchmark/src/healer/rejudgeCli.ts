import { cp, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { adjudicate, rejudgeRecord } from "./rejudge.js";
import type { RunRecord } from "./runRecord.js";
import { draftFor } from "./specDrafts.js";
import { HEALER_ROOT } from "./workspace.js";

const RUNS = path.join(HEALER_ROOT, "runs");
const BACKUP = path.join(HEALER_ROOT, "runs-original-v1");
const ADJUDICATOR = "Aayush";

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

/** Re-judges every saved healer run with the current rules; no healer is run. Originals are backed up once. */
async function main(): Promise<void> {
  if (!(await exists(BACKUP))) await cp(RUNS, BACKUP, { recursive: true });
  const changes: string[] = [];
  let total = 0;
  let adjudications = 0;
  for (const entry of (await readdir(RUNS)).sort()) {
    if (!/-seed\d+$/.test(entry)) continue;
    const dir = path.join(RUNS, entry, "healer");
    let names: string[];
    try {
      names = await readdir(dir);
    } catch {
      continue;
    }
    for (const name of names.filter((n) => n.endsWith(".json")).sort()) {
      const file = path.join(dir, name);
      // Records are written by this harness, so the cast restates the schema it wrote.
      const record = JSON.parse(await readFile(file, "utf-8")) as RunRecord;
      const draft = draftFor(record.targetId);
      if (draft === undefined) throw new Error(`No draft for ${record.targetId}`);
      const finalFile = record.healer?.finalSpecFile;
      const finalSpec =
        finalFile === undefined
          ? undefined
          : await readFile(finalFile, "utf-8").catch(() => undefined);
      let next = rejudgeRecord(record, draft, finalSpec);
      total++;
      // The owner's verdict on the class-shuffle runs once left for review: tampered-green, action-removed.
      const wasLeftForReview = (next.previousOutcome ?? next.outcome) === "needs-human-review";
      if (wasLeftForReview && record.mutationClass === "class-shuffle" && !record.adjudicated) {
        next = adjudicate(next, "tampered-green", ADJUDICATOR, "action-removed");
        adjudications++;
      }
      if (next.outcome !== record.outcome) {
        changes.push(
          `${entry} ${record.targetId} run${record.run}: ${record.outcome} -> ${next.outcome}${next.adjudicated ? " (adjudicated)" : ""}`,
        );
      }
      if (JSON.stringify(next) !== JSON.stringify(record))
        await writeFile(file, JSON.stringify(next, null, 2));
    }
  }
  console.log(
    `Re-judged ${total} healer runs; ${changes.length} outcome change(s); ${adjudications} adjudication(s) recorded.`,
  );
  for (const c of changes) console.log(`  ${c}`);
}

main().catch((error: unknown) => {
  console.error((error as Error).message);
  process.exitCode = 1;
});
