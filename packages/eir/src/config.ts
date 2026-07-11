import type { EirMode } from "./policy/eirMode.js";
import type { RouteOverride } from "./routeNormalize.js";

/**
 * The user-facing config surface (Blueprint §7.6 / approach doc Phase 6
 * work item 4). Deliberately routed through Playwright's own sanctioned
 * option mechanism (`test.use()` / `playwright.config.ts`'s `use` block —
 * the same mechanism `viewport`, `baseURL`, etc. already use) rather than
 * a bespoke file-loader that reaches into the user's filesystem for a
 * magic `eir.config.ts` filename: Playwright has no such auto-discovery
 * mechanism of its own to piggyback on, and inventing one would mean
 * resolving/transforming an arbitrary TS file from inside a published
 * package — real complexity for a capability Playwright's fixture options
 * already provide for free. `eir.config.ts` stays the *documented
 * convention* for where a user defines this object (see `docs/ci.md`'s
 * future example / this phase's session notes) — `defineEirConfig` is the
 * typed identity function that makes that file self-checking, exactly
 * like the approach doc's Pre-Phase TS Tip:
 *
 * ```ts
 * // eir.config.ts
 * export default defineEirConfig({ mode: { mode: "suggest-only" } });
 *
 * // playwright.config.ts
 * import eirConfig from "./eir.config";
 * export default defineConfig({ use: { eirConfig } });
 * ```
 */
export interface EirConfig {
  readonly mode: EirMode;
  readonly routeOverrides?: readonly RouteOverride[];
}

/** Shipped default posture (Q6 / Blueprint §7.6): nothing is ever retried until a team opts in. */
export const DEFAULT_EIR_CONFIG: EirConfig = { mode: { mode: "suggest-only" } };

/**
 * Identity function with a type check — the point is compile-time
 * validation of what a user writes, not a builder. Illegal combinations
 * (e.g. `mode: "suggest-only"` carrying a `healThreshold`) are already
 * unrepresentable via `EirMode`'s discriminated union; this function's
 * only job is to give that check a name at the call site.
 */
export function defineEirConfig(config: EirConfig): EirConfig {
  return config;
}
