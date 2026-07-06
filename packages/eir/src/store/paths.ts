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
