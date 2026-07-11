import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

/**
 * "One JSON file per route, sharded per worker, merged at teardown"
 * (Blueprint §7.3 / Phase 3), parameterized over the per-selector value
 * type. `Fingerprint` (Phase 3, `mergeStore.ts`/`loadRouteFiles.ts`) and
 * `PostCondition` (NOTE-001 retrofit, Phase 6, `postConditionMergeStore.ts`)
 * are the two instances — identical file-per-route/shard/merge shape,
 * different leaf payload, so this is written once and both ride it,
 * instead of copying four modules for the second data type. Written this
 * phase; `mergeStore.ts`/`loadRouteFiles.ts` are refactored to delegate
 * here with their existing exports/behavior unchanged (no Phase 3 test
 * touches this file directly).
 */

export type SerializedRouteFileOf<T> = Readonly<Record<string, T>>;
export type SerializedShardOf<T> = Readonly<Record<string, SerializedRouteFileOf<T>>>;

export function isSerializedRouteFileOf<T>(
  isValue: (x: unknown) => x is T,
): (x: unknown) => x is SerializedRouteFileOf<T> {
  return (x: unknown): x is SerializedRouteFileOf<T> => {
    if (typeof x !== "object" || x === null || Array.isArray(x)) return false;
    return Object.values(x as Record<string, unknown>).every(isValue);
  };
}

export function isSerializedShardOf<T>(
  isRouteFile: (x: unknown) => x is SerializedRouteFileOf<T>,
): (x: unknown) => x is SerializedShardOf<T> {
  return (x: unknown): x is SerializedShardOf<T> => {
    if (typeof x !== "object" || x === null || Array.isArray(x)) return false;
    return Object.values(x as Record<string, unknown>).every(isRouteFile);
  };
}

/**
 * Pure: baseline (this run's starting `.eir/routes/*.json`, keyed by
 * filename) plus every worker's shard (in a fixed, deterministic order)
 * combine with last-write-wins per exact filename+key. Routes/keys
 * untouched this run keep their baseline value unchanged (Blueprint
 * §5.1 — the baseline drifts with legitimate app evolution, it doesn't
 * get wiped on every run).
 */
export function mergeGenericRouteFiles<T>(
  baseline: Readonly<Record<string, SerializedRouteFileOf<T>>>,
  shardsInOrder: readonly Readonly<Record<string, SerializedRouteFileOf<T>>>[],
): Record<string, SerializedRouteFileOf<T>> {
  const merged: Record<string, Record<string, T>> = {};

  for (const [filename, values] of Object.entries(baseline)) {
    merged[filename] = { ...values };
  }

  for (const shard of shardsInOrder) {
    for (const [filename, values] of Object.entries(shard)) {
      merged[filename] = { ...merged[filename], ...values };
    }
  }

  return merged;
}

export async function listJsonFiles(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir);
    return entries.filter((name) => name.endsWith(".json"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

export async function loadGenericRouteFiles<T>(
  dir: string,
  isRouteFile: (x: unknown) => x is SerializedRouteFileOf<T>,
): Promise<Record<string, SerializedRouteFileOf<T>>> {
  const filenames = await listJsonFiles(dir);
  const result: Record<string, SerializedRouteFileOf<T>> = {};
  for (const filename of filenames) {
    const raw: unknown = JSON.parse(await readFile(path.join(dir, filename), "utf8"));
    if (isRouteFile(raw)) {
      result[filename] = raw;
    }
  }
  return result;
}

/** Numeric, not lexicographic — "worker-2" must sort before "worker-10". */
export function sortShardFilenames(filenames: readonly string[]): string[] {
  const indexOf = (name: string): number => Number(/worker-(\d+)\.json/.exec(name)?.[1] ?? 0);
  return [...filenames].sort((a, b) => indexOf(a) - indexOf(b));
}

export async function readGenericShards<T>(
  dir: string,
  isShard: (x: unknown) => x is SerializedShardOf<T>,
): Promise<SerializedShardOf<T>[]> {
  const filenames = sortShardFilenames(await listJsonFiles(dir));
  const shards: SerializedShardOf<T>[] = [];
  for (const filename of filenames) {
    const raw: unknown = JSON.parse(await readFile(path.join(dir, filename), "utf8"));
    if (isShard(raw)) {
      shards.push(raw);
    }
  }
  return shards;
}
