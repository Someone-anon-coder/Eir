import type { FingerprintReader } from "../store/fingerprintReader.js";
import type { MatchRecorder } from "./matchLog.js";

/**
 * Bundles the two read/write capabilities `EirLocator`'s heal path needs,
 * so threading Phase 5's plumbing through the constructor chain
 * (`EirPage` → every `EirLocator` it creates → every chained
 * `EirLocator` those create) adds exactly one new parameter, not two.
 */
export interface MatchingContext {
  readonly reader: FingerprintReader;
  readonly log: MatchRecorder;
}
