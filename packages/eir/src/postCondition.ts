/**
 * NOTE-001 retrofit (Phase 6): a lightweight, automatically-derived signal
 * of what observably changed as a *result* of a successful imperative
 * action — captured alongside (never inside) the `Fingerprint`, so
 * heal-and-continue's retry can verify it actually reproduced the same
 * effect, not just that some element with a plausible score exists.
 *
 * Exactly two auto-derived facts, never user-authored: which route the
 * action left the page on, and whether the page's own element count grew
 * or shrank. No schema change to `Fingerprint` (Phase 3 stays untouched) —
 * see `docs/fingerprint-schema.md`'s own note anticipating this field as a
 * sibling, not a schema addition.
 */

export const POST_CONDITION_SCHEMA_VERSION = 1;

export type PostCondition =
  | {
      readonly v: typeof POST_CONDITION_SCHEMA_VERSION;
      readonly kind: "route-change";
      readonly toRoute: string;
    }
  | {
      readonly v: typeof POST_CONDITION_SCHEMA_VERSION;
      readonly kind: "dom-count-change";
      readonly sign: "increased" | "decreased";
    }
  | { readonly v: typeof POST_CONDITION_SCHEMA_VERSION; readonly kind: "none" };

export function isPostCondition(x: unknown): x is PostCondition {
  if (typeof x !== "object" || x === null) return false;
  const candidate = x as Record<string, unknown>;
  if (candidate["v"] !== POST_CONDITION_SCHEMA_VERSION) return false;

  switch (candidate["kind"]) {
    case "route-change":
      return typeof candidate["toRoute"] === "string";
    case "dom-count-change":
      return candidate["sign"] === "increased" || candidate["sign"] === "decreased";
    case "none":
      return true;
    default:
      return false;
  }
}

/** A raw before/after page snapshot (see `capture/pagePulse.ts`), already route-normalized on the Node side. */
export interface NormalizedPulse {
  readonly route: string;
  readonly elementCount: number;
}

/**
 * Pure (CLAUDE.md §7.3 — pure functions before integration): the two
 * auto-derived facts, diffed. Route wins over element-count when both
 * happen to differ (a navigating action's element-count delta is noise —
 * the destination route is the meaningful signal); a same-route, unchanged
 * count is the honest `"none"` case Mechanism A can't verify anything
 * from.
 */
export function derivePostCondition(before: NormalizedPulse, after: NormalizedPulse): PostCondition {
  if (before.route !== after.route) {
    return { v: POST_CONDITION_SCHEMA_VERSION, kind: "route-change", toRoute: after.route };
  }
  if (before.elementCount !== after.elementCount) {
    return {
      v: POST_CONDITION_SCHEMA_VERSION,
      kind: "dom-count-change",
      sign: after.elementCount > before.elementCount ? "increased" : "decreased",
    };
  }
  return { v: POST_CONDITION_SCHEMA_VERSION, kind: "none" };
}

/**
 * Verification (heal-and-continue's retry only, Phase 6 policy — never
 * called for ordinary successes). `stored.kind === "none"` always passes:
 * an honest, documented partial-coverage case — Mechanism A only has
 * teeth where the *original* action had an observable side effect to
 * begin with.
 */
export function postConditionMatches(stored: PostCondition, observed: PostCondition): boolean {
  if (stored.kind === "none") return true;
  if (stored.kind !== observed.kind) return false;
  if (stored.kind === "route-change" && observed.kind === "route-change") {
    return stored.toRoute === observed.toRoute;
  }
  if (stored.kind === "dom-count-change" && observed.kind === "dom-count-change") {
    return stored.sign === observed.sign;
  }
  return false;
}
