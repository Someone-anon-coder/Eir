import { isPostCondition, type PostCondition } from "../postCondition.js";
import {
  isSerializedRouteFileOf,
  isSerializedShardOf,
  mergeGenericRouteFiles,
  type SerializedRouteFileOf,
  type SerializedShardOf,
} from "./genericRouteStore.js";

/** One route's post-condition file content: normalized selector key → post-condition. */
export type SerializedPostConditionRouteFile = SerializedRouteFileOf<PostCondition>;

export const isSerializedPostConditionRouteFile: (
  x: unknown,
) => x is SerializedPostConditionRouteFile = isSerializedRouteFileOf(isPostCondition);

export const isSerializedPostConditionShard: (
  x: unknown,
) => x is SerializedShardOf<PostCondition> = isSerializedShardOf(isSerializedPostConditionRouteFile);

/** Same merge semantics as `mergeRouteFiles` (Fingerprint's) — see that function's docstring. */
export function mergePostConditionRouteFiles(
  baseline: Readonly<Record<string, SerializedPostConditionRouteFile>>,
  shardsInOrder: readonly Readonly<Record<string, SerializedPostConditionRouteFile>>[],
): Record<string, SerializedPostConditionRouteFile> {
  return mergeGenericRouteFiles(baseline, shardsInOrder);
}
