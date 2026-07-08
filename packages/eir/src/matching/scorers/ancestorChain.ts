import type { AncestorHop, Fingerprint } from "../../fingerprint.js";
import type { CandidateFeatures } from "../types.js";

/**
 * Scorer 4/6 — ancestor-chain similarity. Nearest hop weighted highest
 * (immediate parent matters more than a hop three levels up). Catches
 * `wrapper-inject` (a shifted-by-one chain still scores well on hops 2/3
 * even when hop 1 changes) and doubles as a second opinion on
 * `class-shuffle`. Weak at telling apart same-shaped siblings under an
 * identical parent chain (every row in the same table) — see
 * docs/tuning-log.md for the measured `near-dup.table-row` case, where this
 * scorer is provably blind: a row-action button's real chain
 * (`button → td → tr → tbody`) never even reaches the `<table>` element
 * that actually distinguishes the two tables, and `AncestorHop` doesn't
 * carry `data-testid` in the first place.
 */

const HOP_WEIGHTS: readonly number[] = [0.5, 0.3, 0.2];
const TAG_WEIGHT = 0.4;
const ID_WEIGHT = 0.3;
const CLASS_WEIGHT = 0.3;

/**
 * Both-empty counts as a match (1), not "no evidence" (0): most real
 * ancestor hops (a bare `<tr>`/`<td>`/`<tbody>`) carry no salient classes
 * at all, and two elements that are *both* bare at a given hop is itself a
 * consistent structural fact, not an absence of one. Contrast with
 * `attrOverlap`, where a *missing* captured attribute on the fingerprint
 * means "never observed," not "observed as absent" — `AncestorHop.classes`
 * is always populated (possibly empty), so there's no such ambiguity here.
 */
function classOverlap(a: readonly string[], b: readonly string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersectionSize = 0;
  for (const token of setA) {
    if (setB.has(token)) intersectionSize += 1;
  }
  const unionSize = setA.size + setB.size - intersectionSize;
  return unionSize === 0 ? 0 : intersectionSize / unionSize;
}

/** Same both-null-counts-as-a-match reasoning as `classOverlap` applies to `id`. */
function hopScore(a: AncestorHop, b: AncestorHop): number {
  let score = 0;
  if (a.tag === b.tag) score += TAG_WEIGHT;
  if (a.id === b.id) score += ID_WEIGHT;
  score += CLASS_WEIGHT * classOverlap(a.classes, b.classes);
  return score;
}

export function scoreAncestorChain(
  fp: Readonly<Fingerprint>,
  cand: Readonly<CandidateFeatures>,
): number {
  if (fp.ancestors.length === 0) return 0;

  let totalWeight = 0;
  let weightedScore = 0;
  for (const [index, fpHop] of fp.ancestors.entries()) {
    const weight = HOP_WEIGHTS[index] ?? 0;
    if (weight === 0) continue;
    totalWeight += weight;
    const candHop = cand.ancestors[index];
    if (candHop !== undefined) {
      weightedScore += weight * hopScore(fpHop, candHop);
    }
  }

  return totalWeight === 0 ? 0 : weightedScore / totalWeight;
}
