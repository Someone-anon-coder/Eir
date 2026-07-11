import path from "node:path";

/**
 * `.eir/routes/*.json` is the committed baseline (Blueprint §7.3 — travels
 * to CI, reviewable diffs). `.eir/.shards/*.json` is per-worker scratch,
 * merged away in globalTeardown and gitignored — never meant to be seen.
 */

export function eirDir(baseDir: string = process.cwd()): string {
  return path.join(baseDir, ".eir");
}

export function routesDir(baseDir: string = process.cwd()): string {
  return path.join(eirDir(baseDir), "routes");
}

export function shardsDir(baseDir: string = process.cwd()): string {
  return path.join(eirDir(baseDir), ".shards");
}

export function shardFilePath(workerIndex: number, baseDir: string = process.cwd()): string {
  return path.join(shardsDir(baseDir), `worker-${workerIndex}.json`);
}

/**
 * NOTE-001 retrofit (Phase 6): post-conditions get their own shard
 * directory, kept separate from `.shards/` rather than sharing filenames
 * there — two different per-worker payloads can't safely share one
 * `worker-<n>.json` name without one silently clobbering the other.
 * Route files, by contrast, *do* share `routes/` (see
 * `postConditionFilePath` below) — each is a self-contained JSON document
 * a validator can tell apart, and NOTE-001's own resolution calls for a
 * "sibling file... alongside" the fingerprint's own.
 */
export function postConditionShardsDir(baseDir: string = process.cwd()): string {
  return path.join(eirDir(baseDir), ".shards-postconditions");
}

export function postConditionShardFilePath(
  workerIndex: number,
  baseDir: string = process.cwd(),
): string {
  return path.join(postConditionShardsDir(baseDir), `worker-${workerIndex}.json`);
}

/**
 * `/plan/:id/edit` → `plan__id__edit.json`. The `:` is stripped rather than
 * kept literally — Windows disallows `:` in filenames, and every default
 * dynamic segment already normalizes to the same `:id` token, so there is
 * nothing distinguishing to preserve.
 */
export function routeToFilename(route: string): string {
  const segments = route.split("/").filter((segment) => segment.length > 0);
  if (segments.length === 0) return "index.json";
  return `${segments.map((segment) => segment.replace(/:/g, "")).join("__")}.json`;
}

export function routeFilePath(route: string, baseDir: string = process.cwd()): string {
  return path.join(routesDir(baseDir), routeToFilename(route));
}

/**
 * NOTE-001 retrofit: a post-condition route file lives *in the same*
 * `routes/` directory as its fingerprint sibling, distinguished only by
 * suffix (`login.json` vs `login.postconditions.json`). Both are valid
 * `*.json` files there; `loadGenericRouteFiles`'s validator-based filter
 * (not directory separation) is what keeps a reader from ever mixing the
 * two up — confirmed by `postCondition.test.ts`'s cross-shape rejection
 * case.
 */
export function routeToPostConditionFilename(route: string): string {
  return routeToFilename(route).replace(/\.json$/, ".postconditions.json");
}

export function postConditionFilePath(route: string, baseDir: string = process.cwd()): string {
  return path.join(routesDir(baseDir), routeToPostConditionFilename(route));
}
