import type { PostCondition } from "../postCondition.js";

/**
 * NOTE-001 retrofit: mirrors `FingerprintRecorder`/`FingerprintStore`
 * exactly (same worker-scoped record/trackPending/waitForPending shape —
 * see that module's docstring for why `trackPending` exists) — a second
 * instance of the same narrow-capability pattern, for the second leaf
 * type riding the generic route-file store.
 */
export interface PostConditionRecorder {
  record(route: string, selectorKey: string, postCondition: PostCondition): void;
  trackPending(capture: Promise<void>): void;
}

export type PostConditionRouteMap = ReadonlyMap<string, ReadonlyMap<string, PostCondition>>;

/** One instance per Playwright worker (see the `eirPostConditionStore` worker-scoped fixture). */
export class PostConditionStore implements PostConditionRecorder {
  readonly #routes = new Map<string, Map<string, PostCondition>>();
  #pending: Promise<void>[] = [];

  record(route: string, selectorKey: string, postCondition: PostCondition): void {
    let selectors = this.#routes.get(route);
    if (!selectors) {
      selectors = new Map();
      this.#routes.set(route, selectors);
    }
    selectors.set(selectorKey, postCondition);
  }

  trackPending(capture: Promise<void>): void {
    this.#pending.push(capture);
  }

  async waitForPending(): Promise<void> {
    let batch = this.#pending;
    while (batch.length > 0) {
      this.#pending = [];
      await Promise.allSettled(batch);
      batch = this.#pending;
    }
  }

  get routes(): PostConditionRouteMap {
    return this.#routes;
  }
}

export function postConditionRouteMapToPlainObject(
  routes: PostConditionRouteMap,
): Record<string, Record<string, PostCondition>> {
  const result: Record<string, Record<string, PostCondition>> = {};
  for (const [route, selectors] of routes) {
    const selectorRecord: Record<string, PostCondition> = {};
    for (const [selectorKey, postCondition] of selectors) {
      selectorRecord[selectorKey] = postCondition;
    }
    result[route] = selectorRecord;
  }
  return result;
}
