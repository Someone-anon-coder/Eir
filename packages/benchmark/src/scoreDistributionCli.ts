import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { assertWritable } from "./evidenceFileGuard.js";
import { gatherScoreDistribution, renderScoreDistributionMarkdown } from "./scoreDistribution.js";

const REPORTS_DIR = new URL("../reports", import.meta.url).pathname;

/**
 * B1 (1.0.0 closure) evidence CLI — same shape as `healEvidenceCli.ts`/
 * `hybridComparisonCli.ts`: a dedicated, separate CLI for one specific
 * measurement question, not another row in the standing baseline table.
 *
 * Usage: `pnpm bench:score-distribution --seed 42 [--force]`
 * (NOTE-008: refuses to overwrite an existing report without `--force`.)
 */
function parseArgs(argv: readonly string[]): { readonly seed: number; readonly force: boolean } {
  let seed = 42;
  let force = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
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

  return { seed, force };
}

async function main(): Promise<void> {
  const { seed, force } = parseArgs(process.argv.slice(2));

  await mkdir(REPORTS_DIR, { recursive: true });
  const jsonPath = path.join(REPORTS_DIR, `suggest-threshold-evidence-seed${String(seed)}.json`);
  const mdPath = path.join(REPORTS_DIR, `suggest-threshold-evidence-seed${String(seed)}.md`);
  await assertWritable(jsonPath, force);
  await assertWritable(mdPath, force);

  console.log(`Gathering match-attempt score distribution across all 8 classes (seed ${String(seed)})...`);
  const result = await gatherScoreDistribution(seed);

  await writeFile(jsonPath, `${JSON.stringify(result, null, 2)}\n`, "utf-8");
  const markdown = renderScoreDistributionMarkdown(result);
  await writeFile(mdPath, `${markdown}\n`, "utf-8");

  console.log(markdown);
  console.log(`\nWritten to ${jsonPath} and ${mdPath}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
