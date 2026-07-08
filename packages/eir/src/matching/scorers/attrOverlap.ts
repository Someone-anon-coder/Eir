import type { Fingerprint } from "../../fingerprint.js";
import type { CandidateFeatures } from "../types.js";

/**
 * Scorer 1/6 — attribute overlap. `id`/`data-testid`/`name` are
 * developer-assigned and near-unique, so they carry far more weight than
 * `type`/`role`/`aria-*`, which are often shared by every element of the
 * same kind on a page. Strongest single signal for `id-rename` and
 * `class-shuffle` (attrs untouched); blind by construction whenever the
 * mutation *is* the one attribute the fingerprint had, and unable to tell
 * two near-duplicate elements apart when they share every allow-listed
 * attribute (see docs/tuning-log.md — the near-dup case this scorer alone
 * cannot resolve).
 */

const HIGH_VALUE_KEYS: ReadonlySet<string> = new Set(["id", "data-testid", "name"]);
const HIGH_WEIGHT = 3;
const LOW_WEIGHT = 1;

function weightFor(key: string): number {
  return HIGH_VALUE_KEYS.has(key) ? HIGH_WEIGHT : LOW_WEIGHT;
}

export function scoreAttrOverlap(
  fp: Readonly<Fingerprint>,
  cand: Readonly<CandidateFeatures>,
): number {
  const fpKeys = Object.keys(fp.attrs);
  if (fpKeys.length === 0) return 0;

  let totalWeight = 0;
  let matchedWeight = 0;
  for (const key of fpKeys) {
    const weight = weightFor(key);
    totalWeight += weight;
    if (cand.attrs[key] === fp.attrs[key]) {
      matchedWeight += weight;
    }
  }

  return totalWeight === 0 ? 0 : matchedWeight / totalWeight;
}
