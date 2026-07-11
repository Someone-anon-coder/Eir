import { loadGenericRouteFiles } from "./genericRouteStore.js";
import { isSerializedRouteFile, type SerializedRouteFile } from "./mergeStore.js";

/**
 * Shared "read every committed route file off disk" step — used by
 * `globalTeardown` (merging shards into the baseline) and by
 * `FingerprintReader` (Phase 5: loading the baseline so a running test can
 * look up a selector's last-known-good fingerprint at heal time). Delegates
 * to the generic loader (Phase 6) — see `genericRouteStore.ts`.
 */
export async function loadRouteFiles(dir: string): Promise<Record<string, SerializedRouteFile>> {
  return loadGenericRouteFiles(dir, isSerializedRouteFile);
}
