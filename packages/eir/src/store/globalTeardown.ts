import path from "node:path";
import { readGenericShards } from "./genericRouteStore.js";
import { isSerializedShard, mergeRouteFiles } from "./mergeStore.js";
import { loadRouteFiles } from "./loadRouteFiles.js";
import { loadPostConditionFiles } from "./loadPostConditionFiles.js";
import {
  isSerializedPostConditionShard,
  mergePostConditionRouteFiles,
} from "./postConditionMergeStore.js";
import { postConditionShardsDir, routesDir, shardsDir } from "./paths.js";
import { stableStringify } from "./stableStringify.js";
import { writeFileAtomic } from "./atomicWrite.js";
import { rm } from "node:fs/promises";

/**
 * The actual merge logic, independent of how it's invoked. `baseDir`
 * defaults to `process.cwd()`; tests pass an explicit temp directory
 * instead (never `process.chdir()` — that throws inside worker threads,
 * which is exactly where Vitest runs).
 *
 * Merges both stores in one teardown pass (Fingerprint, unchanged since
 * Phase 3, and PostCondition, added this phase for the NOTE-001 retrofit)
 * — Playwright only exposes one `globalTeardown` hook, so both leaf types
 * ride it together, each through its own generic-store instantiation.
 */
export async function runGlobalTeardown(baseDir: string = process.cwd()): Promise<void> {
  const routes = routesDir(baseDir);
  const shards = shardsDir(baseDir);

  const baseline = await loadRouteFiles(routes);
  const shardsInOrder = await readGenericShards(shards, isSerializedShard);
  const merged = mergeRouteFiles(baseline, shardsInOrder);

  await Promise.all(
    Object.entries(merged).map(([filename, selectors]) =>
      writeFileAtomic(path.join(routes, filename), stableStringify(selectors)),
    ),
  );

  await rm(shards, { recursive: true, force: true });

  const postConditionShards = postConditionShardsDir(baseDir);
  const postConditionBaseline = await loadPostConditionFiles(routes);
  const postConditionShardsInOrder = await readGenericShards(
    postConditionShards,
    isSerializedPostConditionShard,
  );
  const mergedPostConditions = mergePostConditionRouteFiles(
    postConditionBaseline,
    postConditionShardsInOrder,
  );

  await Promise.all(
    Object.entries(mergedPostConditions).map(([filename, selectors]) =>
      writeFileAtomic(path.join(routes, filename), stableStringify(selectors)),
    ),
  );

  await rm(postConditionShards, { recursive: true, force: true });
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
