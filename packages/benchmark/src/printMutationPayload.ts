import { isMutationClass, MUTATION_CLASSES } from "./mutationClasses.js";
import type { MutationClass } from "./mutationClasses.js";
import { buildMutationRun } from "./groundTruth.js";

/**
 * Phase 7's dogfood workflow needs exactly `VITE_EIR_MUTATIONS`'s JSON —
 * the same payload `runBenchmark`/`devServer.ts` build internally for the
 * harness's own probe specs — but applied instead against the reference
 * suite, in a real CI job, for a real PR comment. Reusing
 * `buildMutationRun` rather than hand-authoring a payload keeps the
 * dogfood demo on the same seeded, reproducible machinery as the
 * benchmark itself, instead of a second, drifting copy.
 */
interface ParsedArgs {
  readonly mutationClass: MutationClass;
  readonly seed: number;
  readonly excludePrefixes: readonly string[];
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  let mutationClass: MutationClass | undefined;
  let seed = 42;
  const excludePrefixes: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--class") {
      const value = argv[i + 1];
      if (value === undefined || !isMutationClass(value)) {
        throw new Error(`--class requires one of: ${MUTATION_CLASSES.join(", ")} — got: ${String(value)}`);
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
    if (arg === "--exclude-prefix") {
      const value = argv[i + 1];
      if (value === undefined) throw new Error("--exclude-prefix requires a value");
      excludePrefixes.push(value);
      i++;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (mutationClass === undefined) {
    throw new Error("Provide --class <mutationClass>");
  }

  return { mutationClass, seed, excludePrefixes };
}

/**
 * `id-rename`'s registry includes three `login.*` targets; renaming them
 * blocks nearly every downstream spec that must log in first (a cascade,
 * not a real demonstration of independent selector drift). Filtering by
 * target-id prefix — rather than picking a different mutation class —
 * keeps the dogfood workflow on the same seeded id-rename run the
 * benchmark's own baseline table reports, just scoped to targets whose
 * breakage stays legible in a single PR comment.
 */
const { mutationClass, seed, excludePrefixes } = parseArgs(process.argv.slice(2));
const run = buildMutationRun(mutationClass, seed);
const filteredAttrs = Object.fromEntries(
  Object.entries(run.overridePayload.attrs ?? {}).filter(
    ([targetId]) => !excludePrefixes.some((prefix) => targetId.startsWith(prefix)),
  ),
);
process.stdout.write(JSON.stringify({ ...run.overridePayload, attrs: filteredAttrs }));
