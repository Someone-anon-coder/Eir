import { loadGenericRouteFiles } from "./genericRouteStore.js";
import {
  isSerializedPostConditionRouteFile,
  type SerializedPostConditionRouteFile,
} from "./postConditionMergeStore.js";

/**
 * Reads every post-condition route file out of `routes/` — the same
 * directory `loadRouteFiles` reads fingerprints from. Safe to share: the
 * validator (not the directory) is what tells a `login.json` (Fingerprint)
 * apart from a `login.postconditions.json` (PostCondition) — see
 * `postCondition.test.ts`'s cross-shape rejection case.
 */
export async function loadPostConditionFiles(
  dir: string,
): Promise<Record<string, SerializedPostConditionRouteFile>> {
  return loadGenericRouteFiles(dir, isSerializedPostConditionRouteFile);
}
