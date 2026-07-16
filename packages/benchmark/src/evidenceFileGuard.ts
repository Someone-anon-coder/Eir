import { access } from "node:fs/promises";

/**
 * NOTE-008 (Phase 9 hardening): both evidence CLIs (`healEvidenceCli.ts`,
 * `hybridComparisonCli.ts`) write to a fixed filename in
 * `packages/benchmark/reports/`, unconditionally overwriting whatever was
 * there. This cost real data once — a rerun "chasing a cleaner sample"
 * silently destroyed the richest hybrid-comparison run before it was
 * copied aside (the per-invocation detail was only recovered from the
 * session transcript; see NOTES.md NOTE-008 and docs/hybrid-comparison.md's
 * process note). Some of this evidence is genuinely non-reproducible
 * (live API calls, timing-sensitive captures), so silent overwrite is a
 * real risk, not a cosmetic one.
 *
 * Refuses to clobber an existing file unless the caller explicitly opts
 * in via `--force` — a rerun now has to say so.
 */
export async function assertWritable(filePath: string, force: boolean): Promise<void> {
  if (force) return;

  let exists = true;
  try {
    await access(filePath);
  } catch {
    exists = false;
  }
  if (!exists) return;

  throw new Error(
    `${filePath} already exists — refusing to overwrite without --force. ` +
      "This evidence can be non-reproducible (live API calls, timing-sensitive captures) — " +
      "copy it aside first if you want to keep it, or pass --force to overwrite deliberately.",
  );
}
