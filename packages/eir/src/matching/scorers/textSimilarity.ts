import type { Fingerprint } from "../../fingerprint.js";
import type { CandidateFeatures } from "../types.js";
import { textSimilarity } from "../textDistance.js";

/**
 * Scorer 2/6 — text similarity. Catches `text-change` directly (rendered
 * label wording drift) and confirms attribute-overlap on classes that
 * don't touch text at all. No signal (returns 0, not 1) when either side
 * has no text — an absence of text is not evidence of a match, and
 * treating "both blank" as a perfect score would falsely favor candidates
 * that simply render no text (e.g. matching a text-bearing button against
 * a bare icon button). Compromised in lockstep with label match whenever a
 * mutation targets the wording itself — see the account-modal
 * Cancel/Confirm near-dup case in docs/tuning-log.md.
 */
export function scoreTextSimilarity(
  fp: Readonly<Fingerprint>,
  cand: Readonly<CandidateFeatures>,
): number {
  if (fp.text === null || cand.text === null) return 0;
  return textSimilarity(fp.text, cand.text);
}
