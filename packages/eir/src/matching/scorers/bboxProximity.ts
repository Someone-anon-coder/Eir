import type { Fingerprint } from "../../fingerprint.js";
import type { CandidateFeatures } from "../types.js";

/**
 * Scorer 6/6 — bounding-box proximity. The most "coincidental" of the six:
 * proximity is not identity, and per Blueprint §6 geometry never drives
 * matching alone — this scorer exists only as a low-weighted tie-breaker
 * riding alongside five other signals. It is, however, measurably the
 * *only* signal that distinguishes `near-dup.table-row`'s Active/Archived
 * "Front Desk Tablet" pair (see docs/tuning-log.md): every other scorer
 * ties exactly, because the two rows share identical attrs, text, label,
 * ancestor chain, and sibling position by construction. Vulnerable to
 * unrelated layout reflows shifting a genuinely-unchanged element's
 * position across the quantization grid.
 *
 * `MAX_DISTANCE_PX` is a v0 hand-set constant, not a measured one — first
 * candidate for the tuning loop to revisit if bbox-driven decisions look
 * over- or under-confident in practice.
 */

export const MAX_DISTANCE_PX = 600;
const SIZE_TERM_WEIGHT = 0.25;

function distance(dx: number, dy: number): number {
  return Math.sqrt(dx * dx + dy * dy);
}

export function scoreBboxProximity(
  fp: Readonly<Fingerprint>,
  cand: Readonly<CandidateFeatures>,
): number {
  const positionDistance = distance(fp.bbox.x - cand.bbox.x, fp.bbox.y - cand.bbox.y);
  const sizeDistance = distance(fp.bbox.w - cand.bbox.w, fp.bbox.h - cand.bbox.h);
  const combined = positionDistance + SIZE_TERM_WEIGHT * sizeDistance;
  return Math.max(0, 1 - combined / MAX_DISTANCE_PX);
}
