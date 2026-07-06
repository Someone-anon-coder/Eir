import type { Fingerprint } from "../fingerprint.js";
import { writeFileAtomic } from "./atomicWrite.js";
import { routeMapToPlainObject, type FingerprintStore } from "./fingerprintStore.js";
import { routeToFilename, shardFilePath } from "./paths.js";
import { stableStringify } from "./stableStringify.js";

/**
 * Shard content is keyed by filename (not the raw route string) — the same
 * addressing scheme the final `.eir/routes/*.json` files use — so
 * `mergeRouteFiles` never has to reconstruct a route from a filename.
 */
export function storeToShardPayload(
  store: FingerprintStore,
): Record<string, Record<string, Fingerprint>> {
  const byRoute = routeMapToPlainObject(store.routes);
  const byFilename: Record<string, Record<string, Fingerprint>> = {};
  for (const [route, selectors] of Object.entries(byRoute)) {
    byFilename[routeToFilename(route)] = selectors;
  }
  return byFilename;
}

/** Runs at worker-fixture teardown — after all of this worker's tests are done. */
export async function writeShard(
  store: FingerprintStore,
  workerIndex: number,
  baseDir?: string,
): Promise<void> {
  const payload = storeToShardPayload(store);
  if (Object.keys(payload).length === 0) return;
  await writeFileAtomic(shardFilePath(workerIndex, baseDir), stableStringify(payload));
}
