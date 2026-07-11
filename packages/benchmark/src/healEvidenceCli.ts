import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
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
 * Usage: `pnpm bench:heal-evidence --class sibling-reorder --seed 42`
 */
function parseArgs(argv: readonly string[]): { readonly mutationClass: MutationClass; readonly seed: number } {
  let mutationClass: MutationClass | undefined;
  let seed = 42;

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
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (mutationClass === undefined) {
    throw new Error("Provide --class <mutationClass>");
  }
  return { mutationClass, seed };
}

async function main(): Promise<void> {
  const { mutationClass, seed } = parseArgs(process.argv.slice(2));
  console.log(`Running ${mutationClass} (seed ${String(seed)}) in heal mode...`);
  const evidence = await runHealModeEvidence(mutationClass, seed);

  await mkdir(REPORTS_DIR, { recursive: true });
  const jsonPath = path.join(REPORTS_DIR, `note001-heal-evidence-${mutationClass}.json`);
  const mdPath = path.join(REPORTS_DIR, `note001-heal-evidence-${mutationClass}.md`);
  await writeFile(jsonPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf-8");
  await writeFile(mdPath, `${renderHealModeEvidenceMarkdown(evidence)}\n`, "utf-8");

  console.log(renderHealModeEvidenceMarkdown(evidence));
  console.log(`\nWritten to ${jsonPath} and ${mdPath}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
