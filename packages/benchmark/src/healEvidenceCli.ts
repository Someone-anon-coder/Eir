import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { assertWritable } from "./evidenceFileGuard.js";
import { isMutationClass, type MutationClass } from "./mutationClasses.js";
import { renderHealModeEvidenceMarkdown, runHealModeEvidence } from "./healModeEvidence.js";

const REPORTS_DIR = new URL("../reports", import.meta.url).pathname;

/**
 * NOTE-001 retrofit's dedicated evidence CLI — deliberately separate from
 * `cli.ts` (Phase 4/5's `--class`/`--all` baseline runner): heal-mode
 * results use a different outcome vocabulary (real retry outcomes, not
 * Blueprint §7.8's healed-correct/healed-wrong/suggested/missed four-way
 * classification, which assumes nothing ever retries) and are evidence
 * for a specific, narrow question, not another row in the standing
 * baseline table.
 *
 * Usage: `pnpm bench:heal-evidence --class sibling-reorder --seed 42 [--force]`
 * (NOTE-008: refuses to overwrite an existing report without `--force`.)
 */
function parseArgs(
  argv: readonly string[],
): { readonly mutationClass: MutationClass; readonly seed: number; readonly force: boolean } {
  let mutationClass: MutationClass | undefined;
  let seed = 42;
  let force = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--class") {
      const value = argv[i + 1];
      if (value === undefined || !isMutationClass(value)) {
        throw new Error(`--class requires a valid mutation class — got: ${String(value)}`);
      }
      mutationClass = value;
      i++;
      continue;
    }
    if (arg === "--seed") {
      const value = argv[i + 1];
      const parsed = value === undefined ? NaN : Number(value);
      if (!Number.isFinite(parsed)) {
        throw new Error(`--seed requires a finite number — got: ${String(value)}`);
      }
      seed = parsed;
      i++;
      continue;
    }
    if (arg === "--force") {
      force = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (mutationClass === undefined) {
    throw new Error("Provide --class <mutationClass>");
  }
  return { mutationClass, seed, force };
}

async function main(): Promise<void> {
  const { mutationClass, seed, force } = parseArgs(process.argv.slice(2));

  await mkdir(REPORTS_DIR, { recursive: true });
  const jsonPath = path.join(REPORTS_DIR, `note001-heal-evidence-${mutationClass}.json`);
  const mdPath = path.join(REPORTS_DIR, `note001-heal-evidence-${mutationClass}.md`);
  // NOTE-008: check both before writing either, so a rerun never partially clobbers.
  await assertWritable(jsonPath, force);
  await assertWritable(mdPath, force);

  console.log(`Running ${mutationClass} (seed ${String(seed)}) in heal mode...`);
  const evidence = await runHealModeEvidence(mutationClass, seed);

  await writeFile(jsonPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf-8");
  await writeFile(mdPath, `${renderHealModeEvidenceMarkdown(evidence)}\n`, "utf-8");

  console.log(renderHealModeEvidenceMarkdown(evidence));
  console.log(`\nWritten to ${jsonPath} and ${mdPath}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
