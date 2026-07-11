import type { EirMode } from "../policy/eirMode.js";
import type { PolicyRecorder } from "../policy/policyLog.js";
import type { FingerprintReader } from "../store/fingerprintReader.js";
import type { PostConditionReader } from "../store/postConditionReader.js";
import type { MatchRecorder } from "./matchLog.js";

/** A narrow capability over `TestInfo.annotations.push(...)` — keeps `EirLocator`/`EirPage` decoupled from Playwright's `TestInfo` type, same reasoning as `FingerprintRecorder`/`MatchRecorder`'s narrow shapes. */
export type Annotate = (type: string, description?: string) => void;

/**
 * Bundles every read/write capability `EirLocator`'s heal path needs, so
 * threading this plumbing through the constructor chain (`EirPage` →
 * every `EirLocator` it creates → every chained `EirLocator` those
 * create) adds exactly one new parameter, not several. Extended this
 * phase (Phase 6): `postConditionReader` (NOTE-001's retry verification),
 * `mode` (the enacted policy config), `policyLog` (what the reporter
 * reads), `annotate` (visible heal annotations, Blueprint P3).
 */
export interface MatchingContext {
  readonly reader: FingerprintReader;
  readonly log: MatchRecorder;
  readonly postConditionReader: PostConditionReader;
  readonly mode: EirMode;
  readonly policyLog: PolicyRecorder;
  readonly annotate: Annotate;
}
