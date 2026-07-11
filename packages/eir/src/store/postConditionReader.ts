import type { PostCondition } from "../postCondition.js";
import { loadPostConditionFiles } from "./loadPostConditionFiles.js";
import { routesDir, routeToPostConditionFilename } from "./paths.js";
import type { SerializedPostConditionRouteFile } from "./postConditionMergeStore.js";

/**
 * Read-only counterpart to `PostConditionRecorder` — mirrors
 * `FingerprintReader` exactly (loaded once per worker from the committed
 * baseline; a heal-and-continue retry verifies against the baseline as of
 * run start, same reasoning as fingerprint lookups).
 */
export interface PostConditionReader {
  lookup(route: string, selectorKey: string): PostCondition | undefined;
}

export class BaselinePostConditionReader implements PostConditionReader {
  readonly #filesByName: Readonly<Record<string, SerializedPostConditionRouteFile>>;

  constructor(filesByName: Readonly<Record<string, SerializedPostConditionRouteFile>>) {
    this.#filesByName = filesByName;
  }

  lookup(route: string, selectorKey: string): PostCondition | undefined {
    const file = this.#filesByName[routeToPostConditionFilename(route)];
    return file?.[selectorKey];
  }
}

export async function loadPostConditionReader(
  baseDir: string = process.cwd(),
): Promise<PostConditionReader> {
  const filesByName = await loadPostConditionFiles(routesDir(baseDir));
  return new BaselinePostConditionReader(filesByName);
}
