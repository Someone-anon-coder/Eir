import type { PostCondition } from "../postCondition.js";
import { writeFileAtomic } from "./atomicWrite.js";
import {
  postConditionRouteMapToPlainObject,
  type PostConditionStore,
} from "./postConditionStore.js";
import { postConditionShardFilePath, routeToPostConditionFilename } from "./paths.js";
import { stableStringify } from "./stableStringify.js";

/** Mirrors `storeToShardPayload`/`writeShard` (Fingerprint's) — see that module. */
export function postConditionStoreToShardPayload(
  store: PostConditionStore,
): Record<string, Record<string, PostCondition>> {
  const byRoute = postConditionRouteMapToPlainObject(store.routes);
  const byFilename: Record<string, Record<string, PostCondition>> = {};
  for (const [route, selectors] of Object.entries(byRoute)) {
    byFilename[routeToPostConditionFilename(route)] = selectors;
  }
  return byFilename;
}

export async function writePostConditionShard(
  store: PostConditionStore,
  workerIndex: number,
  baseDir?: string,
): Promise<void> {
  const payload = postConditionStoreToShardPayload(store);
  if (Object.keys(payload).length === 0) return;
  await writeFileAtomic(postConditionShardFilePath(workerIndex, baseDir), stableStringify(payload));
}
