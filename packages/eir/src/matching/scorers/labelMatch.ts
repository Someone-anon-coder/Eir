import type { Fingerprint } from "../../fingerprint.js";
import type { CandidateFeatures } from "../types.js";
import { textSimilarity } from "../textDistance.js";

/**
 * Scorer 3/6 — label match. Deliberately separate from text similarity
 * (not folded into one bucket): most elements populate only one of
 * `text`/`label` (an `<input>` has a label, no rendered text of its own; a
 * `<button>` has text, no label), so a merged bucket would need its own
 * "which one do I even have" logic hidden inside it — and a single merged
 * score could never let the tuning loop discover that label-heavy classes
 * (form fields) deserve a different weight than text-heavy ones (buttons/
 * links). Catches relabeled `<label>`/`for=` wording on inputs that have no
 * text of their own to fall back on.
 */
export function scoreLabelMatch(
  fp: Readonly<Fingerprint>,
  cand: Readonly<CandidateFeatures>,
): number {
  if (fp.label === null || cand.label === null) return 0;
  return textSimilarity(fp.label, cand.label);
}
