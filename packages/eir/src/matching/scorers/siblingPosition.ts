import type { Fingerprint } from "../../fingerprint.js";
import type { CandidateFeatures } from "../types.js";

/**
 * Scorer 5/6 — sibling position. Exact index match scores highest; a
 * one-off shift still gets partial credit, normalized by sibling count so
 * "off by one of three" degrades faster than "off by one of thirty".
 * Orthogonal to text/attrs — survives mutations that attack wording or
 * attributes while leaving DOM order untouched (the Edit/Remove near-dup
 * pair). Actively misleading on its own for the exact class it sounds
 * purpose-built for, `sibling-reorder`: when elements genuinely swap
 * positions, this scorer rewards whichever candidate now *occupies* the
 * fingerprint's old index, not the element that actually moved there. It's
 * only safe as one of six weighted votes, never a standalone signal.
 */
export function scoreSiblingPosition(
  fp: Readonly<Fingerprint>,
  cand: Readonly<CandidateFeatures>,
): number {
  const denominator = Math.max(fp.siblingCount, cand.siblingCount, 1);
  const distance = Math.abs(fp.siblingIndex - cand.siblingIndex);
  return Math.max(0, 1 - distance / denominator);
}
