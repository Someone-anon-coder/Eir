import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { BudgetGuard } from "./budget.js";
import { runClassComparison, runDir } from "./orchestrate.js";
import type { Tool } from "./resume.js";
import type { SpecVariant } from "./specDrafts.js";
import type { RunRecord } from "./runRecord.js";
import { HEALER_CLASSES, isHealerClass, type HealerClass } from "./specDraft.js";

interface Args {
  readonly classes: readonly HealerClass[];
  readonly seed: number;
  readonly runs: number;
  readonly tools: readonly Tool[];
  readonly maxCost: number | undefined;
  readonly maxTurns: number;
  readonly maxRunUsd: number;
  readonly wallTimeoutMs: number;
  readonly targets: readonly string[] | undefined;
  readonly eirRepeat: boolean;
  readonly dataset: string | undefined;
  readonly variant: SpecVariant | undefined;
}

function need(argv: readonly string[], i: number, flag: string): string {
  const value = argv[i + 1];
  if (value === undefined) throw new Error(`${flag} requires a value`);
  return value;
}

function parseNumber(value: string, flag: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0)
    throw new Error(`${flag} requires a positive number, got: ${value}`);
  return n;
}

export function parseArgs(argv: readonly string[]): Args {
  let classes: HealerClass[] = [];
  let seed = 42;
  let runs = 3;
  let tools: Tool[] = ["healer", "eir"];
  let maxCost: number | undefined;
  let maxTurns = 40;
  let maxRunUsd = 1;
  let wallTimeoutMs = 10 * 60_000;
  let targets: string[] | undefined;
  let eirRepeat = false;
  let dataset: string | undefined;
  let variant: SpecVariant | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--class": {
        const v = need(argv, i++, arg);
        if (!isHealerClass(v))
          throw new Error(`--class must be one of: ${HEALER_CLASSES.join(", ")} — got: ${v}`);
        classes.push(v);
        break;
      }
      case "--all":
        classes = [...HEALER_CLASSES];
        break;
      case "--seed":
        seed = parseNumber(need(argv, i++, arg), arg);
        break;
      case "--runs":
        runs = parseNumber(need(argv, i++, arg), arg);
        break;
      case "--tool": {
        const v = need(argv, i++, arg);
        if (v !== "healer" && v !== "eir" && v !== "both")
          throw new Error(`--tool must be healer, eir or both — got: ${v}`);
        tools = v === "both" ? ["healer", "eir"] : [v];
        break;
      }
      case "--max-cost":
        maxCost = parseNumber(need(argv, i++, arg), arg);
        break;
      case "--max-turns":
        maxTurns = parseNumber(need(argv, i++, arg), arg);
        break;
      case "--max-run-usd":
        maxRunUsd = parseNumber(need(argv, i++, arg), arg);
        break;
      case "--wall-timeout-min":
        wallTimeoutMs = parseNumber(need(argv, i++, arg), arg) * 60_000;
        break;
      case "--targets":
        targets = need(argv, i++, arg).split(",");
        break;
      case "--dataset":
        dataset = need(argv, i++, arg);
        break;
      case "--variant": {
        const v = need(argv, i++, arg);
        if (v !== "anchored") throw new Error(`--variant must be: anchored — got: ${v}`);
        variant = v;
        break;
      }
      case "--eir-repeat":
        eirRepeat = true;
        break;
      default:
        throw new Error(`Unknown argument: ${String(arg)}`);
    }
  }
  if (classes.length === 0) throw new Error("Provide --class <class> (repeatable) or --all");
  return {
    classes,
    seed,
    runs,
    tools,
    maxCost,
    maxTurns,
    maxRunUsd,
    wallTimeoutMs,
    targets,
    eirRepeat,
    dataset,
    variant,
  };
}

async function readRecords(dir: string): Promise<RunRecord[]> {
  const records: RunRecord[] = [];
  for (const tool of ["healer", "eir"]) {
    let names: string[];
    try {
      names = await readdir(path.join(dir, tool));
    } catch {
      continue;
    }
    for (const name of names.filter((n) => n.endsWith(".json")).sort()) {
      // Records are written by this harness, so the cast restates the schema it wrote.
      records.push(JSON.parse(await readFile(path.join(dir, tool, name), "utf-8")) as RunRecord);
    }
  }
  return records;
}

function printSummary(cls: string, records: readonly RunRecord[]): void {
  console.log(`\n== ${cls} ==`);
  for (const r of records) {
    const cost =
      r.healer?.costUsd === undefined
        ? ""
        : ` $${r.healer.costUsd.toFixed(4)} ${r.healer.turns}t ${Math.round(r.healer.wallMs / 1000)}s`;
    console.log(
      `${r.tool.padEnd(6)} run${r.run} ${r.outcome.padEnd(19)} ${r.targetId}${cost}${r.retried ? " [retried]" : ""}`,
    );
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const budget = new BudgetGuard(args.maxCost);
  const log = (line: string): void => console.log(line);
  for (const mutationClass of args.classes) {
    if (budget.exceeded) break;
    try {
      const summary = await runClassComparison({
        mutationClass,
        seed: args.seed,
        healerRuns: args.runs,
        eirRuns: args.eirRepeat ? 2 : 1,
        tools: args.tools,
        maxTurns: args.maxTurns,
        maxRunUsd: args.maxRunUsd,
        wallTimeoutMs: args.wallTimeoutMs,
        budget,
        targetFilter: args.targets,
        ...(args.dataset === undefined ? {} : { dataset: args.dataset }),
        ...(args.variant === undefined ? {} : { variant: args.variant }),
        log,
      });
      log(
        `[${mutationClass}] ran ${summary.ran}, skipped ${summary.skipped} (already recorded), ` +
          `${summary.mutationIneffective.length} mutation-ineffective`,
      );
    } catch (error) {
      console.error(`[${mutationClass}] ${(error as Error).message}`);
      process.exitCode = 1;
    }
    printSummary(mutationClass, await readRecords(runDir(mutationClass, args.seed, args.dataset)));
  }
  console.log(`\nCLI-reported healer spend this invocation: $${budget.totalUsd.toFixed(4)}`);
}

void main();
