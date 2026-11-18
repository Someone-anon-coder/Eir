import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { assertWritable } from "../evidenceFileGuard.js";
import { loadRecords } from "./loadRecords.js";
import { buildReport, renderMarkdown } from "./report.js";
import { buildMeta } from "./reportMeta.js";

const REPORTS_DIR = new URL("../../reports", import.meta.url).pathname;

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const force = argv.includes("--force");
  const seedIdx = argv.indexOf("--seed");
  const seed = seedIdx === -1 ? 42 : Number(argv[seedIdx + 1]);
  const records = await loadRecords(seed);
  if (records.length === 0)
    throw new Error(`No run records for seed ${seed}; run bench:healer first`);

  const jsonPath = path.join(REPORTS_DIR, "healer-comparison.json");
  const mdPath = path.join(REPORTS_DIR, "healer-comparison.md");
  await assertWritable(jsonPath, force);
  await assertWritable(mdPath, force);

  const report = buildReport(records, await buildMeta(records, seed, 3));
  await mkdir(REPORTS_DIR, { recursive: true });
  await writeFile(jsonPath, JSON.stringify(report, null, 2) + "\n");
  await writeFile(mdPath, renderMarkdown(report));
  console.log(`Wrote ${jsonPath}\nWrote ${mdPath}`);
}

main().catch((error: unknown) => {
  console.error((error as Error).message);
  process.exitCode = 1;
});
