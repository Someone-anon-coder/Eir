import type { Fingerprint } from "../fingerprint.js";
import {
  scoreAncestorChain,
  scoreAttrOverlap,
  scoreBboxProximity,
  scoreLabelMatch,
  scoreSiblingPosition,
  scoreTextSimilarity,
} from "./scorers/index.js";
import {
  FEATURE_NAMES,
  type CandidateFeatures,
  type ScoreBreakdown,
  type ScoredCandidate,
  type Weights,
} from "./types.js";

/**
 * Started as a v0 hand-set guess (Blueprint §7.5: "initial hand-set
 * weights are expected to be wrong"); tuned iteratively against real
 * benchmark runs since — see docs/tuning-log.md for the full history of
 * what changed, why, and what it measurably did.
 */
export const INITIAL_WEIGHTS: Weights = {
  attrOverlap: 0.3,
  textSimilarity: 0.2,
  labelMatch: 0.15,
  ancestorChain: 0.15,
  siblingPosition: 0.12,
  bboxProximity: 0.08,
};

/**
 * `textSimilarity` and `labelMatch` are structurally mutually exclusive
 * per element — a plain `<input>` never has rendered text, a `<button>`
 * never has a `for=`/wrapping label. Iterations 1–2 (docs/tuning-log.md)
 * tried shifting weight between the two and found the *same* ceiling
 * problem just moved from one element type to the other: whichever
 * scorer has nothing to measure still "spends" its full weight share as
 * a hard 0, capping confidence on an otherwise-perfect match. Real
 * inapplicability (nothing to compare) isn't the same evidence as a real
 * mismatch (compared and differed) — this function is what tells them
 * apart, so the weight budget renormalizes over only the scorers that
 * actually had something to measure for this fingerprint.
 */
function isApplicable(name: keyof ScoreBreakdown, fp: Readonly<Fingerprint>): boolean {
  if (name === "textSimilarity") return fp.text !== null;
  if (name === "labelMatch") return fp.label !== null;
  return true;
}

function computeBreakdown(
  fp: Readonly<Fingerprint>,
  cand: Readonly<CandidateFeatures>,
): ScoreBreakdown {
  return {
    attrOverlap: scoreAttrOverlap(fp, cand),
    textSimilarity: scoreTextSimilarity(fp, cand),
    labelMatch: scoreLabelMatch(fp, cand),
    ancestorChain: scoreAncestorChain(fp, cand),
    siblingPosition: scoreSiblingPosition(fp, cand),
    bboxProximity: scoreBboxProximity(fp, cand),
  };
}

export function scoreCandidate(
  fp: Readonly<Fingerprint>,
  cand: Readonly<CandidateFeatures>,
  weights: Weights,
): { readonly breakdown: ScoreBreakdown; readonly total: number } {
  const breakdown = computeBreakdown(fp, cand);
  let weightedSum = 0;
  let applicableWeight = 0;
  for (const name of FEATURE_NAMES) {
    if (!isApplicable(name, fp)) continue;
    weightedSum += breakdown[name] * weights[name];
    applicableWeight += weights[name];
  }
  const total = applicableWeight === 0 ? 0 : weightedSum / applicableWeight;
  return { breakdown, total };
}

/** Sorted highest score first — ties broken by candidate order (stable sort), never randomly. */
export function scoreCandidates(
  fp: Readonly<Fingerprint>,
  candidates: readonly Readonly<CandidateFeatures>[],
  weights: Weights,
): readonly ScoredCandidate[] {
  return candidates
    .map((features, index) => {
      const { breakdown, total } = scoreCandidate(fp, features, weights);
      return { index, features, breakdown, total };
    })
    .sort((a, b) => b.total - a.total);
}

export interface DecisionMargin {
  readonly winner: ScoredCandidate;
  readonly runnerUp: ScoredCandidate | null;
  /** winner.total − runnerUp.total; equals winner.total when there is no runner-up (nothing to be close to). */
  readonly margin: number;
}

/**
 * Confidence isn't just the top score — it's the top score *and* the gap to
 * whatever else was plausible (Blueprint §7.5 stage 3). A high score with a
 * near-identical runner-up (two similar table rows) is exactly where false
 * heals happen; this function surfaces that gap as a first-class number
 * rather than an afterthought.
 */
export function decideMargin(scored: readonly ScoredCandidate[]): DecisionMargin | null {
  const [winner, runnerUp] = scored;
  if (winner === undefined) return null;
  const margin = runnerUp === undefined ? winner.total : winner.total - runnerUp.total;
  return { winner, runnerUp: runnerUp ?? null, margin };
}
