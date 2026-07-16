import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Blueprint §7.3 / §9.2: the fingerprint store's size envelope (1-3 KB per
 * fingerprint; single-digit MB for a suite with thousands of selectors)
 * and Phase 3's own Definition-of-Done bar (< 500 KB for the reference
 * suite). Phase 3 measured this by hand once (~26 KB, NOTES.md 2026-07-07)
 * and it was never re-checked by an automated test since — this closes
 * that gap by measuring the real, currently-committed `.eir/routes/`
 * directory (fingerprints + Phase 6's post-condition siblings together)
 * against the reference suite Eir actually dogfoods on.
 */

const REFERENCE_SUITE_ROUTES_DIR = new URL(
  "../../../demo-app/.eir/routes",
  import.meta.url,
).pathname;

const PHASE_3_DOD_BAR_BYTES = 500 * 1024;

async function directorySizeBytes(dir: string): Promise<number> {
  const entries = await readdir(dir, { withFileTypes: true });
  let total = 0;
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const stats = await stat(path.join(dir, entry.name));
    total += stats.size;
  }
  return total;
}

describe("Blueprint §7.3/§9.2: fingerprint store size envelope", () => {
  it("stays under the committed 500 KB bar on the real reference suite's .eir/routes/", async () => {
    const sizeBytes = await directorySizeBytes(REFERENCE_SUITE_ROUTES_DIR);
    expect(sizeBytes).toBeGreaterThan(0); // sanity: the directory really has content, not an empty/missing path
    expect(sizeBytes).toBeLessThan(PHASE_3_DOD_BAR_BYTES);
  });
});
