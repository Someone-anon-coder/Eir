import { test as base } from "@playwright/test";
import { DEFAULT_EIR_CONFIG, type EirConfig } from "./config.js";
import { EirPage } from "./eirPage.js";
import { MatchLog } from "./matching/matchLog.js";
import { appendMatchLogFile } from "./matching/matchLogFile.js";
import { PolicyLog } from "./policy/policyLog.js";
import { appendPolicyLogFile } from "./policy/policyLogFile.js";
import { loadFingerprintReader, type FingerprintReader } from "./store/fingerprintReader.js";
import { FingerprintStore } from "./store/fingerprintStore.js";
import { loadPostConditionReader, type PostConditionReader } from "./store/postConditionReader.js";
import { PostConditionStore } from "./store/postConditionStore.js";
import { writePostConditionShard } from "./store/postConditionShardWriter.js";
import { writeShard } from "./store/shardWriter.js";

/**
 * The sanctioned Playwright plugin surface (Blueprint §7.1): override the
 * `page` fixture so every test receives an `EirPage` instead of the real
 * `Page`. `EirPage implements Page`, so it is structurally assignable
 * anywhere a `Page` is expected (POM constructors typed `Page`, `expect()`,
 * etc.) — no cast needed at this call site.
 *
 * `eirStore`/`eirPostConditionStore` are worker-scoped: one instance per
 * Playwright worker, shared by every test that worker runs, mirroring
 * each other exactly (see `store/postConditionStore.ts`'s docstring for
 * why). "Fire-and-forget" only means the *test* never waits on a capture
 * — something still has to, or the last test's last action's capture
 * (still in flight to the browser and back) would be silently dropped the
 * instant the worker shuts down. `waitForPending()` drains those before
 * each store's shard is written.
 *
 * `page` is *test*-scoped: Playwright tears down the real underlying
 * page/browser context the instant this fixture's own `use()` call
 * returns, which happens as soon as the test body finishes — before
 * either worker-level store teardown runs. Awaiting both stores'
 * `waitForPending()` here too, while the real page is still alive, closes
 * that gap (redundant with the worker-level await for anything that
 * already finished, never harmful).
 *
 * `eirConfig` is Playwright's sanctioned *option* pattern (`{ option:
 * true }`) — settable per-test via `test.use({ eirConfig: {...} })` or
 * project-wide via `playwright.config.ts`'s `use` block, exactly like
 * `viewport` or `baseURL`. Defaults to `suggest-only` (Q6): nothing is
 * ever retried until a team opts in. See `config.ts` for the full
 * `eir.config.ts` authoring convention this backs.
 *
 * `eirPolicyLog` is test-scoped, mirroring `eirMatchLog`: a fresh
 * `PolicyLog` per test, written to `EIR_POLICY_LOG_FILE` only if that env
 * var is set (only `packages/benchmark`'s dual-mode harness sets it) —
 * zero-footprint for every real user.
 */
export const test = base.extend<
  { page: EirPage; eirMatchLog: MatchLog; eirPolicyLog: PolicyLog; eirConfig: EirConfig },
  {
    eirStore: FingerprintStore;
    eirPostConditionStore: PostConditionStore;
    eirFingerprintReader: FingerprintReader;
    eirPostConditionReader: PostConditionReader;
  }
>({
  eirConfig: [DEFAULT_EIR_CONFIG, { option: true }],

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

  eirPostConditionStore: [
    // eslint-disable-next-line no-empty-pattern -- Playwright's fixture API requires this destructured shape even with no fixture dependencies.
    async ({}, use, workerInfo) => {
      const store = new PostConditionStore();
      await use(store);
      await store.waitForPending();
      await writePostConditionShard(store, workerInfo.workerIndex);
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

  eirPostConditionReader: [
    // eslint-disable-next-line no-empty-pattern -- Playwright's fixture API requires this destructured shape even with no fixture dependencies.
    async ({}, use) => {
      await use(await loadPostConditionReader());
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

  eirPolicyLog: async (
    // eslint-disable-next-line no-empty-pattern -- Playwright's fixture API requires this destructured shape even with no fixture dependencies.
    {},
    use,
    testInfo,
  ) => {
    const log = new PolicyLog();
    await use(log);
    await appendPolicyLogFile(testInfo.title, log.events);
  },

  page: async (
    {
      page,
      eirStore,
      eirPostConditionStore,
      eirFingerprintReader,
      eirPostConditionReader,
      eirMatchLog,
      eirPolicyLog,
      eirConfig,
    },
    use,
    testInfo,
  ) => {
    await use(
      new EirPage(page, eirStore, eirPostConditionStore, {
        reader: eirFingerprintReader,
        log: eirMatchLog,
        postConditionReader: eirPostConditionReader,
        mode: eirConfig.mode,
        policyLog: eirPolicyLog,
        annotate: (type, description) => testInfo.annotations.push({ type, description }),
      }),
    );
    // See the docstring above: the real page is still alive here, but
    // won't be by the time the worker-scoped stores' own teardown runs.
    await Promise.all([eirStore.waitForPending(), eirPostConditionStore.waitForPending()]);
  },
});

export { expect } from "@playwright/test";
