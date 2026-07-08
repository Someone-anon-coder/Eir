import { readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { isSerializedShard, mergeRouteFiles, type SerializedRouteFile } from "./mergeStore.js";
import { loadRouteFiles } from "./loadRouteFiles.js";
import { routesDir, shardsDir } from "./paths.js";
import { stableStringify } from "./stableStringify.js";
import { writeFileAtomic } from "./atomicWrite.js";

async function listJsonFiles(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir);
    return entries.filter((name) => name.endsWith(".json"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

/** Numeric, not lexicographic — "worker-2" must sort before "worker-10". */
function sortShardFilenames(filenames: readonly string[]): string[] {
  const indexOf = (name: string): number => Number(/worker-(\d+)\.json/.exec(name)?.[1] ?? 0);
  return [...filenames].sort((a, b) => indexOf(a) - indexOf(b));
}

async function readShards(dir: string): Promise<Readonly<Record<string, SerializedRouteFile>>[]> {
  const filenames = sortShardFilenames(await listJsonFiles(dir));
  const shards: Readonly<Record<string, SerializedRouteFile>>[] = [];
  for (const filename of filenames) {
    const raw: unknown = JSON.parse(await readFile(path.join(dir, filename), "utf8"));
    if (isSerializedShard(raw)) {
      shards.push(raw);
    }
  }
  return shards;
}

/**
 * The actual merge logic, independent of how it's invoked. `baseDir`
 * defaults to `process.cwd()`; tests pass an explicit temp directory
 * instead (never `process.chdir()` — that throws inside worker threads,
 * which is exactly where Vitest runs).
 */
export async function runGlobalTeardown(baseDir: string = process.cwd()): Promise<void> {
  const routes = routesDir(baseDir);
  const shards = shardsDir(baseDir);

  const baseline = await loadRouteFiles(routes);
  const shardsInOrder = await readShards(shards);
  const merged = mergeRouteFiles(baseline, shardsInOrder);

  await Promise.all(
    Object.entries(merged).map(([filename, selectors]) =>
      writeFileAtomic(path.join(routes, filename), stableStringify(selectors)),
    ),
  );

  await rm(shards, { recursive: true, force: true });
}

/**
 * Playwright's `globalTeardown` — runs once, after every worker has fully
 * torn down. Merging here (not per-worker) is why parallel runs never
 * corrupt the store: only one process ever writes `.eir/routes/*.json`.
 *
 * Accepts (and ignores) whatever Playwright passes — a `FullConfig`
 * object — rather than a `baseDir: string = process.cwd()` default,
 * because that default would silently be overridden by the real argument
 * (defaults only apply to `undefined`, not to an explicitly-passed value).
 * `runGlobalTeardown` takes the explicit `baseDir` param instead.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- signature must accept Playwright's FullConfig argument; see docstring above.
export default async function eirGlobalTeardown(_config?: unknown): Promise<void> {
  await runGlobalTeardown();
}
