import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { assertWritable } from "../evidenceFileGuard.js";
import { loadRecords } from "./loadRecords.js";
import { buildReport, renderMarkdown, type ReportMeta } from "./report.js";
import { runDir } from "./orchestrate.js";
import { HEALER_CLASSES } from "./specDraft.js";
import { ensureTemplate, locatePlaywright } from "./workspace.js";

const REPORTS_DIR = new URL("../../reports", import.meta.url).pathname;

interface Proof {
  readonly effective: readonly string[];
  readonly mutationIneffective: readonly string[];
}

async function readProof(cls: string, seed: number): Promise<Proof | undefined> {
  try {
    const parsed: unknown = JSON.parse(
      await readFile(path.join(runDir(cls, seed), "proof.json"), "utf-8"),
    );
    if (typeof parsed !== "object" || parsed === null) return undefined;
    const effective: unknown = Reflect.get(parsed, "effective");
    const ineffective: unknown = Reflect.get(parsed, "mutationIneffective");
    return Array.isArray(effective) && Array.isArray(ineffective)
      ? { effective: effective.map(String), mutationIneffective: ineffective.map(String) }
      : undefined;
  } catch {
    return undefined;
  }
}

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

  const effectiveTargets: Record<string, number> = {};
  const mutationIneffective: Record<string, readonly string[]> = {};
  for (const cls of HEALER_CLASSES) {
    const proof = await readProof(cls, seed);
    if (proof === undefined) continue;
    effectiveTargets[cls] = proof.effective.length;
    mutationIneffective[cls] = proof.mutationIneffective;
  }
  const healer = records.flatMap((r) => (r.healer === undefined ? [] : [r.healer]));
  const meta: ReportMeta = {
    generatedAt: new Date().toISOString(),
    playwrightVersion: locatePlaywright().version,
    claudeCodeVersions: [
      ...new Set(healer.flatMap((h) => (h.cliVersion === undefined ? [] : [h.cliVersion]))),
    ].sort(),
    modelIds: [...new Set(healer.flatMap((h) => (h.model === undefined ? [] : [h.model])))].sort(),
    healerAgentSha256: (await ensureTemplate()).healerAgentSha256,
    seed,
    healerRunsPerTarget: 3,
    mutationIneffective,
    effectiveTargets,
  };
  const report = buildReport(records, meta);
  await mkdir(REPORTS_DIR, { recursive: true });
  await writeFile(jsonPath, JSON.stringify(report, null, 2) + "\n");
  await writeFile(mdPath, renderMarkdown(report));
  console.log(`Wrote ${jsonPath}\nWrote ${mdPath}`);
}

main().catch((error: unknown) => {
  console.error((error as Error).message);
  process.exitCode = 1;
});
