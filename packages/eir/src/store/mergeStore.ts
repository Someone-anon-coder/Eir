import { isFingerprint, type Fingerprint } from "../fingerprint.js";
import {
  isSerializedRouteFileOf,
  isSerializedShardOf,
  mergeGenericRouteFiles,
  type SerializedRouteFileOf,
  type SerializedShardOf,
} from "./genericRouteStore.js";

/** One route file's content: normalized selector key → fingerprint. */
export type SerializedRouteFile = SerializedRouteFileOf<Fingerprint>;

export const isSerializedRouteFile: (x: unknown) => x is SerializedRouteFile =
  isSerializedRouteFileOf(isFingerprint);

export const isSerializedShard: (x: unknown) => x is SerializedShardOf<Fingerprint> =
  isSerializedShardOf(isSerializedRouteFile);

/**
 * Pure: baseline (this run's starting `.eir/routes/*.json`, keyed by
 * filename) plus every worker's shard (in a fixed, deterministic order —
 * never wall-clock "who finished last," which parallel workers can't give
 * us) combine with last-write-wins per exact filename+selectorKey. Routes/
 * selectors untouched this run keep their baseline value unchanged
 * (Blueprint §5.1 — the baseline drifts with legitimate app evolution, it
 * doesn't get wiped on every run). Delegates to the generic version
 * (Phase 6) — `PostCondition`'s route-file store is the same shape with a
 * different leaf type; see `genericRouteStore.ts`.
 */
export function mergeRouteFiles(
  baseline: Readonly<Record<string, SerializedRouteFile>>,
  shardsInOrder: readonly Readonly<Record<string, SerializedRouteFile>>[],
): Record<string, SerializedRouteFile> {
  return mergeGenericRouteFiles(baseline, shardsInOrder);
}
