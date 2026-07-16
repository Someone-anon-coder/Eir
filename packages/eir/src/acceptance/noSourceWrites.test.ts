import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Blueprint §9.2: "No mode, ever, modifies user source files." That claim
 * has never had an automated proof — only manual code inspection (Phase 9
 * hardening's acceptance sweep). This is a structural guard, not a
 * behavioral one: it asserts every filesystem *write* call anywhere in
 * `packages/eir/src` lives in one of the files already known and tested
 * to write only inside `.eir/` (the store), an explicit opt-in
 * `EIR_*_LOG_FILE` env var path (the benchmark's own diagnostic channel,
 * never user source), or a report output directory (the reporter). If a
 * future change adds a write call anywhere else, this test fails —
 * catching the mistake at the same structural level the invariant lives
 * at, rather than hoping a behavioral test happens to exercise it.
 */

const SRC_DIR = new URL("..", import.meta.url).pathname;

const WRITE_CALL_PATTERN = /\b(writeFile|writeFileSync|appendFile|appendFileSync|rename|renameSync|unlink|unlinkSync|rm|rmSync|copyFile|copyFileSync)\s*\(/;

/**
 * The only files allowed to call a raw filesystem write primitive, and why
 * each is safe. `store/shardWriter.ts` and `store/postConditionShardWriter.ts`
 * write too — but only ever by calling `atomicWrite.ts`'s `writeFileAtomic`,
 * never a raw primitive of their own, so they correctly don't appear here.
 */
const ALLOWED_WRITERS: ReadonlySet<string> = new Set([
  "store/atomicWrite.ts", // the one real write primitive most callers route through — every path rooted at .eir/ (store/paths.ts)
  "store/globalTeardown.ts", // writeFileAtomic (via atomicWrite) plus a raw rm() of its own, but only ever on .eir/.shards*/ scratch dirs after merging
  "matching/matchLogFile.ts", // no-op unless EIR_MATCH_LOG_FILE is set — benchmark-only diagnostic channel
  "policy/policyLogFile.ts", // no-op unless EIR_POLICY_LOG_FILE is set — same, for policy events
  "reporter/eirReporter.ts", // eir-report.json/.md + screenshots, under EirReporterOptions.outputDir (default "eir-report")
]);

async function collectTsFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectTsFiles(full)));
    } else if (entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
      files.push(full);
    }
  }
  return files;
}

describe("Blueprint §9.2: no filesystem write outside the known-safe surface", () => {
  it("finds a write call only in files already confined to .eir/, an opt-in log env var, or the report output dir", async () => {
    const files = await collectTsFiles(SRC_DIR);
    const offenders: string[] = [];

    for (const file of files) {
      const relative = path.relative(SRC_DIR, file);
      if (ALLOWED_WRITERS.has(relative)) continue;

      const contents = await readFile(file, "utf8");
      if (WRITE_CALL_PATTERN.test(contents)) {
        offenders.push(relative);
      }
    }

    expect(offenders).toEqual([]);
  });

  it("the allow-list itself is exactly the files that actually contain a write call (no stale entries)", async () => {
    const files = await collectTsFiles(SRC_DIR);
    const actualWriters = new Set<string>();

    for (const file of files) {
      const contents = await readFile(file, "utf8");
      if (WRITE_CALL_PATTERN.test(contents)) {
        actualWriters.add(path.relative(SRC_DIR, file));
      }
    }

    expect([...actualWriters].sort()).toEqual([...ALLOWED_WRITERS].sort());
  });
});
