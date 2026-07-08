import type { Fingerprint } from "../fingerprint.js";

/**
 * A live element's features, captured transiently at heal time — the same
 * shape as a stored `Fingerprint` minus the schema version, which only
 * ever applies to a persisted baseline (CLAUDE.md §7.1: derive types from
 * sources of truth rather than hand-copying shapes). Never persisted
 * (Blueprint P7) — this type only ever lives in memory during one triage
 * attempt.
 */
export type CandidateFeatures = Omit<Fingerprint, "v">;

export const FEATURE_NAMES = [
  "attrOverlap",
  "textSimilarity",
  "labelMatch",
  "ancestorChain",
  "siblingPosition",
  "bboxProximity",
] as const;

export type FeatureName = (typeof FEATURE_NAMES)[number];

/** Every scorer takes the same shape: pure, `readonly` inputs, one 0–1 output. */
export type Scorer = (fp: Readonly<Fingerprint>, cand: Readonly<CandidateFeatures>) => number;

export type Weights = Readonly<Record<FeatureName, number>>;

export type ScoreBreakdown = Readonly<Record<FeatureName, number>>;

export interface ScoredCandidate {
  readonly index: number;
  readonly features: CandidateFeatures;
  readonly breakdown: ScoreBreakdown;
  readonly total: number;
}
