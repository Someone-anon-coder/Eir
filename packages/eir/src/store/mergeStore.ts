import { isFingerprint, type Fingerprint } from "../fingerprint.js";

/** One route file's content: normalized selector key → fingerprint. */
export type SerializedRouteFile = Readonly<Record<string, Fingerprint>>;

export function isSerializedRouteFile(x: unknown): x is SerializedRouteFile {
  if (typeof x !== "object" || x === null || Array.isArray(x)) return false;
  return Object.values(x as Record<string, unknown>).every(isFingerprint);
}

export function isSerializedShard(x: unknown): x is Readonly<Record<string, SerializedRouteFile>> {
  if (typeof x !== "object" || x === null || Array.isArray(x)) return false;
  return Object.values(x as Record<string, unknown>).every(isSerializedRouteFile);
}

/**
 * Pure: baseline (this run's starting `.eir/routes/*.json`, keyed by
 * filename) plus every worker's shard (in a fixed, deterministic order —
 * never wall-clock "who finished last," which parallel workers can't give
 * us) combine with last-write-wins per exact filename+selectorKey. Routes/
 * selectors untouched this run keep their baseline value unchanged
 * (Blueprint §5.1 — the baseline drifts with legitimate app evolution, it
 * doesn't get wiped on every run).
 */
export function mergeRouteFiles(
  baseline: Readonly<Record<string, SerializedRouteFile>>,
  shardsInOrder: readonly Readonly<Record<string, SerializedRouteFile>>[],
): Record<string, SerializedRouteFile> {
  const merged: Record<string, Record<string, Fingerprint>> = {};

  for (const [filename, selectors] of Object.entries(baseline)) {
    merged[filename] = { ...selectors };
  }

  for (const shard of shardsInOrder) {
    for (const [filename, selectors] of Object.entries(shard)) {
      merged[filename] = { ...merged[filename], ...selectors };
    }
  }

  return merged;
}
