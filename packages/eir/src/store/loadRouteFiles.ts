import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { isSerializedRouteFile, type SerializedRouteFile } from "./mergeStore.js";

/**
 * Shared "read every committed route file off disk" step — used by
 * `globalTeardown` (merging shards into the baseline) and by
 * `FingerprintReader` (Phase 5: loading the baseline so a running test can
 * look up a selector's last-known-good fingerprint at heal time). Kept as
 * one function rather than two near-duplicates.
 */

async function listJsonFiles(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir);
    return entries.filter((name) => name.endsWith(".json"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

export async function loadRouteFiles(dir: string): Promise<Record<string, SerializedRouteFile>> {
  const filenames = await listJsonFiles(dir);
  const result: Record<string, SerializedRouteFile> = {};
  for (const filename of filenames) {
    const raw: unknown = JSON.parse(await readFile(path.join(dir, filename), "utf8"));
    if (isSerializedRouteFile(raw)) {
      result[filename] = raw;
    }
  }
  return result;
}
