import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { MUTATION_CLASSES, isMutationClass } from "./mutationClasses.js";
import type { MutationClass } from "./mutationClasses.js";
import { runBenchmark } from "./runner.js";
import type { BenchRunResult } from "./runner.js";
import { buildBaselineReport, renderMarkdownTable } from "./report.js";

const RESULTS_DIR = new URL("../results", import.meta.url).pathname;
const REPORTS_DIR = new URL("../reports", import.meta.url).pathname;

interface CliArgs {
  readonly all: boolean;
  readonly mutationClass: MutationClass | undefined;
  readonly seed: number;
}

function parseArgs(argv: readonly string[]): CliArgs {
  let all = false;
  let mutationClass: MutationClass | undefined;
  let seed = 42;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--all") {
      all = true;
      continue;
    }
    if (arg === "--class") {
      const value = argv[i + 1];
      if (value === undefined || !isMutationClass(value)) {
        throw new Error(
          `--class requires one of: ${MUTATION_CLASSES.join(", ")} — got: ${String(value)}`,
        );
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

  if (!all && mutationClass === undefined) {
    throw new Error("Provide --class <mutationClass> or --all");
  }

  return { all, mutationClass, seed };
}

async function writeResult(run: BenchRunResult): Promise<void> {
  await mkdir(RESULTS_DIR, { recursive: true });
  const file = path.join(RESULTS_DIR, `${run.mutationClass}-seed${run.seed}.json`);
  await writeFile(file, `${JSON.stringify(run, null, 2)}\n`, "utf-8");
}

async function loadAllResults(): Promise<readonly BenchRunResult[]> {
  await mkdir(RESULTS_DIR, { recursive: true });
  const entries = await readdir(RESULTS_DIR);
  const runs: BenchRunResult[] = [];
  for (const entry of entries) {
    if (!entry.endsWith(".json")) continue;
    const raw = await readFile(path.join(RESULTS_DIR, entry), "utf-8");
    // Committed results this same CLI wrote — trusted, not external input.
    runs.push(JSON.parse(raw) as BenchRunResult);
  }
  return runs;
}

async function writeReport(runs: readonly BenchRunResult[]): Promise<void> {
  await mkdir(REPORTS_DIR, { recursive: true });
  const report = buildBaselineReport(runs);
  await writeFile(
    path.join(REPORTS_DIR, "baseline.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf-8",
  );
  await writeFile(path.join(REPORTS_DIR, "baseline.md"), `${renderMarkdownTable(report.aggregates)}\n`, "utf-8");
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.all) {
    for (const mutationClass of MUTATION_CLASSES) {
      console.log(`Running ${mutationClass} (seed ${String(args.seed)})...`);
      const run = await runBenchmark(mutationClass, args.seed);
      await writeResult(run);
    }
  } else if (args.mutationClass !== undefined) {
    console.log(`Running ${args.mutationClass} (seed ${String(args.seed)})...`);
    const run = await runBenchmark(args.mutationClass, args.seed);
    await writeResult(run);
  }

  const allRuns = await loadAllResults();
  await writeReport(allRuns);
  console.log(`Report written to ${REPORTS_DIR}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
