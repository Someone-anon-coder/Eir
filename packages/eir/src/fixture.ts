import { test as base } from "@playwright/test";
import { EirPage } from "./eirPage.js";
import { MatchLog } from "./matching/matchLog.js";
import { appendMatchLogFile } from "./matching/matchLogFile.js";
import { loadFingerprintReader, type FingerprintReader } from "./store/fingerprintReader.js";
import { FingerprintStore } from "./store/fingerprintStore.js";
import { writeShard } from "./store/shardWriter.js";

/**
 * The sanctioned Playwright plugin surface (Blueprint §7.1): override the
 * `page` fixture so every test receives an `EirPage` instead of the real
 * `Page`. `EirPage implements Page`, so it is structurally assignable
 * anywhere a `Page` is expected (POM constructors typed `Page`, `expect()`,
 * etc.) — no cast needed at this call site.
 *
 * `eirStore` is worker-scoped: one `FingerprintStore` per Playwright
 * worker, shared by every test that worker runs. Its teardown (after
 * `use()`) fires once the worker has finished all of its tests. "Fire-
 * and-forget" only means the *test* never waits on a capture — something
 * still has to, or the last test's last action's capture (still in flight
 * to the browser and back) would be silently dropped the instant the
 * worker shuts down. `waitForPending()` drains those before the shard is
 * written. No coordination between workers is needed beyond that, since
 * each worker only ever writes its own file — the final merge across all
 * workers' shards happens separately, in `globalTeardown`.
 *
 * `eirFingerprintReader` is worker-scoped too — loaded once from the
 * committed baseline, read-only for the life of the worker (Phase 5's
 * matcher reasons against the baseline as of run start, never against
 * fingerprints this same run may have just refreshed).
 *
 * `eirMatchLog` is test-scoped (Playwright's default): a fresh `MatchLog`
 * per test, so a heal attempt can always be tagged with the exact test
 * that produced it. Its teardown writes to `EIR_MATCH_LOG_FILE` only if
 * that env var is set (only `packages/benchmark` ever sets it) — a no-op,
 * zero-footprint write for every real user.
 */
export const test = base.extend<
  { page: EirPage; eirMatchLog: MatchLog },
  { eirStore: FingerprintStore; eirFingerprintReader: FingerprintReader }
>({
  eirStore: [
    // eslint-disable-next-line no-empty-pattern -- Playwright's fixture API requires this destructured shape even with no fixture dependencies.
    async ({}, use, workerInfo) => {
      const store = new FingerprintStore();
      await use(store);
      await store.waitForPending();
      await writeShard(store, workerInfo.workerIndex);
    },
    { scope: "worker" },
  ],
  eirFingerprintReader: [
    // eslint-disable-next-line no-empty-pattern -- Playwright's fixture API requires this destructured shape even with no fixture dependencies.
    async ({}, use) => {
      await use(await loadFingerprintReader());
    },
    { scope: "worker" },
  ],
  eirMatchLog: async (
    // eslint-disable-next-line no-empty-pattern -- Playwright's fixture API requires this destructured shape even with no fixture dependencies.
    {},
    use,
    testInfo,
  ) => {
    const log = new MatchLog();
    await use(log);
    await appendMatchLogFile(testInfo.title, log.entries);
  },
  page: async ({ page, eirStore, eirFingerprintReader, eirMatchLog }, use) => {
    await use(new EirPage(page, eirStore, { reader: eirFingerprintReader, log: eirMatchLog }));
  },
});

export { expect } from "@playwright/test";
