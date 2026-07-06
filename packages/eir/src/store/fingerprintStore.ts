import type { Fingerprint } from "../fingerprint.js";

/**
 * The narrow capability `EirPage`/`EirLocator` depend on — just enough to
 * record a capture and register a fire-and-forget capture's promise so
 * worker teardown can drain it. They never see the full `FingerprintStore`
 * (file I/O, serialization), keeping the wrapper classes testable with a
 * trivial mock.
 *
 * `trackPending` exists because "fire-and-forget" only means the *test*
 * never awaits a capture — something still has to, or the worker-scoped
 * fixture's teardown (which writes the shard) can run before the last
 * action's capture has even reached the browser and back, silently
 * dropping it. Draining happens once, at worker teardown — not after every
 * test — since nothing needs the store persisted mid-run.
 */
export interface FingerprintRecorder {
  record(route: string, selectorKey: string, fingerprint: Fingerprint): void;
  trackPending(capture: Promise<void>): void;
}

export type RouteMap = ReadonlyMap<string, ReadonlyMap<string, Fingerprint>>;

/** One instance per Playwright worker (see the `eirStore` worker-scoped fixture). */
export class FingerprintStore implements FingerprintRecorder {
  readonly #routes = new Map<string, Map<string, Fingerprint>>();
  #pending: Promise<void>[] = [];

  record(route: string, selectorKey: string, fingerprint: Fingerprint): void {
    let selectors = this.#routes.get(route);
    if (!selectors) {
      selectors = new Map();
      this.#routes.set(route, selectors);
    }
    selectors.set(selectorKey, fingerprint);
  }

  trackPending(capture: Promise<void>): void {
    this.#pending.push(capture);
  }

  /** Awaits every capture registered so far, including ones registered while waiting. */
  async waitForPending(): Promise<void> {
    let batch = this.#pending;
    while (batch.length > 0) {
      this.#pending = [];
      await Promise.allSettled(batch);
      batch = this.#pending;
    }
  }

  get routes(): RouteMap {
    return this.#routes;
  }
}

export function routeMapToPlainObject(
  routes: RouteMap,
): Record<string, Record<string, Fingerprint>> {
  const result: Record<string, Record<string, Fingerprint>> = {};
  for (const [route, selectors] of routes) {
    const selectorRecord: Record<string, Fingerprint> = {};
    for (const [selectorKey, fingerprint] of selectors) {
      selectorRecord[selectorKey] = fingerprint;
    }
    result[route] = selectorRecord;
  }
  return result;
}
