import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { assertWritable } from "./evidenceFileGuard.js";
import { renderHybridComparisonMarkdown, runHybridComparison, type HybridClassResult } from "./hybridComparison.js";

const REPORTS_DIR = new URL("../reports", import.meta.url).pathname;

/**
 * Phase 8's dedicated comparison CLI — mirrors `healEvidenceCli.ts`'s
 * precedent (a narrow, purpose-built evidence runner, separate from
 * `cli.ts`'s standing baseline). Requires `GEMINI_API_KEY` in the
 * environment (the fallback's own clean no-key skip means an unset key
 * here would silently produce zero invocations rather than fail loudly,
 * which would be a misleading comparison run — so this CLI checks first
 * and refuses to proceed without it).
 *
 * Usage: `pnpm bench:hybrid --seed 42 [--force]`
 * (NOTE-008: refuses to overwrite an existing report without `--force` —
 * this run makes real, billed API calls, so a lost report is expensive
 * to reproduce, not just inconvenient.)
 */
function parseArgs(argv: readonly string[]): { readonly seed: number; readonly force: boolean } {
  let seed = 42;
  let force = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--seed") {
      const value = argv[i + 1];
      const parsed = value === undefined ? NaN : Number(value);
      if (!Number.isFinite(parsed)) {
        throw new Error(`--seed requires a finite number — got: ${String(value)}`);
      }
      seed = parsed;
      i++;
      continue;
    }
    if (argv[i] === "--force") {
      force = true;
    }
  }
  return { seed, force };
}

async function main(): Promise<void> {
  const { seed, force } = parseArgs(process.argv.slice(2));

  const apiKey = process.env["GEMINI_API_KEY"];
  if (apiKey === undefined || apiKey.length === 0) {
    throw new Error(
      "GEMINI_API_KEY is not set in this process's environment — the comparison run needs it to produce real invocations (this is the one benchmark command that requires the key; the standing `pnpm bench` suite never does).",
    );
  }

  await mkdir(REPORTS_DIR, { recursive: true });
  const jsonPath = path.join(REPORTS_DIR, "hybrid-comparison.json");
  const mdPath = path.join(REPORTS_DIR, "hybrid-comparison.md");
  // NOTE-008: this run makes real, billed, possibly non-reproducible API
  // calls — refusing to silently clobber a prior run matters more here
  // than anywhere else in the benchmark tooling.
  await assertWritable(jsonPath, force);
  await assertWritable(mdPath, force);

  console.log(`Running hybrid comparison across all 8 classes (seed ${String(seed)})...`);
  const results: HybridClassResult[] = [];
  for (const result of await runHybridComparison(seed)) {
    console.log(`  ${result.mutationClass}: ${String(result.invocations.length)} fallback invocation(s)`);
    results.push(result);
  }

  await writeFile(jsonPath, `${JSON.stringify({ seed, generatedAt: new Date().toISOString(), results }, null, 2)}\n`, "utf-8");
  await writeFile(mdPath, `${renderHybridComparisonMarkdown(results)}\n`, "utf-8");

  console.log(`\n${renderHybridComparisonMarkdown(results)}`);
  console.log(`\nWritten to ${jsonPath} and ${mdPath}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
