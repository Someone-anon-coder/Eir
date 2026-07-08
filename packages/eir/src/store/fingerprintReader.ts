import type { Fingerprint } from "../fingerprint.js";
import { loadRouteFiles } from "./loadRouteFiles.js";
import { routesDir, routeToFilename } from "./paths.js";
import type { SerializedRouteFile } from "./mergeStore.js";

/**
 * Read-only counterpart to `FingerprintRecorder`: Phase 3 only ever wrote
 * the baseline (`.eir/routes/*.json` is read back exclusively by
 * `globalTeardown`, merging shards — nothing reads it back *during* a
 * run). Gate 1 of Phase 5's triage funnel ("fingerprint exists?") needs
 * exactly that read path — a selector's last-known-good fingerprint,
 * looked up by the same (route, selectorKey) addressing the store already
 * uses. Loaded once per worker (see the `eirFingerprintReader` fixture),
 * never re-read mid-run — a heal attempt reasons against the baseline as
 * of test-run start, not against fingerprints this same run may have just
 * refreshed (those live in the in-memory `FingerprintStore`/shards, not
 * yet merged back into `.eir/routes/*.json`).
 */
export interface FingerprintReader {
  lookup(route: string, selectorKey: string): Fingerprint | undefined;
}

export class BaselineFingerprintReader implements FingerprintReader {
  readonly #filesByName: Readonly<Record<string, SerializedRouteFile>>;

  constructor(filesByName: Readonly<Record<string, SerializedRouteFile>>) {
    this.#filesByName = filesByName;
  }

  lookup(route: string, selectorKey: string): Fingerprint | undefined {
    const file = this.#filesByName[routeToFilename(route)];
    return file?.[selectorKey];
  }
}

export async function loadFingerprintReader(
  baseDir: string = process.cwd(),
): Promise<FingerprintReader> {
  const filesByName = await loadRouteFiles(routesDir(baseDir));
  return new BaselineFingerprintReader(filesByName);
}
